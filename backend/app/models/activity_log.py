# backend/app/models/activity_log.py
from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime
from app.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=True)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<ActivityLog(id={self.id}, action='{self.action}', entity='{self.entity_type}')>"
