from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class TikTokVideo(Base):
    __tablename__ = "tiktok_videos"

    id = Column(Integer, primary_key=True, index=True)
    tiktok_id = Column(String, unique=True, nullable=False, index=True)
    caption = Column(Text, nullable=True)
    hashtags = Column(JSON, default=list)
    create_time = Column(DateTime, nullable=True, index=True)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    video_duration = Column(Integer, nullable=True)
    sound_name = Column(String, nullable=True)
    raw_data = Column(JSON, nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    social_content_id = Column(
        Integer,
        ForeignKey("social_content.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    social_content = relationship("SocialContent", backref="tiktok_videos")

    __table_args__ = (
        Index("ix_tiktok_videos_views", "views"),
    )

    @property
    def engagement_rate(self) -> float:
        if self.views and self.views > 0:
            return (self.likes + self.comments + self.shares + self.saves) / self.views
        return 0.0
