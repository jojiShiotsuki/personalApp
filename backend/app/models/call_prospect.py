"""
Call Prospect model for the Cold Calls pipeline tab in Outreach Hub.

Tracks PH service-business prospects (aircon cleaners, barbershops, salons, etc.)
through a simple 4-stage phone prospecting pipeline: NEW, ATTEMPTED, CONNECTED, DEAD.

Kept separate from OutreachProspect because the data shape, pipeline stages, and
workflow differ from email/LinkedIn outreach.
"""
import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text

from app.database import Base


class CallStatus(str, enum.Enum):
    NEW = "NEW"
    ATTEMPTED = "ATTEMPTED"
    CONNECTED = "CONNECTED"
    DEAD = "DEAD"


class CallProspect(Base):
    __tablename__ = "call_prospects"

    id = Column(Integer, primary_key=True, index=True)
    business_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    vertical = Column(String(100), nullable=True)  # aircon, barbershop, salon, etc.
    address = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(
        String(20),
        nullable=False,
        default=CallStatus.NEW.value,
        server_default=CallStatus.NEW.value,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_call_prospects_status_updated", "status", "updated_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<CallProspect(id={self.id}, business_name={self.business_name}, "
            f"status={self.status})>"
        )
