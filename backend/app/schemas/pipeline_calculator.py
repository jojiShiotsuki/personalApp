from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import math


class PipelineSettingsBase(BaseModel):
    """Base schema for pipeline settings."""
    monthly_revenue_goal: float = Field(10000.0, ge=0)
    average_deal_value: float = Field(2000.0, ge=0)

    # Stage conversion rates
    lead_to_qualified_rate: float = Field(30.0, ge=0, le=100)
    qualified_to_proposal_rate: float = Field(50.0, ge=0, le=100)
    proposal_to_close_rate: float = Field(40.0, ge=0, le=100)

    # Activity conversion rates
    cold_email_response_rate: float = Field(5.0, ge=0, le=100)
    linkedin_connection_rate: float = Field(25.0, ge=0, le=100)
    linkedin_to_conversation_rate: float = Field(20.0, ge=0, le=100)
    call_to_meeting_rate: float = Field(15.0, ge=0, le=100)
    loom_response_rate: float = Field(30.0, ge=0, le=100)
    loom_to_call_rate: float = Field(50.0, ge=0, le=100)


class PipelineSettingsUpdate(BaseModel):
    """Schema for updating pipeline settings."""
    monthly_revenue_goal: Optional[float] = Field(None, ge=0)
    average_deal_value: Optional[float] = Field(None, ge=0)

    lead_to_qualified_rate: Optional[float] = Field(None, ge=0, le=100)
    qualified_to_proposal_rate: Optional[float] = Field(None, ge=0, le=100)
    proposal_to_close_rate: Optional[float] = Field(None, ge=0, le=100)

    cold_email_response_rate: Optional[float] = Field(None, ge=0, le=100)
    linkedin_connection_rate: Optional[float] = Field(None, ge=0, le=100)
    linkedin_to_conversation_rate: Optional[float] = Field(None, ge=0, le=100)
    call_to_meeting_rate: Optional[float] = Field(None, ge=0, le=100)
    loom_response_rate: Optional[float] = Field(None, ge=0, le=100)
    loom_to_call_rate: Optional[float] = Field(None, ge=0, le=100)


