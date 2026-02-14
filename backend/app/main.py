import os
from dotenv import load_dotenv

load_dotenv()

from pathlib import Path
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from app.database import init_db
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects, project_templates, social_content, dashboard, time, outreach, cold_outreach, lead_discovery, daily_outreach, sprint, loom_audit, pipeline_calculator, discovery_call, search_planner

app = FastAPI(
    title="Personal Productivity App",
    description="Task management and CRM system with AI assistant",
    version="1.0.1"  # Sprint serialization fix
)

# CORS configuration - supports both development and production
# In development, allow all localhost origins. In production, use specific origins.
if os.getenv("ENVIRONMENT", "development") == "production":
    raw_origins = os.getenv("CORS_ORIGINS", "")
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    # Ensure the Render frontend is always allowed
    render_frontend = "https://vertex-frontend-h5qj.onrender.com"
    if render_frontend not in allowed_origins:
        allowed_origins.append(render_frontend)
    allow_credentials = True
else:
    # Development: allow all origins (credentials must be False with "*")
    allowed_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
# IMPORTANT: task_parser and goal_parser must come BEFORE tasks/goals to match
# /parse and /parse-bulk before the generic /{id} route
app.include_router(task_parser.router)
app.include_router(goal_parser.router)
app.include_router(tasks.router)
app.include_router(crm.router)
app.include_router(export.router)
app.include_router(goals.router)
app.include_router(projects.router)
app.include_router(project_templates.router)
app.include_router(social_content.router)
app.include_router(dashboard.router)
app.include_router(time.router)
app.include_router(outreach.router)
app.include_router(cold_outreach.router)
app.include_router(lead_discovery.router)
app.include_router(daily_outreach.router)
app.include_router(sprint.router)
app.include_router(loom_audit.router)
app.include_router(pipeline_calculator.router)
app.include_router(discovery_call.router)
app.include_router(search_planner.router)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions so CORS headers are still applied."""
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

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
