from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TikTokVideoResponse(BaseModel):
    id: int
    tiktok_id: str
    caption: Optional[str] = None
    hashtags: list[str] = []
    create_time: Optional[datetime] = None
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    engagement_rate: float = 0.0
    video_duration: Optional[int] = None
    sound_name: Optional[str] = None
    imported_at: Optional[datetime] = None
    social_content_id: Optional[int] = None

    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    errors: list[str]
    total: int


class VideoSummary(BaseModel):
    id: int
    caption: Optional[str] = None
    views: int


class TikTokSummaryResponse(BaseModel):
    total_videos: int
    total_views: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_saves: int
    avg_views_per_video: float
    avg_engagement_rate: float
    best_video: Optional[VideoSummary] = None
    lowest_views_video: Optional[VideoSummary] = None
    date_range: Optional[dict] = None


class HashtagStat(BaseModel):
    hashtag: str
    count: int
    avg_views: float
    avg_engagement: float


class DayStat(BaseModel):
    day: str
    avg_views: float
    video_count: int


class HourStat(BaseModel):
    hour: int
    avg_views: float
    video_count: int


class SoundStat(BaseModel):
    sound: str
    count: int
    avg_views: float


class DurationStat(BaseModel):
    range: str
    avg_engagement: float
    count: int


class CaptionLengthStat(BaseModel):
    max_chars: int
    avg_views: float
    count: int


class TikTokPatternsResponse(BaseModel):
    top_hashtags: list[HashtagStat]
    best_posting_days: list[DayStat]
    best_posting_hours: list[HourStat]
    top_sounds: list[SoundStat]
    engagement_by_duration: list[DurationStat]
    caption_length_correlation: dict[str, CaptionLengthStat]
