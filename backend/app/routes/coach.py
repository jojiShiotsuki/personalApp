# backend/app/routes/coach.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.schemas.coach import (
    CoachInsightResponse,
    CheckInsightRequest,
)
from app.services.coach_service import CoachService

router = APIRouter(prefix="/api/coach", tags=["coach"])


@router.post("/check", response_model=Optional[CoachInsightResponse])
def check_for_insight(
    request: CheckInsightRequest,
    coach_level: int = 2,
    db: Session = Depends(get_db)
):
    """Check if an action should trigger a coach insight."""
    service = CoachService(db, coach_level)
    insight = service.check_action(
        action=request.action,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        metadata=request.metadata
    )
    return insight


@router.get("/insights", response_model=list[CoachInsightResponse])
def get_insights(
    coach_level: int = 2,
    stale_lead_days: int = 7,
    stuck_deal_days: int = 14,
    db: Session = Depends(get_db)
):
    """Get pending coach insights including time-based checks."""
    service = CoachService(db, coach_level)

    # Generate any new time-based insights
    time_insights = service.get_time_based_insights(stale_lead_days, stuck_deal_days)
    for insight in time_insights:
        db.add(insight)
    if time_insights:
        db.commit()

    # Return all pending insights
    return service.get_pending_insights()


@router.post("/insights/{insight_id}/seen")
def mark_insight_seen(insight_id: int, db: Session = Depends(get_db)):
    """Mark an insight as seen."""
    service = CoachService(db)
    success = service.mark_seen(insight_id)
    return {"success": success}


@router.post("/insights/{insight_id}/dismiss")
def dismiss_insight(insight_id: int, db: Session = Depends(get_db)):
    """Dismiss an insight."""
    service = CoachService(db)
    success = service.dismiss_insight(insight_id)
    return {"success": success}
