from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    hourly_rate: Optional[Decimal] = Field(None, ge=0)  # For time tracking billing
    deadline: Optional[date] = None
    contact_id: Optional[int] = None
    service_type: Optional[str] = None


class ProjectCreate(ProjectBase):
    template_id: Optional[int] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[ProjectStatus] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)  # For time tracking billing
    deadline: Optional[date] = None
    contact_id: Optional[int] = None
    service_type: Optional[str] = None
    notes: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: int
    status: ProjectStatus
    progress: int = 0
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    task_count: Optional[int] = None
    completed_task_count: Optional[int] = None
    contact_name: Optional[str] = None

    @field_validator('progress', mode='before')
    @classmethod
    def coerce_progress(cls, v):
        return v if v is not None else 0

    class Config:
        from_attributes = True
