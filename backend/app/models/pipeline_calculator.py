from sqlalchemy import Column, Integer, Float, DateTime
from datetime import datetime
from app.database import Base


class PipelineSettings(Base):
    """Settings for pipeline calculations and revenue targets."""
    __tablename__ = "pipeline_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Revenue targets
    monthly_revenue_goal = Column(Float, default=10000.0)  # Target monthly revenue
    average_deal_value = Column(Float, default=2000.0)  # Average deal size

    # Stage conversion rates (percentages)
    lead_to_qualified_rate = Column(Float, default=30.0)  # % of leads that become qualified
    qualified_to_proposal_rate = Column(Float, default=50.0)  # % of qualified that get proposals
    proposal_to_close_rate = Column(Float, default=40.0)  # % of proposals that close

    # Activity conversion rates (percentages)
    cold_email_response_rate = Column(Float, default=5.0)  # % of cold emails that get responses
    linkedin_connection_rate = Column(Float, default=25.0)  # % of LinkedIn requests accepted
    linkedin_to_conversation_rate = Column(Float, default=20.0)  # % of connections that reply
    call_to_meeting_rate = Column(Float, default=15.0)  # % of calls that book meetings
    loom_response_rate = Column(Float, default=30.0)  # % of Loom audits that get responses
    loom_to_call_rate = Column(Float, default=50.0)  # % of Loom responses that book calls

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PipelineSettings(id={self.id}, monthly_goal=${self.monthly_revenue_goal})>"
