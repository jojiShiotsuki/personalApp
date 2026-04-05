from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.nurture import NurtureStatus, FollowupStage, NURTURE_STEPS


class NurtureStepLogResponse(BaseModel):
    id: int
    step_number: int
    step_name: str = ""
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NurtureLeadResponse(BaseModel):
    id: int
    prospect_id: int
    contact_id: Optional[int] = None
    deal_id: Optional[int] = None
    campaign_id: int
    source_channel: Optional[str] = None
    current_step: int
    current_step_name: str = ""
    status: NurtureStatus
    quiet_since: Optional[datetime] = None
    last_action_at: datetime
    next_followup_at: Optional[datetime] = None
    followup_stage: Optional[FollowupStage] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Joined fields
    prospect_name: Optional[str] = None
    prospect_contact_name: Optional[str] = None
    prospect_email: Optional[str] = None
    prospect_website: Optional[str] = None
    prospect_niche: Optional[str] = None
    prospect_linkedin_url: Optional[str] = None
    prospect_facebook_url: Optional[str] = None
    prospect_instagram_url: Optional[str] = None
    prospect_linkedin_connected: bool = False
    campaign_name: Optional[str] = None
    contact_name: Optional[str] = None
    step_logs: List[NurtureStepLogResponse] = []

    class Config:
        from_attributes = True


class NurtureLeadCreate(BaseModel):
    source_channel: Optional[str] = None
    notes: Optional[str] = None


class NurtureLeadManualCreate(BaseModel):
    company_name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    niche: Optional[str] = None
    source_channel: Optional[str] = "EMAIL"
    notes: Optional[str] = None


class NurtureLeadUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[NurtureStatus] = None
    current_step: Optional[int] = None
    source_channel: Optional[str] = None


class CompleteStepRequest(BaseModel):
    notes: Optional[str] = None


class LogFollowupRequest(BaseModel):
    notes: Optional[str] = None


class ConvertRequest(BaseModel):
    deal_title: Optional[str] = None
    deal_value: Optional[float] = None
    deal_stage: Optional[str] = None


class MarkLostRequest(BaseModel):
    notes: Optional[str] = None


class NurtureStatsResponse(BaseModel):
    active: int
    needs_followup: int
    long_term: int
    converted: int
