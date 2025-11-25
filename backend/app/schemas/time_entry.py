from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from decimal import Decimal


class TimeEntryBase(BaseModel):
    description: Optional[str] = None
    task_id: Optional[int] = None
    project_id: Optional[int] = None
    deal_id: Optional[int] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)


class TimeEntryStart(TimeEntryBase):
    """Request to start a new timer"""
    pass


class TimeEntryCreate(TimeEntryBase):
    """Request to create a manual time entry"""
    start_time: datetime
    end_time: datetime
    duration_seconds: Optional[int] = None  # If not provided, calculated from start/end


class TimeEntryUpdate(BaseModel):
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    task_id: Optional[int] = None
    project_id: Optional[int] = None
    deal_id: Optional[int] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)


class TimeEntryResponse(TimeEntryBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    is_running: bool = False
    is_paused: bool = False
    paused_duration_seconds: int = 0
    created_at: datetime
    updated_at: datetime

    # Computed field for billable amount
    billable_amount: Optional[float] = None

    # Related entity names (for display)
    task_title: Optional[str] = None
    project_name: Optional[str] = None
    deal_title: Optional[str] = None

    class Config:
        from_attributes = True


class TimeSummary(BaseModel):
    """Summary of time entries for a period"""
    total_seconds: int = 0
    total_hours: float = 0.0
    total_billable: float = 0.0
    entry_count: int = 0


class TimeSummaryResponse(BaseModel):
    """Response with time summaries for multiple periods"""
    today: TimeSummary
    this_week: TimeSummary
    this_month: TimeSummary
