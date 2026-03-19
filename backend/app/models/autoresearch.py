from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class AuditResult(Base):
    """Stores website audit results from the autoresearch system."""
    __tablename__ = "audit_results"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)

    # Primary issue found
    issue_type = Column(String(100), nullable=True)
    issue_detail = Column(Text, nullable=True)

    # Secondary issue found
    secondary_issue = Column(String(100), nullable=True)
    secondary_detail = Column(Text, nullable=True)

    # Quality assessment
    confidence = Column(String(20), default="medium")
    site_quality = Column(String(20), default="medium")
    needs_verification = Column(Boolean, default=False)
    pass_2_completed = Column(Boolean, default=False)

    # Generated email content
    generated_subject = Column(String(500), nullable=True)
    generated_body = Column(Text, nullable=True)
    word_count = Column(Integer, nullable=True)

    # Screenshots
    desktop_screenshot = Column(Text, nullable=True)
    mobile_screenshot = Column(Text, nullable=True)
    verification_screenshots = Column(JSON, nullable=True)

    # Review status
    status = Column(String(30), default="pending_review")
    rejection_reason = Column(Text, nullable=True)

    # Edit tracking
    was_edited = Column(Boolean, default=False)
    edited_subject = Column(String(500), nullable=True)
    edited_body = Column(Text, nullable=True)

    # Cost tracking
    audit_duration_seconds = Column(Float, nullable=True)
    model_used = Column(String(100), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    ai_cost_estimate = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    experiment = relationship("Experiment", back_populates="audit", uselist=False)

    def __repr__(self):
        return f"<AuditResult(id={self.id}, prospect_id={self.prospect_id}, status={self.status})>"


class Experiment(Base):
    """Tracks each email sent as an experiment for learning."""
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    audit_id = Column(Integer, ForeignKey("audit_results.id", ondelete="CASCADE"), nullable=False, index=True)

    # Experiment status
    status = Column(String(30), default="draft")  # draft/sent/replied/no_reply/bounced

    # Denormalized audit data (snapshot at send time)
    issue_type = Column(String(100), nullable=True, index=True)
    issue_detail = Column(Text, nullable=True)
    secondary_issue = Column(String(100), nullable=True)
    secondary_detail = Column(Text, nullable=True)
    confidence = Column(String(20), nullable=True)
    site_quality = Column(String(20), nullable=True)
    pass_2_triggered = Column(Boolean, default=False)

    # Email data
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=True)
    word_count = Column(Integer, nullable=True)
    was_edited = Column(Boolean, default=False)
    edit_type = Column(String(30), nullable=True)  # none/minor/major/rewrite

    # Prospect context (snapshot at send time)
    niche = Column(String(255), nullable=True, index=True)
    city = Column(String(200), nullable=True)
    state = Column(String(100), nullable=True)
    company = Column(String(255), nullable=True)

    # Send data
    sent_at = Column(DateTime, nullable=True)
    day_of_week = Column(String(10), nullable=True)
    step_number = Column(Integer, nullable=False, default=1)

    # Outcome tracking
    replied = Column(Boolean, default=False)
    reply_at = Column(DateTime, nullable=True)
    response_time_minutes = Column(Integer, nullable=True)
    sentiment = Column(String(30), nullable=True)  # positive/neutral/negative
    category = Column(String(50), nullable=True)  # interested/not_interested/question/referral/etc.
    forwarded_internally = Column(Boolean, nullable=True)
    full_reply_text = Column(Text, nullable=True)

    # Conversion tracking
    converted_to_call = Column(Boolean, default=False)
    converted_to_client = Column(Boolean, default=False)
    deal_id = Column(Integer, ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True)
    deal_value = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    audit = relationship("AuditResult", back_populates="experiment")

    def __repr__(self):
        return f"<Experiment(id={self.id}, prospect_id={self.prospect_id}, status={self.status})>"


class GmailToken(Base):
    """Stores encrypted OAuth refresh token for Gmail integration."""
    __tablename__ = "gmail_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    email_address = Column(String(255), nullable=False)
    encrypted_refresh_token = Column(Text, nullable=False)
    last_poll_at = Column(DateTime, nullable=True)
    last_history_id = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<GmailToken(id={self.id}, user_id={self.user_id}, email={self.email_address})>"


class EmailMatch(Base):
    """Matches Gmail emails to prospects for reply tracking."""
    __tablename__ = "email_matches"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=False, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True, index=True)

    # Gmail data
    gmail_message_id = Column(String(255), nullable=False, unique=True)
    direction = Column(String(10), nullable=False)  # inbound/outbound
    from_email = Column(String(255), nullable=False)
    to_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    body_text = Column(Text, nullable=True)
    received_at = Column(DateTime, nullable=False)

    # Classification
    sentiment = Column(String(30), nullable=True)
    category = Column(String(50), nullable=True)
    wants_loom = Column(Boolean, nullable=True)
    wants_call = Column(Boolean, nullable=True)
    forwarded_internally = Column(Boolean, nullable=True)
    key_quote = Column(Text, nullable=True)
    suggested_action = Column(String(100), nullable=True)
    classification_cost = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<EmailMatch(id={self.id}, prospect_id={self.prospect_id}, direction={self.direction})>"


class Insight(Base):
    """Learned patterns from experiment data."""
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, index=True)
    insight = Column(Text, nullable=False)
    confidence = Column(String(20), nullable=False)
    sample_size = Column(Integer, nullable=False)
    recommendation = Column(Text, nullable=True)
    applies_to = Column(String(100), nullable=True, default="all_niches")  # global/niche/issue_type/etc.
    is_active = Column(Boolean, default=True)
    experiment_count_at_refresh = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    superseded_by = Column(Integer, ForeignKey("insights.id", ondelete="SET NULL"), nullable=True)

    def __repr__(self):
        return f"<Insight(id={self.id}, confidence={self.confidence}, active={self.is_active})>"


class AutoresearchSettings(Base):
    """Per-user configuration for the autoresearch system."""
    __tablename__ = "autoresearch_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Prompts
    audit_prompt = Column(Text, nullable=True)

    # Model selection
    audit_model = Column(String(100), default="claude-sonnet-4-6")
    classifier_model = Column(String(100), default="claude-haiku-4-5")
    learning_model = Column(String(100), default="claude-sonnet-4-6")

    # Audit behavior
    min_page_load_wait = Column(Integer, default=3)
    enable_pass_2 = Column(Boolean, default=True)
    max_batch_size = Column(Integer, default=50)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AutoresearchSettings(id={self.id}, user_id={self.user_id})>"
