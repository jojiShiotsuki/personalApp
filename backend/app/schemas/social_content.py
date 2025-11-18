from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
from app.models.social_content import ContentType, ContentStatus, EditingStyle


class SocialContentBase(BaseModel):
    content_date: date
    content_type: ContentType
    status: ContentStatus = ContentStatus.NOT_STARTED
    script: Optional[str] = None
    editing_style: Optional[EditingStyle] = None
    editing_notes: Optional[str] = None
    platforms: Optional[List[str]] = None
    hashtags: Optional[str] = None
    music_audio: Optional[str] = None
    thumbnail_reference: Optional[str] = None
    notes: Optional[str] = None
    project_id: Optional[int] = None


class SocialContentCreate(SocialContentBase):
    pass


class SocialContentUpdate(BaseModel):
    content_date: Optional[date] = None
    content_type: Optional[ContentType] = None
    status: Optional[ContentStatus] = None
    script: Optional[str] = None
    editing_style: Optional[EditingStyle] = None
    editing_notes: Optional[str] = None
    platforms: Optional[List[str]] = None
    hashtags: Optional[str] = None
    music_audio: Optional[str] = None
    thumbnail_reference: Optional[str] = None
    notes: Optional[str] = None
    project_id: Optional[int] = None


class SocialContent(SocialContentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
