from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.goal import Quarter, Month, GoalPriority

class KeyResult(BaseModel):
    """Individual key result/milestone"""
    id: str
    title: str
    completed: bool = False

class GoalBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    quarter: Quarter
    month: Month
    year: int
    target_date: Optional[str] = None
    progress: float = Field(default=0.0, ge=0, le=100)
    priority: GoalPriority = GoalPriority.MEDIUM
    key_results: Optional[List[KeyResult]] = None

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    quarter: Optional[Quarter] = None
    month: Optional[Month] = None
    year: Optional[int] = None
    target_date: Optional[str] = None
    progress: Optional[float] = Field(None, ge=0, le=100)
    priority: Optional[GoalPriority] = None
    key_results: Optional[List[KeyResult]] = None

class GoalResponse(GoalBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
