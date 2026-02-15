from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from enum import Enum


# Niche Schemas
class NicheBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class NicheCreate(NicheBase):
    pass


class NicheResponse(NicheBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Situation Schemas
class SituationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class SituationCreate(SituationBase):
    pass


class SituationResponse(SituationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Valid template types
VALID_TEMPLATE_TYPES = [
    'email_1', 'email_2', 'email_3', 'email_4', 'email_5',
    'linkedin_direct', 'linkedin_compliment', 'linkedin_mutual_interest',
    'linkedin_followup_1', 'linkedin_followup_2',
    'loom_video_audit',
    'agency_email', 'agency_linkedin',
]


# Template Schemas
class TemplateBase(BaseModel):
    niche_id: Optional[int] = None
    situation_id: Optional[int] = None
    template_type: str = Field(default='email_1')
    subject: Optional[str] = Field(None, max_length=500)  # Email subject line (for email template types)
    content: str = Field(..., min_length=1)


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    subject: Optional[str] = Field(None, max_length=500)
    content: str = Field(..., min_length=1)


class TemplateResponse(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    niche: Optional[NicheResponse] = None
    situation: Optional[SituationResponse] = None

    class Config:
        from_attributes = True


# Add to Pipeline Schema
class AddToPipelineRequest(BaseModel):
    name: str = Field(..., min_length=1)
    niche: str
    situation: str


class AddToPipelineResponse(BaseModel):
    contact_id: int
    deal_id: int
    message: str


# Enums for Cold Outreach schemas
class ProspectStatus(str, Enum):
    QUEUED = "QUEUED"
    IN_SEQUENCE = "IN_SEQUENCE"
    REPLIED = "REPLIED"
    NOT_INTERESTED = "NOT_INTERESTED"
    CONVERTED = "CONVERTED"
    SKIPPED = "SKIPPED"
    # LinkedIn-specific statuses
    PENDING_CONNECTION = "PENDING_CONNECTION"
    CONNECTED = "CONNECTED"


class ResponseType(str, Enum):
    INTERESTED = "INTERESTED"
    NOT_INTERESTED = "NOT_INTERESTED"
    OTHER = "OTHER"


class CampaignStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class CampaignType(str, Enum):
    EMAIL = "EMAIL"
    LINKEDIN = "LINKEDIN"


# Campaign Schemas
class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    campaign_type: CampaignType = CampaignType.EMAIL
    step_1_delay: int = Field(default=0, ge=0)
    step_2_delay: int = Field(default=3, ge=0)
    step_3_delay: int = Field(default=5, ge=0)
    step_4_delay: int = Field(default=7, ge=0)
    step_5_delay: int = Field(default=7, ge=0)


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[CampaignStatus] = None
    campaign_type: Optional[CampaignType] = None
    step_1_delay: Optional[int] = Field(None, ge=0)
    step_2_delay: Optional[int] = Field(None, ge=0)
    step_3_delay: Optional[int] = Field(None, ge=0)
    step_4_delay: Optional[int] = Field(None, ge=0)
    step_5_delay: Optional[int] = Field(None, ge=0)


class CampaignResponse(CampaignBase):
    id: int
    status: CampaignStatus
    campaign_type: CampaignType
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CampaignStats(BaseModel):
    total_prospects: int
    queued: int
    in_sequence: int
    replied: int
    not_interested: int
    converted: int
    to_contact_today: int
    response_rate: float
    total_pipeline_value: float
    skipped: int = 0
    # LinkedIn-specific stats
    pending_connection: int = 0
    connected: int = 0


class CampaignWithStats(CampaignResponse):
    stats: CampaignStats


# Prospect Schemas
class ProspectBase(BaseModel):
    agency_name: str = Field(..., min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    niche: Optional[str] = Field(None, max_length=500)
    custom_fields: Optional[dict] = None


class ProspectCreate(ProspectBase):
    linkedin_url: Optional[str] = Field(None, max_length=500)


class ProspectUpdate(BaseModel):
    agency_name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, min_length=1, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    niche: Optional[str] = Field(None, max_length=500)
    custom_fields: Optional[dict] = None
    status: Optional[ProspectStatus] = None
    current_step: Optional[int] = Field(None, ge=1, le=5)
    next_action_date: Optional[date] = None
    notes: Optional[str] = None
    linkedin_url: Optional[str] = Field(None, max_length=500)
    facebook_url: Optional[str] = Field(None, max_length=500)
    instagram_url: Optional[str] = Field(None, max_length=500)


class ProspectResponse(ProspectBase):
    id: int
    campaign_id: int
    status: ProspectStatus
    current_step: int
    next_action_date: Optional[date]
    last_contacted_at: Optional[datetime]
    response_type: Optional[ResponseType]
    notes: Optional[str]
    discovered_lead_id: Optional[int] = None
    converted_contact_id: Optional[int] = None
    converted_deal_id: Optional[int] = None
    website_issues: Optional[list] = None
    linkedin_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# CSV Import Schema
class CsvColumnMapping(BaseModel):
    agency_name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    niche: Optional[str] = None
    linkedin_url: Optional[str] = None


class CsvImportRequest(BaseModel):
    column_mapping: CsvColumnMapping
    data: List[dict]


class CsvImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    errors: List[str]


# Mark Sent Schema
class MarkSentResponse(BaseModel):
    prospect: ProspectResponse
    next_action_date: Optional[date]
    message: str


# Mark Replied Schema
class MarkRepliedRequest(BaseModel):
    response_type: ResponseType
    notes: Optional[str] = None


class MarkRepliedResponse(BaseModel):
    prospect: ProspectResponse
    contact_id: Optional[int] = None
    deal_id: Optional[int] = None
    message: str


# Email Template Schemas
class EmailTemplateBase(BaseModel):
    step_number: int = Field(..., ge=1, le=5)
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1)


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=500)
    body: Optional[str] = Field(None, min_length=1)


class EmailTemplateResponse(EmailTemplateBase):
    id: int
    campaign_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Rendered Email Schema
class RenderedEmail(BaseModel):
    to_email: str
    subject: str
    body: str
    prospect_id: int
    step_number: int
