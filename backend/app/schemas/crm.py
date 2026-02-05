from pydantic import BaseModel, Field, EmailStr, model_validator
from datetime import datetime, date
from typing import Optional, List, Any
from decimal import Decimal
from app.models.crm import ContactStatus, DealStage, InteractionType, BillingFrequency, ServiceStatus

# Contact Schemas
class ContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=255)
    status: ContactStatus = ContactStatus.LEAD
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    # Tradie-specific fields
    industry: Optional[str] = Field(None, max_length=50)  # Trade type (roofer, plumber, etc.)
    suburb: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    website_url: Optional[str] = Field(None, max_length=500)
    website_issues: Optional[str] = None  # JSON string of issues
    website_speed_score: Optional[int] = Field(None, ge=0, le=100)
    # Outreach tracking fields
    email_stage: Optional[str] = Field(None, max_length=50)
    email_last_sent: Optional[date] = None
    linkedin_stage: Optional[str] = Field(None, max_length=50)
    linkedin_last_action: Optional[date] = None
    loom_audit_sent: Optional[bool] = False
    loom_audit_url: Optional[str] = Field(None, max_length=500)
    next_followup_date: Optional[date] = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=255)
    status: Optional[ContactStatus] = None
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    # Tradie-specific fields
    industry: Optional[str] = Field(None, max_length=50)
    suburb: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    website_url: Optional[str] = Field(None, max_length=500)
    website_issues: Optional[str] = None
    website_speed_score: Optional[int] = Field(None, ge=0, le=100)
    # Outreach tracking fields
    email_stage: Optional[str] = Field(None, max_length=50)
    email_last_sent: Optional[date] = None
    linkedin_stage: Optional[str] = Field(None, max_length=50)
    linkedin_last_action: Optional[date] = None
    loom_audit_sent: Optional[bool] = None
    loom_audit_url: Optional[str] = Field(None, max_length=500)
    next_followup_date: Optional[date] = None

class ContactResponse(ContactBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Deal Schemas
class DealBase(BaseModel):
    contact_id: int
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    value: Optional[Decimal] = None
    stage: DealStage = DealStage.LEAD
    probability: int = Field(50, ge=0, le=100)
    expected_close_date: Optional[date] = None
    actual_close_date: Optional[date] = None
    next_followup_date: Optional[date] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)  # For time tracking billing
    # Subscription fields
    is_recurring: bool = False
    billing_frequency: Optional[BillingFrequency] = None
    recurring_amount: Optional[Decimal] = None
    next_billing_date: Optional[date] = None
    service_status: Optional[ServiceStatus] = None
    service_start_date: Optional[date] = None

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    contact_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    value: Optional[Decimal] = None
    stage: Optional[DealStage] = None
    probability: Optional[int] = Field(None, ge=0, le=100)
    expected_close_date: Optional[date] = None
    actual_close_date: Optional[date] = None
    next_followup_date: Optional[date] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)  # For time tracking billing
    # Subscription fields
    is_recurring: Optional[bool] = None
    billing_frequency: Optional[BillingFrequency] = None
    recurring_amount: Optional[Decimal] = None
    next_billing_date: Optional[date] = None
    service_status: Optional[ServiceStatus] = None
    service_start_date: Optional[date] = None

class DealResponse(DealBase):
    id: int
    created_at: datetime
    updated_at: datetime
    contact: Optional[ContactResponse] = None
    followup_count: int = 0

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def populate_contact(cls, data: Any) -> Any:
        # If data is a SQLAlchemy model instance
        if hasattr(data, '__dict__'):
            # Check if it has a contact relationship loaded
            if hasattr(data, 'contact') and data.contact is not None:
                # Convert to dict and add contact
                result = {
                    'id': data.id,
                    'contact_id': data.contact_id,
                    'title': data.title,
                    'description': data.description,
                    'value': data.value,
                    'stage': data.stage,
                    'probability': data.probability,
                    'expected_close_date': data.expected_close_date,
                    'actual_close_date': data.actual_close_date,
                    'next_followup_date': data.next_followup_date,
                    'hourly_rate': data.hourly_rate,
                    # Subscription fields
                    'is_recurring': data.is_recurring,
                    'billing_frequency': data.billing_frequency,
                    'recurring_amount': data.recurring_amount,
                    'next_billing_date': data.next_billing_date,
                    'service_status': data.service_status,
                    'service_start_date': data.service_start_date,
                    'created_at': data.created_at,
                    'updated_at': data.updated_at,
                    'contact': ContactResponse.model_validate(data.contact),
                    'followup_count': getattr(data, 'followup_count', 0)
                }
                return result
        return data

# Interaction Schemas
class InteractionBase(BaseModel):
    contact_id: int
    type: InteractionType
    subject: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    interaction_date: datetime

class InteractionCreate(InteractionBase):
    pass

class InteractionUpdate(BaseModel):
    contact_id: Optional[int] = None
    type: Optional[InteractionType] = None
    subject: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    interaction_date: Optional[datetime] = None

class InteractionResponse(InteractionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
