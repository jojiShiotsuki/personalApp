import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, UniqueConstraint, Enum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


# Enums for Cold Email Outreach
class ProspectStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    IN_SEQUENCE = "IN_SEQUENCE"
    REPLIED = "REPLIED"
    NOT_INTERESTED = "NOT_INTERESTED"
    CONVERTED = "CONVERTED"


class ResponseType(str, enum.Enum):
    INTERESTED = "INTERESTED"
    NOT_INTERESTED = "NOT_INTERESTED"
    OTHER = "OTHER"


class CampaignStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class OutreachNiche(Base):
    __tablename__ = "outreach_niches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    templates = relationship("OutreachTemplate", back_populates="niche", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OutreachNiche(id={self.id}, name={self.name})>"


class OutreachSituation(Base):
    __tablename__ = "outreach_situations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    templates = relationship("OutreachTemplate", back_populates="situation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OutreachSituation(id={self.id}, name={self.name})>"


class OutreachTemplate(Base):
    __tablename__ = "outreach_templates"

    id = Column(Integer, primary_key=True, index=True)
    niche_id = Column(Integer, ForeignKey("outreach_niches.id", ondelete="CASCADE"), nullable=False)
    situation_id = Column(Integer, ForeignKey("outreach_situations.id", ondelete="CASCADE"), nullable=False)
    dm_number = Column(Integer, nullable=False, default=1)  # 1-5 for DM sequence
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Ensure unique combination of niche + situation + dm_number
    __table_args__ = (
        UniqueConstraint('niche_id', 'situation_id', 'dm_number', name='uq_niche_situation_dm'),
    )

    niche = relationship("OutreachNiche", back_populates="templates")
    situation = relationship("OutreachSituation", back_populates="templates")

    def __repr__(self):
        return f"<OutreachTemplate(id={self.id}, niche_id={self.niche_id}, situation_id={self.situation_id})>"


# Cold Email Outreach Models
class OutreachCampaign(Base):
    __tablename__ = "outreach_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.ACTIVE)
    step_1_delay = Column(Integer, default=0)
    step_2_delay = Column(Integer, default=3)
    step_3_delay = Column(Integer, default=5)
    step_4_delay = Column(Integer, default=7)
    step_5_delay = Column(Integer, default=7)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prospects = relationship("OutreachProspect", back_populates="campaign", cascade="all, delete-orphan")
    email_templates = relationship("OutreachEmailTemplate", back_populates="campaign", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OutreachCampaign(id={self.id}, name={self.name}, status={self.status})>"


class OutreachProspect(Base):
    __tablename__ = "outreach_prospects"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False)
    agency_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False)
    website = Column(String(500), nullable=True)
    niche = Column(String(100), nullable=True)
    custom_fields = Column(JSON, nullable=True)
    status = Column(Enum(ProspectStatus), default=ProspectStatus.QUEUED)
    current_step = Column(Integer, default=1)
    next_action_date = Column(Date, nullable=True)
    last_contacted_at = Column(DateTime, nullable=True)
    response_type = Column(Enum(ResponseType), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("OutreachCampaign", back_populates="prospects")

    def __repr__(self):
        return f"<OutreachProspect(id={self.id}, agency_name={self.agency_name}, status={self.status})>"


class OutreachEmailTemplate(Base):
    __tablename__ = "outreach_email_templates"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)  # 1-5 for email sequence
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("OutreachCampaign", back_populates="email_templates")

    def __repr__(self):
        return f"<OutreachEmailTemplate(id={self.id}, campaign_id={self.campaign_id}, step_number={self.step_number})>"
