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
    rating: Optional[float] = Field(None, ge=0, le=5)
    reviews_count: Optional[int] = Field(None, ge=0)
    google_maps_url: Optional[str] = Field(None, max_length=1000)
    working_hours: Optional[str] = Field(None, max_length=1000)
    description: Optional[str] = None
    notes: Optional[str] = None
    campaign_id: Optional[int] = None


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
    rating: Optional[float] = Field(None, ge=0, le=5)
    reviews_count: Optional[int] = Field(None, ge=0)
    google_maps_url: Optional[str] = Field(None, max_length=1000)
    working_hours: Optional[str] = Field(None, max_length=1000)
    description: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[CallStatus] = None
    campaign_id: Optional[int] = None


class CallProspectResponse(CallProspectBase):
    id: int
    status: CallStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# CSV Import Schemas
class CallProspectCsvColumnMapping(BaseModel):
    """
    Mapping of CallProspect field → CSV column header.

    business_name and phone are required — the frontend enforces that both
    are mapped before the Import button is enabled. Every other direct
    mapping is optional.

    notes_append_columns is the list of CSV column headers whose values
    should be concatenated into the notes field as "ColumnName: value"
    pairs joined with " | ". If notes (direct) is also set, the direct
    notes value comes first, then the append columns follow.
    """
    business_name: str
    phone: str
    vertical: Optional[str] = None
    address: Optional[str] = None
    facebook_url: Optional[str] = None
    website: Optional[str] = None
    source: Optional[str] = None
    rating: Optional[str] = None
    reviews_count: Optional[str] = None
    google_maps_url: Optional[str] = None
    working_hours: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    notes_append_columns: List[str] = Field(default_factory=list)


class CallProspectCsvImportRequest(BaseModel):
    column_mapping: CallProspectCsvColumnMapping
    data: List[dict]


class CallProspectCsvImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    errors: List[str]
