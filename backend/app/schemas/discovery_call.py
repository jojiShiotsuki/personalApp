from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from app.models.discovery_call import CallOutcome


class DiscoveryCallBase(BaseModel):
    """Base schema for discovery call."""
    call_date: date = Field(default_factory=date.today)
    call_duration_minutes: Optional[int] = Field(None, ge=1, le=480)
    attendees: Optional[str] = Field(None, max_length=500)

    # SPIN Framework
    situation: Optional[str] = None
    situation_questions: Optional[str] = None
    problem: Optional[str] = None
    problem_questions: Optional[str] = None
    implication: Optional[str] = None
    implication_questions: Optional[str] = None
    need_payoff: Optional[str] = None
    need_payoff_questions: Optional[str] = None

    # Additional fields
    objections: Optional[str] = None
    next_steps: Optional[str] = None
    budget_discussed: bool = False
    budget_range: Optional[str] = Field(None, max_length=100)
    timeline_discussed: bool = False
    timeline: Optional[str] = Field(None, max_length=100)
    decision_maker_present: bool = False

    # Outcome
    outcome: Optional[CallOutcome] = None
    follow_up_date: Optional[date] = None


class DiscoveryCallCreate(DiscoveryCallBase):
    """Schema for creating a discovery call."""
    contact_id: int
    deal_id: Optional[int] = None


class DiscoveryCallUpdate(BaseModel):
    """Schema for updating a discovery call."""
    call_date: Optional[date] = None
    call_duration_minutes: Optional[int] = Field(None, ge=1, le=480)
    attendees: Optional[str] = Field(None, max_length=500)

    # SPIN Framework
    situation: Optional[str] = None
    situation_questions: Optional[str] = None
    problem: Optional[str] = None
    problem_questions: Optional[str] = None
    implication: Optional[str] = None
    implication_questions: Optional[str] = None
    need_payoff: Optional[str] = None
    need_payoff_questions: Optional[str] = None

    # Additional fields
    objections: Optional[str] = None
    next_steps: Optional[str] = None
    budget_discussed: Optional[bool] = None
    budget_range: Optional[str] = Field(None, max_length=100)
    timeline_discussed: Optional[bool] = None
    timeline: Optional[str] = Field(None, max_length=100)
    decision_maker_present: Optional[bool] = None

    # Outcome
    outcome: Optional[CallOutcome] = None
    follow_up_date: Optional[date] = None
    deal_id: Optional[int] = None


class DiscoveryCallResponse(DiscoveryCallBase):
    """Response schema for a discovery call."""
    id: int
    contact_id: int
    deal_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    spin_completion: int = 0

    # Contact info (for display)
    contact_name: Optional[str] = None
    contact_company: Optional[str] = None

    # Deal info (for display)
    deal_title: Optional[str] = None

    class Config:
        from_attributes = True


class DiscoveryCallStats(BaseModel):
    """Statistics for discovery calls."""
    total_calls: int
    calls_this_month: int
    avg_spin_completion: float
    outcome_breakdown: dict  # {outcome: count}
    avg_duration_minutes: Optional[float] = None
    follow_ups_scheduled: int
    proposals_sent: int
    deals_closed: int


class DiscoveryCallListResponse(BaseModel):
    """Response for listing discovery calls with stats."""
    calls: List[DiscoveryCallResponse]
    stats: DiscoveryCallStats
