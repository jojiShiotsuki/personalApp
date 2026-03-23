import os
from dotenv import load_dotenv

load_dotenv()

from pathlib import Path
import logging
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from app.database import init_db
from app.services.scheduler_service import start_scheduler, stop_scheduler
from app.auth import get_current_user
from app.routes import auth, tasks, crm, task_parser, export, goals, goal_parser, projects, project_templates, social_content, dashboard, time, outreach, cold_outreach, lead_discovery, daily_outreach, sprint, loom_audit, pipeline_calculator, discovery_call, search_planner, reports, autoresearch, joji_ai

app = FastAPI(
    title="Personal Productivity App",
    description="Task management and CRM system with AI assistant",
    version="1.0.4",
    redirect_slashes=False,
)

# CORS configuration - supports both development and production
# Detect production via RENDER env var (set automatically on Render) or ENVIRONMENT
is_production = os.getenv("RENDER") or os.getenv("ENVIRONMENT") == "production"

if is_production:
    raw_origins = os.getenv("CORS_ORIGINS", "")
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    # Ensure the Render frontend is always allowed
    render_frontend = "https://vertex-frontend-h5qj.onrender.com"
    if render_frontend not in allowed_origins:
        allowed_origins.append(render_frontend)
else:
    # Development: allow localhost origins
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def strip_trailing_slash(request: Request, call_next):
    """Strip trailing slashes from API paths so both /api/x and /api/x/ match routes.

    With redirect_slashes=False, FastAPI won't issue 307 redirects that break
    CORS preflight requests. This middleware normalizes paths instead.
    """
    path = request.scope["path"]
    if path.startswith("/api/") and path.endswith("/") and path != "/":
        request.scope["path"] = path.rstrip("/")
    return await call_next(request)

# Register auth router (no auth dependency - public endpoints)
app.include_router(auth.router)


# TEMPORARY: Unauthenticated debug endpoint for projects 500 diagnosis
@app.get("/debug/projects-schema")
def _debug_projects_schema():
    import traceback, json
    from fastapi.responses import JSONResponse
    from sqlalchemy import text
    try:
        from app.database.connection import SessionLocal
        db = SessionLocal()
        result = db.execute(text("SELECT id, name, status FROM projects LIMIT 5")).fetchall()
        proj_rows = [{"id": r[0], "name": str(r[1]), "status": str(r[2])} for r in result]
        task_result = db.execute(text("SELECT id, title, status, priority FROM tasks LIMIT 5")).fetchall()
        task_rows = [{"id": r[0], "title": str(r[1]), "status": str(r[2]), "priority": str(r[3])} for r in task_result]
        db.close()
        return JSONResponse(content={"ok": True, "projects": proj_rows, "tasks": task_rows})
    except Exception as e:
        tb = traceback.format_exc()
        return JSONResponse(content={"ok": False, "error": str(e), "type": type(e).__name__, "tb": tb}, status_code=200)

@app.get("/debug/projects-full")
def _debug_projects_full():
    """Try the actual projects route logic and return detailed error."""
    import traceback
    from fastapi.responses import JSONResponse
    from sqlalchemy import text
    try:
        from app.database.connection import SessionLocal
        from app.models.project import Project, ProjectStatus
        from app.models.task import Task, TaskStatus
        from app.models.crm import Contact
        from app.schemas.project import ProjectResponse
        from sqlalchemy import func, case, or_
        db = SessionLocal()
        # Step 1: Query projects
        projects = db.query(Project).order_by(Project.updated_at.desc()).all()
        step1 = f"Queried {len(projects)} projects OK"
        # Step 2: Check enum values
        enum_check = [{"id": p.id, "status": str(p.status), "status_type": type(p.status).__name__} for p in projects[:3]]
        # Step 3: Try task counts
        project_ids = [p.id for p in projects]
        task_counts = db.query(
            Task.project_id,
            func.count(Task.id).label("total"),
            func.sum(case((or_(Task.status == TaskStatus.COMPLETED, Task.status == TaskStatus.SKIPPED), 1), else_=0)).label("completed")
        ).filter(Task.project_id.in_(project_ids)).group_by(Task.project_id).all()
        step3 = f"Task counts OK: {len(task_counts)} groups"
        # Step 4: Set virtual attrs and try serialization
        counts_map = {tc.project_id: {"total": tc.total, "completed": int(tc.completed or 0)} for tc in task_counts}
        contact_ids = [p.contact_id for p in projects if p.contact_id]
        contact_map = {}
        if contact_ids:
            contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
            contact_map = {c.id: c.name for c in contacts}
        for project in projects:
            counts = counts_map.get(project.id, {"total": 0, "completed": 0})
            project.task_count = counts["total"]
            project.completed_task_count = counts["completed"]
            project.contact_name = contact_map.get(project.contact_id) if project.contact_id else None
        step4 = "Virtual attrs set OK"
        # Step 5: Try Pydantic serialization
        try:
            results = [ProjectResponse.model_validate(p, from_attributes=True).model_dump() for p in projects]
            step5 = f"Serialized {len(results)} projects OK"
        except Exception as e:
            step5 = f"Serialization FAILED: {type(e).__name__}: {str(e)}"
            # Try one at a time to find the bad one
            bad_projects = []
            for p in projects:
                try:
                    ProjectResponse.model_validate(p, from_attributes=True)
                except Exception as pe:
                    bad_projects.append({"id": p.id, "name": p.name, "error": str(pe)})
            step5 += f" | Bad projects: {bad_projects}"
        db.close()
        return JSONResponse(content={"ok": True, "step1": step1, "enum_check": enum_check, "step3": step3, "step4": step4, "step5": step5})
    except Exception as e:
        tb = traceback.format_exc()
        return JSONResponse(content={"ok": False, "error": str(e), "type": type(e).__name__, "tb": tb}, status_code=200)

