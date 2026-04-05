import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.database import Base


class NurtureStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    QUIET = "QUIET"
    LONG_TERM = "LONG_TERM"
    CONVERTED = "CONVERTED"
    LOST = "LOST"


class FollowupStage(str, enum.Enum):
    DAY_2 = "DAY_2"
    DAY_5 = "DAY_5"
    DAY_10 = "DAY_10"
    LONG_TERM = "LONG_TERM"


# Predefined nurture steps (constants)
NURTURE_STEPS = {
    1: "Reply with value",
    2: "Free goodwill offer",
    3: "Deliver the free thing",
    4: "Book a call",
    5: "Make the offer / close",
}


class NurtureLead(Base):
    __tablename__ = "nurture_leads"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=True, unique=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    deal_id = Column(Integer, ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=True, index=True)
    source_channel = Column(String(50), nullable=True)
    current_step = Column(Integer, default=1, nullable=False)
    status = Column(Enum(NurtureStatus), default=NurtureStatus.ACTIVE, nullable=False)
    quiet_since = Column(DateTime, nullable=True)
    last_action_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    next_followup_at = Column(DateTime, nullable=True)
    followup_stage = Column(Enum(FollowupStage), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_nurture_leads_status", "status"),
        Index("ix_nurture_leads_followup_stage", "followup_stage"),
    )

    # Relationships
    prospect = relationship("OutreachProspect", foreign_keys=[prospect_id])
    contact = relationship("Contact", foreign_keys=[contact_id])
    deal = relationship("Deal", foreign_keys=[deal_id])
    campaign = relationship("OutreachCampaign", foreign_keys=[campaign_id])
    step_logs = relationship("NurtureStepLog", back_populates="nurture_lead", cascade="all, delete-orphan", order_by="NurtureStepLog.step_number")

    def __repr__(self):
        return f"<NurtureLead(id={self.id}, prospect_id={self.prospect_id}, step={self.current_step}, status={self.status})>"


class NurtureStepLog(Base):
    __tablename__ = "nurture_step_logs"

    id = Column(Integer, primary_key=True, index=True)
    nurture_lead_id = Column(Integer, ForeignKey("nurture_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nurture_lead = relationship("NurtureLead", back_populates="step_logs")

    def __repr__(self):
        return f"<NurtureStepLog(id={self.id}, nurture_lead_id={self.nurture_lead_id}, step={self.step_number})>"
