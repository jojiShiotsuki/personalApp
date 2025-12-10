# backend/app/models/coach_insight.py
from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Enum
from datetime import datetime
from app.database import Base
import enum


class InsightType(str, enum.Enum):
    ACTION = "action"
    TIME = "time"
    PATTERN = "pattern"


class InsightPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CoachInsight(Base):
    __tablename__ = "coach_insights"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(InsightType), nullable=False, index=True)
    priority = Column(Enum(InsightPriority), default=InsightPriority.MEDIUM)
    message = Column(String(500), nullable=False)
    suggested_action = Column(String(100), nullable=True)
    action_params = Column(JSON, nullable=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    seen = Column(Boolean, default=False, index=True)
    dismissed = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<CoachInsight(id={self.id}, type='{self.type}', priority='{self.priority}')>"
