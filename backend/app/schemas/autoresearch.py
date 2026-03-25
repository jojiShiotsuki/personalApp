from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ──────────────────────────────────────────────
# Audit Schemas
# ──────────────────────────────────────────────

class AuditResultResponse(BaseModel):
    id: int
    prospect_id: int
    campaign_id: int

    # Primary issue
    issue_type: Optional[str] = None
    issue_detail: Optional[str] = None

    # Secondary issue
    secondary_issue: Optional[str] = None
    secondary_detail: Optional[str] = None

    # Quality assessment
    confidence: Optional[str] = "medium"
    site_quality: Optional[str] = "medium"
    needs_verification: bool = False
    pass_2_completed: bool = False

    # Generated email content
    generated_subject: Optional[str] = None
    generated_subject_variant: Optional[str] = None
    generated_body: Optional[str] = None
    word_count: Optional[int] = None

    # Screenshots
    desktop_screenshot: Optional[str] = None
    mobile_screenshot: Optional[str] = None
    verification_screenshots: Optional[dict] = None

    # Review status
    status: Optional[str] = "pending_review"
    rejection_reason: Optional[str] = None

    # Edit tracking
    was_edited: bool = False
    edited_subject: Optional[str] = None
    edited_body: Optional[str] = None

    # Cost tracking
    audit_duration_seconds: Optional[float] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    ai_cost_estimate: Optional[float] = None

    created_at: datetime

    # Joined prospect info
    prospect_name: Optional[str] = None
    prospect_company: Optional[str] = None
    prospect_niche: Optional[str] = None
    prospect_city: Optional[str] = None
    prospect_email: Optional[str] = None
    prospect_website: Optional[str] = None

    class Config:
        from_attributes = True


class AuditApproveRequest(BaseModel):
    edited_subject: Optional[str] = None
    edited_body: Optional[str] = None
    subject_variant_used: Optional[str] = None  # "original" or "variant"


class AuditRegenerateRequest(BaseModel):
    instruction: str = Field(..., min_length=3, max_length=500)


class AuditRejectRequest(BaseModel):
    rejection_reason: str
    rejection_category: Optional[str] = None  # carousel_false_positive, slow_load_false_positive, not_target_audience, issue_not_real, email_too_long, other


class BatchAuditResponse(BaseModel):
    batch_id: str
    total: int
    message: str


class BatchProgressResponse(BaseModel):
    batch_id: str
    completed: int
    total: int
    errors: int
    current_prospect: Optional[str] = None
    is_complete: bool
    is_cancelled: bool


# ──────────────────────────────────────────────
# Experiment Schemas
# ──────────────────────────────────────────────

class ExperimentResponse(BaseModel):
    id: int
    prospect_id: int
    campaign_id: int
    audit_id: int

    # Experiment status
    status: Optional[str] = "draft"

    # Denormalized audit data
    issue_type: Optional[str] = None
    issue_detail: Optional[str] = None
    secondary_issue: Optional[str] = None
    secondary_detail: Optional[str] = None
    confidence: Optional[str] = None
    site_quality: Optional[str] = None
    pass_2_triggered: bool = False

    # Email data
    subject: Optional[str] = None
    body: Optional[str] = None
    word_count: Optional[int] = None
    was_edited: bool = False
    edit_type: Optional[str] = None
    subject_variant_used: Optional[str] = None  # "original" or "variant"

    # Prospect context
    niche: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    company: Optional[str] = None

    # Send data
    sent_at: Optional[datetime] = None
    day_of_week: Optional[str] = None
    step_number: int = 1

    # Outcome tracking
    replied: bool = False
    reply_at: Optional[datetime] = None
    response_time_minutes: Optional[int] = None
    sentiment: Optional[str] = None
    category: Optional[str] = None
    forwarded_internally: Optional[bool] = None
    full_reply_text: Optional[str] = None

    # Conversion tracking
    converted_to_call: bool = False
    converted_to_client: bool = False
    deal_id: Optional[int] = None
    deal_value: Optional[float] = None

    # Loom tracking
    loom_sent: bool = False
    loom_url: Optional[str] = None
    loom_watched: Optional[bool] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExperimentListResponse(BaseModel):
    experiments: List[ExperimentResponse]
    total_count: int
    page: int
    page_size: int