# Register API routers (all protected by auth)
# IMPORTANT: task_parser and goal_parser must come BEFORE tasks/goals to match
# /parse and /parse-bulk before the generic /{id} route
auth_dep = [Depends(get_current_user)]
app.include_router(task_parser.router, dependencies=auth_dep)
app.include_router(goal_parser.router, dependencies=auth_dep)
app.include_router(tasks.router, dependencies=auth_dep)
app.include_router(crm.router, dependencies=auth_dep)
app.include_router(export.router, dependencies=auth_dep)
app.include_router(goals.router, dependencies=auth_dep)
app.include_router(projects.router, dependencies=auth_dep)
app.include_router(project_templates.router, dependencies=auth_dep)
app.include_router(social_content.router, dependencies=auth_dep)
app.include_router(dashboard.router, dependencies=auth_dep)
app.include_router(time.router, dependencies=auth_dep)
app.include_router(outreach.router, dependencies=auth_dep)
app.include_router(cold_outreach.router, dependencies=auth_dep)
app.include_router(lead_discovery.router, dependencies=auth_dep)
app.include_router(daily_outreach.router, dependencies=auth_dep)
app.include_router(sprint.router, dependencies=auth_dep)
app.include_router(loom_audit.router, dependencies=auth_dep)
app.include_router(pipeline_calculator.router, dependencies=auth_dep)
app.include_router(discovery_call.router, dependencies=auth_dep)
app.include_router(search_planner.router, dependencies=auth_dep)
app.include_router(reports.router, dependencies=auth_dep)
app.include_router(autoresearch.router)
app.include_router(joji_ai.router, dependencies=auth_dep)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and ensure CORS headers are present."""
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in allowed_origins:
        headers["access-control-allow-origin"] = origin
        headers["access-control-allow-credentials"] = "true"
    import traceback
    tb = traceback.format_exc()
    error_detail = f"Internal server error: {str(exc)} | TB: {tb}" if request.url.path.startswith("/debug/") else ("Internal server error" if is_production else f"Internal server error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": error_detail},
        headers=headers,
    )

@app.on_event("startup")
async def startup_event():
    """Initialize database and background scheduler on startup"""
    init_db()
    start_scheduler()

@app.on_event("shutdown")
def shutdown_event():
    """Stop background scheduler"""
    stop_scheduler()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": app.version}


# Serve static files (frontend build)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    # Mount static assets
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    # Serve SPA for all non-API routes
    @app.middleware("http")
    async def serve_spa(request: Request, call_next):
        # Let API routes and health check pass through
        if request.url.path.startswith("/api/") or request.url.path == "/health":
            return await call_next(request)

        # Try to serve the requested file
        file_path = frontend_dist / request.url.path.lstrip("/")
        if file_path.is_file():
            return FileResponse(file_path)

        # For all other routes (SPA routes), serve index.html
        if not request.url.path.startswith("/assets/"):
            return FileResponse(frontend_dist / "index.html")

        return await call_next(request)
