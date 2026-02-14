from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.task import TaskPriority


class TemplateTaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    priority: TaskPriority = TaskPriority.MEDIUM
    order: int = 0
    phase: Optional[str] = None


class TemplateTaskCreate(TemplateTaskBase):
    pass


class TemplateTaskResponse(TemplateTaskBase):
    id: int

    class Config:
        from_attributes = True


class ProjectTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    tasks: List[TemplateTaskCreate] = []


class ProjectTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    tasks: List[TemplateTaskResponse] = []

    class Config:
        from_attributes = True
