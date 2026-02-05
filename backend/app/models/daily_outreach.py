from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Boolean
from datetime import datetime, date
from app.database import Base


class DailyOutreachLog(Base):
    """Tracks daily outreach activity counts."""
    __tablename__ = "daily_outreach_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_date = Column(Date, unique=True, index=True, nullable=False, default=date.today)

    # Activity counts
    cold_emails_sent = Column(Integer, default=0)
    linkedin_actions = Column(Integer, default=0)
    follow_up_calls = Column(Integer, default=0)
    loom_audits_sent = Column(Integer, default=0)

    # Targets for this day (stored for historical reference)
    target_cold_emails = Column(Integer, default=10)
    target_linkedin = Column(Integer, default=10)
    target_calls = Column(Integer, default=5)
    target_looms = Column(Integer, default=1)

    # Whether all targets were met this day
    all_targets_met = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def check_targets_met(self):
        """Check if all targets are met and update the flag."""
        self.all_targets_met = (
            self.cold_emails_sent >= self.target_cold_emails and
            self.linkedin_actions >= self.target_linkedin and
            self.follow_up_calls >= self.target_calls and
            self.loom_audits_sent >= self.target_looms
        )
        return self.all_targets_met

    def __repr__(self):
        return f"<DailyOutreachLog(date={self.log_date}, emails={self.cold_emails_sent}, linkedin={self.linkedin_actions})>"


class OutreachSettings(Base):
    """Global outreach target settings."""
    __tablename__ = "outreach_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Daily targets
    daily_cold_email_target = Column(Integer, default=10)
    daily_linkedin_target = Column(Integer, default=10)
    daily_call_target = Column(Integer, default=5)
    daily_loom_target = Column(Integer, default=1)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<OutreachSettings(emails={self.daily_cold_email_target}, linkedin={self.daily_linkedin_target})>"
