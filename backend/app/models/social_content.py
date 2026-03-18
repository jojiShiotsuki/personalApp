from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class ContentType(str, enum.Enum):
    REEL = "REEL"
    CAROUSEL = "CAROUSEL"
    SINGLE_POST = "SINGLE_POST"
    STORY = "STORY"
    TIKTOK = "TIKTOK"
    YOUTUBE_SHORT = "YOUTUBE_SHORT"
    YOUTUBE_VIDEO = "YOUTUBE_VIDEO"
    BLOG_POST = "BLOG_POST"


class ContentStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    SCRIPTED = "SCRIPTED"
    FILMED = "FILMED"
    EDITING = "EDITING"
    SCHEDULED = "SCHEDULED"
    POSTED = "POSTED"


class RepurposeFormat(str, enum.Enum):
    # Short-form Video
    INSTAGRAM_REEL = "INSTAGRAM_REEL"
    TIKTOK_REEL = "TIKTOK_REEL"
    YOUTUBE_SHORT = "YOUTUBE_SHORT"
    FACEBOOK_REEL = "FACEBOOK_REEL"
    LINKEDIN_REEL = "LINKEDIN_REEL"
    # Carousel
    INSTAGRAM_CAROUSEL = "INSTAGRAM_CAROUSEL"
    LINKEDIN_CAROUSEL = "LINKEDIN_CAROUSEL"
    FACEBOOK_CAROUSEL = "FACEBOOK_CAROUSEL"
    TIKTOK_CAROUSEL = "TIKTOK_CAROUSEL"
    # Long Caption (photo/video + music + long caption)
    INSTAGRAM_LONG_CAPTION = "INSTAGRAM_LONG_CAPTION"
    TIKTOK_LONG_CAPTION = "TIKTOK_LONG_CAPTION"
    FACEBOOK_LONG_CAPTION = "FACEBOOK_LONG_CAPTION"
    # Text Post
    FACEBOOK_POST = "FACEBOOK_POST"
    LINKEDIN_POST = "LINKEDIN_POST"
    THREADS_POST = "THREADS_POST"
    TWITTER_POST = "TWITTER_POST"
    # Legacy formats (pre-expansion data)
    REEL = "REEL"
    CAROUSEL = "CAROUSEL"
    LONG_CAPTION = "LONG_CAPTION"


class EditingStyle(str, enum.Enum):
    FAST_PACED = "FAST_PACED"
    CINEMATIC = "CINEMATIC"
    EDUCATIONAL = "EDUCATIONAL"
    BEHIND_SCENES = "BEHIND_SCENES"
    TRENDING = "TRENDING"
    TUTORIAL = "TUTORIAL"
    INTERVIEW = "INTERVIEW"
    CUSTOM = "CUSTOM"


class ReelType(str, enum.Enum):
    EDUCATIONAL = "EDUCATIONAL"
    BEFORE_AFTER = "BEFORE_AFTER"
    BTS = "BTS"
    SOCIAL_PROOF = "SOCIAL_PROOF"
    MINI_AUDIT = "MINI_AUDIT"
    SEO_EDUCATION = "SEO_EDUCATION"
    CLIENT_RESULTS = "CLIENT_RESULTS"
    DIRECT_CTA = "DIRECT_CTA"
    FULL_REDESIGN = "FULL_REDESIGN"


class SocialContent(Base):
    __tablename__ = "social_content"

    # Primary fields
    id = Column(Integer, primary_key=True, index=True)
    content_date = Column(Date, nullable=False, index=True)

    # Required content fields
    content_type = Column(Enum(ContentType), nullable=False)
    status = Column(Enum(ContentStatus), default=ContentStatus.NOT_STARTED)

    # Title and Script/Caption
    title = Column(String(255), nullable=True)
    script = Column(Text, nullable=True)

    # Reel type classification
    reel_type = Column(Enum(ReelType), nullable=True)

    # Editing details
    editing_style = Column(Enum(EditingStyle), nullable=True)
    editing_notes = Column(Text, nullable=True)

    # Platform targeting (stored as JSON array)
    platforms = Column(JSON, nullable=True)

    # Repurpose tracking - track status for each format variant
    # Structure: [{"format": "reel", "status": "posted", "posted_date": "2024-01-15"}, ...]
    repurpose_formats = Column(JSON, nullable=True)

    # Optional metadata
    hashtags = Column(Text, nullable=True)
    music_audio = Column(String(255), nullable=True)
    thumbnail_reference = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    # Optional integration with existing features
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", backref="social_content")

    def __repr__(self):
        return f"<SocialContent(id={self.id}, date={self.content_date}, type={self.content_type})>"
