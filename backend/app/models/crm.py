from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, Numeric, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class ContactStatus(str, enum.Enum):
    LEAD = "LEAD"
    PROSPECT = "PROSPECT"
    CLIENT = "CLIENT"
    INACTIVE = "INACTIVE"

class TradeIndustry(str, enum.Enum):
    ROOFER = "ROOFER"
    PLUMBER = "PLUMBER"
    ELECTRICIAN = "ELECTRICIAN"
    BUILDER = "BUILDER"
    HVAC = "HVAC"
    LANDSCAPER = "LANDSCAPER"
    PAINTER = "PAINTER"
    CARPENTER = "CARPENTER"
    TILER = "TILER"
    CONCRETER = "CONCRETER"
    OTHER = "OTHER"

class LeadSource(str, enum.Enum):
    HIPAGES = "HIPAGES"
    SERVICE_SEEKING = "SERVICE_SEEKING"
    YELLOW_PAGES = "YELLOW_PAGES"
    TRUE_LOCAL = "TRUE_LOCAL"
    ONEFLARE = "ONEFLARE"
    GOOGLE_MAPS = "GOOGLE_MAPS"
    GOOGLE_SEARCH = "GOOGLE_SEARCH"
    LINKEDIN = "LINKEDIN"
    REFERRAL = "REFERRAL"
    COLD_EMAIL = "COLD_EMAIL"
    OTHER = "OTHER"

class DealStage(str, enum.Enum):
    LEAD = "LEAD"
    PROSPECT = "PROSPECT"
    PROPOSAL = "PROPOSAL"
    NEGOTIATION = "NEGOTIATION"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"

class BillingFrequency(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    SEMI_ANNUAL = "SEMI_ANNUAL"
    ANNUAL = "ANNUAL"

class ServiceStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    PENDING = "PENDING"

class InteractionType(str, enum.Enum):
    MEETING = "MEETING"
    EMAIL = "EMAIL"
    CALL = "CALL"
    NOTE = "NOTE"
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    FOLLOW_UP_EMAIL = "FOLLOW_UP_EMAIL"
    # Daily outreach activity types
    COLD_EMAIL = "COLD_EMAIL"
    LINKEDIN_ACTION = "LINKEDIN_ACTION"
    FOLLOW_UP_CALL = "FOLLOW_UP_CALL"
    LOOM_AUDIT = "LOOM_AUDIT"

class Contact(Base):
    __tablename__ = "crm_contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    status = Column(Enum(ContactStatus), default=ContactStatus.LEAD)
    source = Column("lead_source", String(100), nullable=True)  # Where contact came from (TikTok, website, referral, etc.)
    notes = Column(Text, nullable=True)

    # Tradie-specific fields for lead acquisition
    industry = Column(String(50), nullable=True)  # Trade type (roofer, plumber, etc.)
    suburb = Column(String(100), nullable=True)  # Service area/suburb
    city = Column(String(100), nullable=True)  # City (Brisbane, Perth, Sydney, etc.)
    website_url = Column(String(500), nullable=True)  # Business website
    website_issues = Column(Text, nullable=True)  # JSON list of issues (slow, not mobile-friendly, etc.)
    website_speed_score = Column(Integer, nullable=True)  # Website speed score (0-100)

    # Outreach tracking fields
    email_stage = Column(String(50), nullable=True)  # not_sent, email_1, follow_up, break_up, replied
    email_last_sent = Column(Date, nullable=True)  # When last email was sent
    linkedin_stage = Column(String(50), nullable=True)  # not_connected, requested, connected, message_1, message_2
    linkedin_last_action = Column(Date, nullable=True)  # When last LinkedIn action was taken
    loom_audit_sent = Column(Boolean, default=False)  # Has Loom video audit been sent?
    loom_audit_url = Column(String(500), nullable=True)  # Link to the Loom video
    next_followup_date = Column(Date, nullable=True)  # When to follow up next

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    deals = relationship("Deal", back_populates="contact", cascade="all, delete-orphan")
    interactions = relationship("Interaction", back_populates="contact", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Contact(id={self.id}, name='{self.name}', status={self.status})>"

class Deal(Base):
    __tablename__ = "crm_deals"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    value = Column(Numeric(12, 2), nullable=True)
    stage = Column(Enum(DealStage), default=DealStage.LEAD)
    probability = Column(Integer, default=50)  # 0-100
    expected_close_date = Column(Date, nullable=True)
    actual_close_date = Column(Date, nullable=True)
    next_followup_date = Column(Date, nullable=True)  # Next scheduled follow-up date
    hourly_rate = Column(Numeric(10, 2), nullable=True)  # For time tracking billing

    # Subscription/Recurring Service Fields
    is_recurring = Column(Boolean, default=False)
    billing_frequency = Column(Enum(BillingFrequency), nullable=True)
    recurring_amount = Column(Numeric(12, 2), nullable=True)
    next_billing_date = Column(Date, nullable=True)
    service_status = Column(Enum(ServiceStatus), nullable=True)
    service_start_date = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contact = relationship("Contact", back_populates="deals")

    def __repr__(self):
        return f"<Deal(id={self.id}, title='{self.title}', stage={self.stage})>"

class Interaction(Base):
    __tablename__ = "crm_interactions"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(InteractionType), nullable=False)
    subject = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    interaction_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    contact = relationship("Contact", back_populates="interactions")

    def __repr__(self):
        return f"<Interaction(id={self.id}, type={self.type}, contact_id={self.contact_id})>"