# ──────────────────────────────────────────────
# Analytics Schemas
# ──────────────────────────────────────────────

class IssueTypeStats(BaseModel):
    issue_type: str
    sent: int
    replied: int
    reply_rate: float
    confidence: str


class NicheStats(BaseModel):
    niche: str
    sent: int
    replied: int
    reply_rate: float
    best_issue_type: Optional[str] = None


class TimingStats(BaseModel):
    day_of_week: str
    sent: int
    replied: int
    reply_rate: float


class AnalyticsOverview(BaseModel):
    total_experiments: int
    total_sent: int
    total_replied: int
    overall_reply_rate: float
    best_issue_type: Optional[str] = None
    best_niche: Optional[str] = None
    avg_response_time_minutes: Optional[float] = None
    total_ai_cost: float


# ──────────────────────────────────────────────
# Insight Schemas
# ──────────────────────────────────────────────

class InsightResponse(BaseModel):
    id: int
    insight: str
    confidence: str
    sample_size: int
    recommendation: Optional[str] = None
    applies_to: Optional[str] = "all_niches"
    is_active: bool = True
    experiment_count_at_refresh: Optional[int] = None
    created_at: datetime
    superseded_by: Optional[int] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Gmail Schemas
# ──────────────────────────────────────────────

class GmailAuthUrlResponse(BaseModel):
    auth_url: str


class GmailStatusResponse(BaseModel):
    is_connected: bool
    email_address: Optional[str] = None
    last_poll_at: Optional[datetime] = None
    is_active: bool


class EmailMatchResponse(BaseModel):
    id: int
    prospect_id: int
    experiment_id: Optional[int] = None

    # Gmail data
    gmail_message_id: str
    direction: str
    from_email: str
    to_email: str
    subject: Optional[str] = None
    body_text: Optional[str] = None
    received_at: datetime

    # Classification
    sentiment: Optional[str] = None
    category: Optional[str] = None
    wants_loom: Optional[bool] = None
    wants_call: Optional[bool] = None
    forwarded_internally: Optional[bool] = None
    key_quote: Optional[str] = None
    suggested_action: Optional[str] = None
    classification_cost: Optional[float] = None

    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Settings Schemas
# ──────────────────────────────────────────────

class AutoresearchSettingsResponse(BaseModel):
    id: int
    user_id: int

    # Prompts
    audit_prompt: Optional[str] = None

    # Model selection
    audit_model: Optional[str] = "claude-sonnet-4-6"
    classifier_model: Optional[str] = "claude-haiku-4-5"
    learning_model: Optional[str] = "claude-sonnet-4-6"

    # Audit behavior
    min_page_load_wait: Optional[int] = 3
    enable_pass_2: Optional[bool] = True
    max_batch_size: Optional[int] = 50

    created_at: datetime
    updated_at: datetime

    # Computed / joined fields
    gmail_connected: bool = False
    gmail_email: Optional[str] = None
    monthly_cost: float = 0.0
    total_audits: int = 0

    class Config:
        from_attributes = True


class AutoresearchSettingsUpdate(BaseModel):
    audit_prompt: Optional[str] = None
    audit_model: Optional[str] = None
    classifier_model: Optional[str] = None
    learning_model: Optional[str] = None
    min_page_load_wait: Optional[int] = None
    enable_pass_2: Optional[bool] = None
    max_batch_size: Optional[int] = None


# ──────────────────────────────────────────────
# Email Open Tracking Schemas
# ──────────────────────────────────────────────

class EmailOpenResponse(BaseModel):
    id: int
    tracking_id: str
    prospect_id: int
    experiment_id: Optional[int] = None
    opened_at: Optional[datetime] = None
    open_count: int = 0
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TrackingPixelResponse(BaseModel):
    tracking_id: str
    pixel_url: str
    img_tag: str


# ──────────────────────────────────────────────
# Loom Tracking Schemas
# ──────────────────────────────────────────────

class LoomStatusUpdate(BaseModel):
    loom_sent: Optional[bool] = None
    loom_url: Optional[str] = None
    loom_watched: Optional[bool] = None
