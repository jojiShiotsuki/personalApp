"""
Call Prospect model for the Cold Calls pipeline tab in Outreach Hub.

Tracks PH service-business prospects (aircon cleaners, barbershops, salons, etc.)
through a simple 4-stage phone prospecting pipeline: NEW, ATTEMPTED, CONNECTED, DEAD.

Kept separate from OutreachProspect because the data shape, pipeline stages, and
workflow differ from email/LinkedIn outreach.
"""
import enum
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text

from app.database import Base


class CallStatus(str, enum.Enum):
    NEW = "NEW"
    ATTEMPTED = "ATTEMPTED"
    CONNECTED = "CONNECTED"
    DEAD = "DEAD"


class ProspectTier(str, enum.Enum):
    S_TIER_FLAGSHIP = "S_TIER_FLAGSHIP"
    A_TIER_FLAGSHIP = "A_TIER_FLAGSHIP"
    B_TIER_FLAGSHIP = "B_TIER_FLAGSHIP"
    COMMERCIAL_SPECIALIST = "COMMERCIAL_SPECIALIST"
    DEVELOPMENTAL = "DEVELOPMENTAL"


class CallProspect(Base):
    __tablename__ = "call_prospects"

    id = Column(Integer, primary_key=True, index=True)
    business_name = Column(String(255), nullable=False)
    # Person fields (populated from Apollo-style person-centric CSVs)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    position = Column(String(255), nullable=True)  # job title, e.g. "Founder & Creative Director"
    email = Column(String(255), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)  # Primary (first non-empty) phone
    # All phones from the source CSV, labeled with their original column name
    # (e.g. [{"label": "Mobile Phone", "value": "+61 499 153 849"}, ...]).
    # Lets the cold-call UI surface every phone so the user picks the right one.
    additional_phones = Column(JSON, nullable=True)
    vertical = Column(String(100), nullable=True)  # aircon, barbershop, salon, etc.
    address = Column(String(500), nullable=True)
    facebook_url = Column(String(500), nullable=True)
    website = Column(String(500), nullable=True)
    source = Column(String(100), nullable=True)  # e.g. "FB Ads", "Outscraper", "Referral"
    # Rich Google Maps listing data (populated from Outscraper-style CSV imports)
    rating = Column(Float, nullable=True)
    reviews_count = Column(Integer, nullable=True)
    google_maps_url = Column(String(1000), nullable=True)
    working_hours = Column(String(1000), nullable=True)  # "Sun: 8AM-5PM | Mon: 8AM-5PM | ..."
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    # Free-text tag for A/B testing phone scripts. NULL = no label.
    script_label = Column(String(50), nullable=True)
    # Prospect quality tier (S/A/B flagship, Commercial specialist, Developmental).
    # Stored as the enum's string value; NULL = untagged. No index — low cardinality
    # (5 values) and filtering/sorting happens client-side.
    tier = Column(String(30), nullable=True)
    # Scheduled callback time captured when the prospect says "call me back at X".
    # Stored in UTC; frontend converts to browser local for display + input.
    # NULL = no callback scheduled. Orthogonal to `status` — setting this does
    # not move the prospect between kanban columns.
    callback_at = Column(DateTime, nullable=True, index=True)
    # Optional short context for the callback (e.g. "owner back from holiday").
    callback_notes = Column(String(255), nullable=True)
    status = Column(
        String(20),
        nullable=False,
        default=CallStatus.NEW.value,
        server_default=CallStatus.NEW.value,
        index=True,
    )
    # Optional link to an OutreachCampaign (campaign_type='COLD_CALLS'). NULL
    # means the prospect is unassigned and shows under "All Campaigns".
    campaign_id = Column(
        Integer,
        ForeignKey("outreach_campaigns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Which sequence step the prospect is currently on. Used by the
    # step-based kanban when the selected campaign has multi_touch_steps.
    current_step = Column(Integer, nullable=False, default=1, server_default="1")
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
