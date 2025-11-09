from pydantic import BaseModel, Field
from datetime import datetime, date, time
from typing import Optional, List
from app.models.task import TaskPriority, TaskStatus

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None

class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TaskParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)

class TaskBulkParseRequest(BaseModel):
    lines: List[str]

    class Config:
        json_schema_extra = {
            "example": {
                "lines": [
                    "- Meeting tomorrow at 3pm",
                    "Call John high priority",
                    "Review proposal Friday"
                ]
            }
        }
