from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from app.models.crm import ContactStatus, DealStage, InteractionType

# Contact Schemas
class ContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=255)
    status: ContactStatus = ContactStatus.LEAD
    notes: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=255)
    status: Optional[ContactStatus] = None
    notes: Optional[str] = None

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

class DealResponse(DealBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

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
