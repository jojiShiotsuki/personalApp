from sqlalchemy.orm import Session
from typing import Optional

from app.models.pipeline_calculator import PipelineSettings
from app.schemas.pipeline_calculator import (
    PipelineSettingsBase,
    PipelineSettingsUpdate,
    PipelineCalculation,
    calculate_pipeline,
)


def get_or_create_settings(db: Session) -> PipelineSettings:
    """Get pipeline settings, creating default if none exists."""
    settings = db.query(PipelineSettings).first()
    if not settings:
        settings = PipelineSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_settings(db: Session, data: PipelineSettingsUpdate) -> PipelineSettings:
    """Update pipeline settings."""
    settings = get_or_create_settings(db)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)
    return settings


def get_pipeline_calculation(db: Session) -> PipelineCalculation:
    """Calculate pipeline requirements based on current settings."""
    settings = get_or_create_settings(db)

    # Convert to Pydantic model for calculation
    settings_data = PipelineSettingsBase(
        monthly_revenue_goal=settings.monthly_revenue_goal,
        average_deal_value=settings.average_deal_value,
        lead_to_qualified_rate=settings.lead_to_qualified_rate,
        qualified_to_proposal_rate=settings.qualified_to_proposal_rate,
        proposal_to_close_rate=settings.proposal_to_close_rate,
        cold_email_response_rate=settings.cold_email_response_rate,
        linkedin_connection_rate=settings.linkedin_connection_rate,
        linkedin_to_conversation_rate=settings.linkedin_to_conversation_rate,
        call_to_meeting_rate=settings.call_to_meeting_rate,
        loom_response_rate=settings.loom_response_rate,
        loom_to_call_rate=settings.loom_to_call_rate,
    )

    return calculate_pipeline(settings_data)


def calculate_custom_pipeline(data: PipelineSettingsBase) -> PipelineCalculation:
    """Calculate pipeline with custom settings (without saving)."""
    return calculate_pipeline(data)
