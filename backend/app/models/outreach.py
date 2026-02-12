import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, UniqueConstraint, Enum, JSON, Boolean
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
    email = Column(String(255), nullable=True)
    website = Column(String(500), nullable=True)
    niche = Column(String(500), nullable=True)
    custom_fields = Column(JSON, nullable=True)
    status = Column(Enum(ProspectStatus), default=ProspectStatus.QUEUED)
    current_step = Column(Integer, default=1)
    next_action_date = Column(Date, nullable=True)
    last_contacted_at = Column(DateTime, nullable=True)
    response_type = Column(Enum(ResponseType), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Social links (copied from discovered lead during import)
    linkedin_url = Column(String(500), nullable=True)
    facebook_url = Column(String(500), nullable=True)
    instagram_url = Column(String(500), nullable=True)

    # Link back to discovered lead and conversion tracking
    discovered_lead_id = Column(Integer, ForeignKey("discovered_leads.id", ondelete="SET NULL"), nullable=True)
    converted_contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True)
    converted_deal_id = Column(Integer, ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True)

    campaign = relationship("OutreachCampaign", back_populates="prospects")
    discovered_lead = relationship("DiscoveredLead", foreign_keys=[discovered_lead_id])

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


class DiscoveredLead(Base):
    """
    Stores all leads discovered through AI search.
    Used to prevent duplicate scraping and track lead history.
    """
    __tablename__ = "discovered_leads"

    id = Column(Integer, primary_key=True, index=True)
    agency_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(500), nullable=False)
    website_normalized = Column(String(500), nullable=False, index=True)
    niche = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)  # Search location used
    search_query = Column(String(500), nullable=True)  # Original search niche
    confidence = Column(String(10), nullable=True)  # 'high', 'medium', 'low'
    confidence_signals = Column(JSON, nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    facebook_url = Column(String(500), nullable=True)
    instagram_url = Column(String(500), nullable=True)
    email_source = Column(String(20), nullable=True)  # 'scraped', 'ai_found', 'manual'
    website_issues = Column(JSON, nullable=True)  # e.g. ['slow_load', 'not_mobile_friendly', ...]
    is_disqualified = Column(Boolean, default=False, nullable=False, server_default='0')
    last_enriched_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DiscoveredLead(id={self.id}, agency_name={self.agency_name}, website={self.website})>"


class SearchPlannerCombination(Base):
    """Tracks city+niche combinations for systematic lead searching."""
    __tablename__ = "search_planner_combinations"

    id = Column(Integer, primary_key=True, index=True)
    country = Column(String(100), nullable=False, index=True)
    city = Column(String(200), nullable=False)
    niche = Column(String(500), nullable=False)
    is_searched = Column(Boolean, default=False, nullable=False, server_default='0')
    searched_at = Column(DateTime, nullable=True)
    leads_found = Column(Integer, default=0, nullable=False, server_default='0')
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('country', 'city', 'niche', name='uq_country_city_niche'),
    )

    def __repr__(self):
        return f"<SearchPlannerCombination(id={self.id}, city={self.city}, niche={self.niche})>"
