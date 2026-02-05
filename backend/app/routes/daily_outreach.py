from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.services import daily_outreach_service
from app.schemas.daily_outreach import (
    DailyOutreachStatsResponse,
    OutreachStreakResponse,
    WeeklySummaryResponse,
    LogActivityRequest,
    LogActivityResponse,
    OutreachSettingsResponse,
    OutreachSettingsUpdate,
)

router = APIRouter(prefix="/api/daily-outreach", tags=["daily-outreach"])


@router.get("/today", response_model=DailyOutreachStatsResponse)
def get_today_stats(db: Session = Depends(get_db)):
    """Get today's outreach progress."""
    return daily_outreach_service.get_today_stats(db)


@router.get("/streak", response_model=OutreachStreakResponse)
def get_streak(db: Session = Depends(get_db)):
    """Get current and best streak of consecutive days meeting all targets."""
    return daily_outreach_service.get_streak(db)


@router.get("/weekly", response_model=WeeklySummaryResponse)
def get_weekly_summary(db: Session = Depends(get_db)):
    """Get last 7 days of outreach activity."""
    return daily_outreach_service.get_weekly_summary(db)


@router.post("/log/{activity_type}", response_model=LogActivityResponse)
def log_activity(
    activity_type: str,
    request: Optional[LogActivityRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Log an outreach activity.

    Activity types:
    - cold_email: Log a cold email sent
    - linkedin: Log a LinkedIn action (connection request, message, etc.)
    - call: Log a follow-up call
    - loom: Log a Loom video audit sent

    Optionally provide a contact_id to create an interaction record.
    """
    valid_types = ["cold_email", "linkedin", "call", "loom"]
    if activity_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid activity type. Must be one of: {valid_types}",
        )

    try:
        contact_id = request.contact_id if request else None
        notes = request.notes if request else None
        return daily_outreach_service.log_activity(
            db,
            activity_type=activity_type,
            contact_id=contact_id,
            notes=notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/deduct/{activity_type}", response_model=LogActivityResponse)
def deduct_activity(
    activity_type: str,
    db: Session = Depends(get_db),
):
    """
    Deduct (undo) an outreach activity.

    Activity types:
    - cold_email: Deduct a cold email
    - linkedin: Deduct a LinkedIn action
    - call: Deduct a follow-up call
    - loom: Deduct a Loom video audit
    """
    valid_types = ["cold_email", "linkedin", "call", "loom"]
    if activity_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid activity type. Must be one of: {valid_types}",
        )

    try:
        return daily_outreach_service.deduct_activity(db, activity_type=activity_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/settings", response_model=OutreachSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """Get current outreach target settings."""
    return daily_outreach_service.get_or_create_settings(db)


@router.put("/settings", response_model=OutreachSettingsResponse)
def update_settings(
    settings: OutreachSettingsUpdate,
    db: Session = Depends(get_db),
):
    """Update outreach target settings."""
    return daily_outreach_service.update_settings(
        db,
        daily_cold_email_target=settings.daily_cold_email_target,
        daily_linkedin_target=settings.daily_linkedin_target,
        daily_call_target=settings.daily_call_target,
        daily_loom_target=settings.daily_loom_target,
    )
