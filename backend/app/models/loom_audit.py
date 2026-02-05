from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.database import Base
import enum


class LoomResponseType(str, enum.Enum):
    """Type of response received after sending a Loom audit."""
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    QUESTIONS = "questions"
    BOOKED_CALL = "booked_call"
    NO_RESPONSE = "no_response"


class LoomAudit(Base):
    """Track Loom video audits sent to prospects."""
    __tablename__ = "loom_audits"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id"), nullable=False, index=True)

    # Loom details
    title = Column(String(255), nullable=False)  # e.g., "Website Audit for ABC Plumbing"
    loom_url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)  # Optional thumbnail

    # Tracking
    sent_date = Column(Date, nullable=False, default=date.today)
    sent_via = Column(String(50), nullable=True)  # email, linkedin, direct

    # Engagement tracking
    watched = Column(Boolean, default=False)
    watched_date = Column(Date, nullable=True)
    watch_count = Column(Integer, default=0)  # If Loom provides this

    # Response tracking
    response_received = Column(Boolean, default=False)
    response_date = Column(Date, nullable=True)
    response_type = Column(Enum(LoomResponseType), nullable=True)

    # Follow-up
    follow_up_date = Column(Date, nullable=True)
    follow_up_sent = Column(Boolean, default=False)

    # Notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contact = relationship("Contact", backref="loom_audits")

    @property
    def is_pending_response(self) -> bool:
        """Check if audit is sent but no response yet."""
        return not self.response_received and self.sent_date is not None

    @property
    def days_since_sent(self) -> int:
        """Calculate days since the audit was sent."""
        if not self.sent_date:
            return 0
        return (date.today() - self.sent_date).days

    @property
    def needs_follow_up(self) -> bool:
        """Check if a follow-up is needed (3+ days without response, no follow-up sent)."""
        return (
            self.is_pending_response
            and self.days_since_sent >= 3
            and not self.follow_up_sent
        )

    def __repr__(self):
        return f"<LoomAudit(id={self.id}, title='{self.title}', contact_id={self.contact_id})>"
