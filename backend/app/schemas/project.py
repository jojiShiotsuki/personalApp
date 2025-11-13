from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[ProjectStatus] = None


class ProjectResponse(ProjectBase):
    id: int
    status: ProjectStatus
    progress: int
    created_at: datetime
    updated_at: datetime
    task_count: Optional[int] = None
    completed_task_count: Optional[int] = None

    class Config:
        from_attributes = True
