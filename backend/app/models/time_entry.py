from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Numeric, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class TimeEntryCategory(str, enum.Enum):
    DEVELOPMENT = "development"
    DESIGN = "design"
    MEETING = "meeting"
    COMMUNICATION = "communication"
    RESEARCH = "research"
    ADMIN = "admin"
    SUPPORT = "support"
    OTHER = "other"


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)  # null if running
    duration_seconds = Column(Integer, nullable=True)  # calculated on stop, allows manual override

    is_running = Column(Boolean, default=False, index=True)
    is_paused = Column(Boolean, default=False)
    paused_duration_seconds = Column(Integer, default=0)  # tracks total pause time

    # Links to task/project/deal (all optional)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    deal_id = Column(Integer, ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True, index=True)

    # Billing
    hourly_rate = Column(Numeric(10, 2), nullable=True)  # copied from deal/project or manual
    is_billable = Column(Boolean, default=True)  # whether this time counts for billing

    # Categorization
    category = Column(Enum(TimeEntryCategory), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    task = relationship("Task", backref="time_entries")
    project = relationship("Project", backref="time_entries")
    deal = relationship("Deal", backref="time_entries")

    @property
    def billable_amount(self):
        """Calculate billable amount based on duration and hourly rate."""
        if self.duration_seconds and self.hourly_rate and self.is_billable:
            hours = self.duration_seconds / 3600
            return float(self.hourly_rate) * hours
        return None

    def __repr__(self):
        return f"<TimeEntry(id={self.id}, running={self.is_running}, duration={self.duration_seconds}s)>"
