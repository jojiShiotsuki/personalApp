from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.database import Base
import enum


class CallOutcome(str, enum.Enum):
    """Outcome of the discovery call."""
    SCHEDULED_FOLLOWUP = "scheduled_followup"
    SENT_PROPOSAL = "sent_proposal"
    NOT_A_FIT = "not_a_fit"
    NEEDS_MORE_INFO = "needs_more_info"
    CLOSED_DEAL = "closed_deal"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"


class DiscoveryCall(Base):
    """Discovery call notes using SPIN framework."""
    __tablename__ = "discovery_calls"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id"), nullable=False, index=True)
    deal_id = Column(Integer, ForeignKey("crm_deals.id"), nullable=True, index=True)

    # Call details
    call_date = Column(Date, nullable=False, default=date.today)
    call_duration_minutes = Column(Integer, nullable=True)
    attendees = Column(String(500), nullable=True)  # Comma-separated names

    # SPIN Framework Notes
    # S - Situation: Current state, background, context
    situation = Column(Text, nullable=True)
    situation_questions = Column(Text, nullable=True)  # Questions asked

    # P - Problem: Challenges, pain points, issues
    problem = Column(Text, nullable=True)
    problem_questions = Column(Text, nullable=True)

    # I - Implication: Consequences of not solving, impact
    implication = Column(Text, nullable=True)
    implication_questions = Column(Text, nullable=True)

    # N - Need-Payoff: Benefits of solving, value proposition
    need_payoff = Column(Text, nullable=True)
    need_payoff_questions = Column(Text, nullable=True)

    # Additional notes
    objections = Column(Text, nullable=True)  # Objections raised
    next_steps = Column(Text, nullable=True)  # Action items
    budget_discussed = Column(Boolean, default=False)
    budget_range = Column(String(100), nullable=True)  # e.g., "$2K-5K"
    timeline_discussed = Column(Boolean, default=False)
    timeline = Column(String(100), nullable=True)  # e.g., "Q1 2026"
    decision_maker_present = Column(Boolean, default=False)

    # Outcome
    outcome = Column(Enum(CallOutcome), nullable=True)
    follow_up_date = Column(Date, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contact = relationship("Contact", backref="discovery_calls")
    deal = relationship("Deal", backref="discovery_calls")

    @property
    def spin_completion(self) -> int:
        """Calculate SPIN completion percentage."""
        filled = 0
        total = 4
        if self.situation:
            filled += 1
        if self.problem:
            filled += 1
        if self.implication:
            filled += 1
        if self.need_payoff:
            filled += 1
        return int((filled / total) * 100)

    def __repr__(self):
        return f"<DiscoveryCall(id={self.id}, contact_id={self.contact_id}, date={self.call_date})>"
