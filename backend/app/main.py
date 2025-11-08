import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routes import tasks, crm, task_parser, export

app = FastAPI(
    title="Personal Productivity App",
    description="Task management and CRM system with AI assistant",
    version="1.0.0"
)

# CORS configuration - supports both development and production
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(tasks.router)
app.include_router(crm.router)
app.include_router(task_parser.router)
app.include_router(export.router)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()

@app.get("/")
async def root():
    return {"message": "Personal Productivity App API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
