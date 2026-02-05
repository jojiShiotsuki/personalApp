from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime, date
from typing import Optional, List
from app.models.loom_audit import LoomResponseType


class LoomAuditBase(BaseModel):
    """Base schema for Loom audit."""
    title: str = Field(..., max_length=255)
    loom_url: str = Field(..., max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    sent_via: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class LoomAuditCreate(LoomAuditBase):
    """Schema for creating a Loom audit."""
    contact_id: int
    sent_date: Optional[date] = None  # Defaults to today


class LoomAuditUpdate(BaseModel):
    """Schema for updating a Loom audit."""
    title: Optional[str] = Field(None, max_length=255)
    loom_url: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    sent_via: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None


class LoomAuditResponse(LoomAuditBase):
    """Response schema for a Loom audit."""
    id: int
    contact_id: int
    sent_date: date
    watched: bool
    watched_date: Optional[date] = None
    watch_count: int
    response_received: bool
    response_date: Optional[date] = None
    response_type: Optional[LoomResponseType] = None
    follow_up_date: Optional[date] = None
    follow_up_sent: bool
    created_at: datetime
    updated_at: datetime

    # Computed fields
    days_since_sent: int = 0
    needs_follow_up: bool = False

    # Contact info (for display)
    contact_name: Optional[str] = None
    contact_company: Optional[str] = None

    class Config:
        from_attributes = True


class MarkWatchedRequest(BaseModel):
    """Request to mark a Loom as watched."""
    watched_date: Optional[date] = None  # Defaults to today
    watch_count: Optional[int] = None


class MarkRespondedRequest(BaseModel):
    """Request to mark a Loom as responded."""
    response_type: LoomResponseType
    response_date: Optional[date] = None  # Defaults to today
    notes: Optional[str] = None


class MarkFollowUpSentRequest(BaseModel):
    """Request to mark follow-up as sent."""
    notes: Optional[str] = None


class LoomAuditStats(BaseModel):
    """Statistics for Loom audits."""
    total_sent: int
    total_watched: int
    total_responded: int
    total_pending: int
    total_needs_follow_up: int
    watch_rate: float  # percentage
    response_rate: float  # percentage
    booked_calls: int


class LoomAuditListResponse(BaseModel):
    """Response for listing Loom audits with stats."""
    audits: List[LoomAuditResponse]
    stats: LoomAuditStats
