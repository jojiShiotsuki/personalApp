from pydantic import BaseModel, Field, model_validator, field_serializer
from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal
from enum import Enum


def serialize_datetime_utc(dt: datetime | None) -> str | None:
    """Serialize datetime as ISO format with Z suffix for UTC."""
    if dt is None:
        return None
    # Ensure timezone aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Format with Z suffix for UTC
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


class TimeEntryCategory(str, Enum):
    DEVELOPMENT = "development"
    DESIGN = "design"
    MEETING = "meeting"
    COMMUNICATION = "communication"
    RESEARCH = "research"
    ADMIN = "admin"
    SUPPORT = "support"
    OTHER = "other"


class TimeEntryBase(BaseModel):
    description: Optional[str] = None
    task_id: Optional[int] = None
    project_id: Optional[int] = None
    deal_id: Optional[int] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)
    is_billable: bool = True
    category: Optional[TimeEntryCategory] = None


class TimeEntryStart(TimeEntryBase):
    """Request to start a new timer"""
    pass


class TimeEntryCreate(TimeEntryBase):
    """Request to create a manual time entry"""
    start_time: datetime
    end_time: datetime
    duration_seconds: Optional[int] = Field(None, ge=0)  # If not provided, calculated from start/end

    @model_validator(mode='after')
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError('end_time must be after start_time')
        return self


class TimeEntryUpdate(BaseModel):
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    task_id: Optional[int] = None
    project_id: Optional[int] = None
    deal_id: Optional[int] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)
    is_billable: Optional[bool] = None
    category: Optional[TimeEntryCategory] = None


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

    @field_serializer('start_time', 'end_time', 'created_at', 'updated_at')
    def serialize_dt(self, dt: datetime | None) -> str | None:
        return serialize_datetime_utc(dt)


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
