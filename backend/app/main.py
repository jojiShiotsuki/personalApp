import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import init_db
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects, ai

app = FastAPI(
    title="Personal Productivity App",
    description="Task management and CRM system with AI assistant",
    version="1.0.0"
)

# CORS configuration - supports both development and production
# In development, allow all localhost origins. In production, use specific origins.
if os.getenv("ENVIRONMENT", "development") == "production":
    allowed_origins = os.getenv("CORS_ORIGINS", "").split(",")
else:
    # Development: allow all localhost origins
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
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
app.include_router(ai.router)

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
