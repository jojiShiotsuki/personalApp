"""
Pydantic schemas for the Cold Calls pipeline (CallProspect).
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class CallStatus(str, Enum):
    NEW = "NEW"
    ATTEMPTED = "ATTEMPTED"
    CONNECTED = "CONNECTED"
    DEAD = "DEAD"


class CallProspectBase(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    vertical: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    facebook_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class CallProspectCreate(CallProspectBase):
    status: CallStatus = CallStatus.NEW


class CallProspectUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    vertical: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    facebook_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    status: Optional[CallStatus] = None


class CallProspectResponse(CallProspectBase):
    id: int
    status: CallStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# CSV Import Schemas
class CallProspectCsvColumnMapping(BaseModel):
    business_name: str
    phone: Optional[str] = None
    vertical: Optional[str] = None
    address: Optional[str] = None


class CallProspectCsvImportRequest(BaseModel):
    column_mapping: CallProspectCsvColumnMapping
    data: List[dict]


class CallProspectCsvImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    errors: List[str]