class PipelineSettingsResponse(PipelineSettingsBase):
    """Response schema for pipeline settings."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FunnelStage(BaseModel):
    """A single stage in the funnel."""
    name: str
    count: int
    conversion_rate: float  # Rate to next stage
    description: str


class ActivityRequirement(BaseModel):
    """Required activities for a specific channel."""
    channel: str
    daily: int
    weekly: int
    monthly: int
    description: str


class PipelineCalculation(BaseModel):
    """Full pipeline calculation results."""
    # Targets
    monthly_revenue_goal: float
    deals_needed: int
    average_deal_value: float

    # Funnel stages (working backwards)
    funnel: list[FunnelStage]

    # Activity requirements by channel
    activities: list[ActivityRequirement]

    # Summary metrics
    total_leads_needed: int
    overall_conversion_rate: float  # Lead to close rate

    # Daily targets for 22 working days
    daily_outreach_target: int
    daily_cold_emails: int
    daily_linkedin: int
    daily_calls: int
    daily_looms: int


def calculate_pipeline(settings: PipelineSettingsBase) -> PipelineCalculation:
    """Calculate required activities to hit revenue goal."""

    # Step 1: Calculate deals needed (guard against division by zero)
    if settings.average_deal_value <= 0:
        deals_needed = 0
    else:
        deals_needed = math.ceil(settings.monthly_revenue_goal / settings.average_deal_value)

    # Step 2: Work backwards through funnel (guard against zero rates)
    # Proposals needed = deals / close rate
    if settings.proposal_to_close_rate <= 0:
        proposals_needed = 0
    else:
        proposals_needed = math.ceil(deals_needed / (settings.proposal_to_close_rate / 100))

    # Qualified leads needed = proposals / proposal rate
    if settings.qualified_to_proposal_rate <= 0:
        qualified_needed = 0
    else:
        qualified_needed = math.ceil(proposals_needed / (settings.qualified_to_proposal_rate / 100))

    # Total leads needed = qualified / qualification rate
    if settings.lead_to_qualified_rate <= 0:
        leads_needed = 0
    else:
        leads_needed = math.ceil(qualified_needed / (settings.lead_to_qualified_rate / 100))

    # Overall conversion rate
    overall_rate = (deals_needed / leads_needed * 100) if leads_needed > 0 else 0

    # Build funnel stages
    funnel = [
        FunnelStage(
            name="Leads",
            count=leads_needed,
            conversion_rate=settings.lead_to_qualified_rate,
            description="Initial contacts/prospects"
        ),
        FunnelStage(
            name="Qualified",
            count=qualified_needed,
            conversion_rate=settings.qualified_to_proposal_rate,
            description="Interested, fit criteria"
        ),
        FunnelStage(
            name="Proposals",
            count=proposals_needed,
            conversion_rate=settings.proposal_to_close_rate,
            description="Sent pricing/proposals"
        ),
        FunnelStage(
            name="Closed",
            count=deals_needed,
            conversion_rate=100.0,
            description="Won deals"
        ),
    ]

    # Step 3: Calculate activity requirements
    # Cold emails: leads / response rate
    if settings.cold_email_response_rate <= 0:
        cold_emails_monthly = 0
    else:
        cold_emails_monthly = math.ceil(leads_needed / (settings.cold_email_response_rate / 100))

    # LinkedIn: leads / (connection rate * conversation rate)
    linkedin_effective_rate = (settings.linkedin_connection_rate / 100) * (settings.linkedin_to_conversation_rate / 100)
    linkedin_monthly = math.ceil(leads_needed / linkedin_effective_rate) if linkedin_effective_rate > 0 else 0

    # Calls: qualified / call-to-meeting rate (for warm follow-ups)
    if settings.call_to_meeting_rate <= 0:
        calls_monthly = 0
    else:
        calls_monthly = math.ceil(qualified_needed / (settings.call_to_meeting_rate / 100))

    # Looms: for hot prospects, aim for 20% of qualified leads
    looms_target = max(1, math.ceil(qualified_needed * 0.2))
    loom_effective_rate = (settings.loom_response_rate / 100) * (settings.loom_to_call_rate / 100)
    looms_monthly = math.ceil(looms_target / loom_effective_rate) if loom_effective_rate > 0 else 0

    # Working days per month (22 typical)
    working_days = 22

    activities = [
        ActivityRequirement(
            channel="Cold Emails",
            daily=math.ceil(cold_emails_monthly / working_days),
            weekly=math.ceil(cold_emails_monthly / 4),
            monthly=cold_emails_monthly,
            description=f"At {settings.cold_email_response_rate}% response rate"
        ),
        ActivityRequirement(
            channel="LinkedIn",
            daily=math.ceil(linkedin_monthly / working_days),
            weekly=math.ceil(linkedin_monthly / 4),
            monthly=linkedin_monthly,
            description=f"At {settings.linkedin_connection_rate}% connection rate"
        ),
        ActivityRequirement(
            channel="Follow-up Calls",
            daily=math.ceil(calls_monthly / working_days),
            weekly=math.ceil(calls_monthly / 4),
            monthly=calls_monthly,
            description=f"At {settings.call_to_meeting_rate}% meeting rate"
        ),
        ActivityRequirement(
            channel="Loom Audits",
            daily=max(1, math.ceil(looms_monthly / working_days)),
            weekly=math.ceil(looms_monthly / 4),
            monthly=looms_monthly,
            description=f"At {settings.loom_response_rate}% response rate"
        ),
    ]

    # Total daily outreach
    daily_total = sum(a.daily for a in activities)

    return PipelineCalculation(
        monthly_revenue_goal=settings.monthly_revenue_goal,
        deals_needed=deals_needed,
        average_deal_value=settings.average_deal_value,
        funnel=funnel,
        activities=activities,
        total_leads_needed=leads_needed,
        overall_conversion_rate=round(overall_rate, 2),
        daily_outreach_target=daily_total,
        daily_cold_emails=activities[0].daily,
        daily_linkedin=activities[1].daily,
        daily_calls=activities[2].daily,
        daily_looms=activities[3].daily,
    )
