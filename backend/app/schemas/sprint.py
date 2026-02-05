from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from app.models.sprint import SprintStatus
from app.schemas.daily_outreach import DailyOutreachStatsResponse
from app.schemas.task import TaskResponse


class SprintDayTask(BaseModel):
    """A single task within a sprint day (legacy, kept for backwards compatibility)."""
    title: str
    completed: bool = False


class SprintDayBase(BaseModel):
    """Base sprint day schema."""
    day_number: int
    week_number: int
    log_date: date
    is_complete: bool = False
    notes: Optional[str] = None


class SprintDayResponse(SprintDayBase):
    """Response schema for a sprint day."""
    id: int
    sprint_id: int
    tasks: List[TaskResponse] = []  # Real Task entities
    outreach_log_id: Optional[int] = None
    outreach_stats: Optional[DailyOutreachStatsResponse] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SprintWeekSummary(BaseModel):
    """Summary of a week within the sprint."""
    week_number: int
    theme: str
    days_completed: int
    total_days: int = 7
    is_current_week: bool = False


class SprintBase(BaseModel):
    """Base sprint schema."""
    title: str = "30-Day Client Acquisition Sprint"
    description: Optional[str] = None


class SprintCreate(SprintBase):
    """Schema for creating a new sprint."""
    start_date: Optional[date] = None  # Defaults to today if not provided


class SprintResponse(SprintBase):
    """Response schema for a sprint."""
    id: int
    start_date: date
    end_date: date
    status: SprintStatus
    current_day: int
    current_week: int
    progress_percentage: float
    weeks: List[SprintWeekSummary] = []
    today: Optional[SprintDayResponse] = None
    days: List[SprintDayResponse] = []  # All 30 days
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SprintListResponse(BaseModel):
    """Response schema for sprint list."""
    id: int
    title: str
    start_date: date
    end_date: date
    status: SprintStatus
    progress_percentage: float
    created_at: datetime

    class Config:
        from_attributes = True


class ToggleTaskResponse(BaseModel):
    """Response after toggling a task."""
    day: SprintDayResponse
    task_index: int
    completed: bool
    message: str


class UpdateNotesRequest(BaseModel):
    """Request to update day notes."""
    notes: str = Field(..., max_length=2000)


class UpdateNotesResponse(BaseModel):
    """Response after updating notes."""
    day_number: int
    notes: str
    message: str


class SprintUpdate(BaseModel):
    """Schema for updating a sprint."""
    title: Optional[str] = None
    description: Optional[str] = None
