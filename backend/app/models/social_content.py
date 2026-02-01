from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class ContentType(str, enum.Enum):
    REEL = "reel"
    CAROUSEL = "carousel"
    SINGLE_POST = "single_post"
    STORY = "story"
    TIKTOK = "tiktok"
    YOUTUBE_SHORT = "youtube_short"
    YOUTUBE_VIDEO = "youtube_video"
    BLOG_POST = "blog_post"


class ContentStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    SCRIPTED = "scripted"
    FILMED = "filmed"
    EDITING = "editing"
    SCHEDULED = "scheduled"
    POSTED = "posted"


class RepurposeFormat(str, enum.Enum):
    REEL = "reel"
    CAROUSEL = "carousel"
    LONG_CAPTION = "long_caption"


class EditingStyle(str, enum.Enum):
    FAST_PACED = "fast_paced"
    CINEMATIC = "cinematic"
    EDUCATIONAL = "educational"
    BEHIND_SCENES = "behind_scenes"
    TRENDING = "trending"
    TUTORIAL = "tutorial"
    INTERVIEW = "interview"
    CUSTOM = "custom"


class ReelType(str, enum.Enum):
    EDUCATIONAL = "educational"
    BEFORE_AFTER = "before_after"
    BTS = "bts"
    SOCIAL_PROOF = "social_proof"
    MINI_AUDIT = "mini_audit"
    SEO_EDUCATION = "seo_education"
    CLIENT_RESULTS = "client_results"
    DIRECT_CTA = "direct_cta"
    FULL_REDESIGN = "full_redesign"


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
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", backref="social_content")

    def __repr__(self):
        return f"<SocialContent(id={self.id}, date={self.content_date}, type={self.content_type})>"
