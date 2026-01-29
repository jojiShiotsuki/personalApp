from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
from app.models.social_content import ContentType, ContentStatus, EditingStyle, RepurposeFormat, ReelType


class RepurposeFormatStatus(BaseModel):
    """Status tracking for a single repurpose format"""
    format: RepurposeFormat
    status: ContentStatus = ContentStatus.NOT_STARTED
    posted_date: Optional[date] = None


class SocialContentBase(BaseModel):
    content_date: date
    content_type: ContentType
    status: ContentStatus = ContentStatus.NOT_STARTED
    title: Optional[str] = None
    script: Optional[str] = None
    reel_type: Optional[ReelType] = None
    editing_style: Optional[EditingStyle] = None
    editing_notes: Optional[str] = None
    platforms: Optional[List[str]] = None
    hashtags: Optional[str] = None
    music_audio: Optional[str] = None
    thumbnail_reference: Optional[str] = None
    notes: Optional[str] = None
    project_id: Optional[int] = None
    repurpose_formats: Optional[List[dict]] = None  # JSON from database


class SocialContentCreate(SocialContentBase):
    pass


class SocialContentUpdate(BaseModel):
    content_date: Optional[date] = None
    content_type: Optional[ContentType] = None
    status: Optional[ContentStatus] = None
    title: Optional[str] = None
    script: Optional[str] = None
    reel_type: Optional[ReelType] = None
    editing_style: Optional[EditingStyle] = None
    editing_notes: Optional[str] = None
    platforms: Optional[List[str]] = None
    hashtags: Optional[str] = None
    music_audio: Optional[str] = None
    thumbnail_reference: Optional[str] = None
    notes: Optional[str] = None
    project_id: Optional[int] = None
    repurpose_formats: Optional[List[RepurposeFormatStatus]] = None


class SocialContent(SocialContentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {
        'from_attributes': True
    }


class CalendarSummary(BaseModel):
    """Summary statistics for a month"""
    year: int
    month: int
    total_content: int
    by_status: dict  # {status: count}
    by_type: dict    # {content_type: count}


class MonthSummary(BaseModel):
    """Summary for year view showing all months"""
    month: int
    total_content: int
    by_status: dict
    by_type: dict
