import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.services.dashboard_service import DashboardService
from app.models.task import Task, TaskStatus
from app.models.crm import Deal

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"]
)


class RescheduleRequest(BaseModel):
    days: int = 1


@router.get("/briefing")
def get_briefing(db: Session = Depends(get_db)):
    """Get AI-powered daily briefing with priorities and insights."""
    try:
        result = DashboardService.get_ai_briefing(db)
        return result
    except Exception as e:
        logger.error(f"Error in dashboard briefing: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate briefing")


@router.get("/briefing/simple")
def get_simple_briefing(db: Session = Depends(get_db)):
    """Get basic briefing without AI analysis (faster, fallback)."""
    try:
        result = DashboardService.get_briefing(db)
        return result
    except Exception as e:
        logger.error(f"Error in simple briefing: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate briefing")


# Quick action endpoints for briefing cards

@router.post("/actions/task/{task_id}/complete")
def complete_task(task_id: int, db: Session = Depends(get_db)):
    """Mark a task as completed from the briefing."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = TaskStatus.COMPLETED
    task.completed_at = date.today()
    db.commit()

    return {"success": True, "message": f"Task '{task.title}' marked as complete"}


@router.post("/actions/task/{task_id}/reschedule")
def reschedule_task(task_id: int, request: RescheduleRequest, db: Session = Depends(get_db)):
    """Reschedule a task to a future date."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    new_date = date.today() + timedelta(days=request.days)
    task.due_date = new_date
    db.commit()

    return {"success": True, "message": f"Task rescheduled to {new_date.isoformat()}"}


@router.post("/actions/deal/{deal_id}/snooze")
def snooze_deal(deal_id: int, db: Session = Depends(get_db)):
    """Snooze a deal follow-up by 3 days."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    deal.next_followup_date = date.today() + timedelta(days=3)
    db.commit()

    return {"success": True, "message": f"Deal snoozed until {deal.next_followup_date.isoformat()}"}


@router.post("/actions/deal/{deal_id}/log-followup")
def log_deal_followup(deal_id: int, db: Session = Depends(get_db)):
    """Log a follow-up and set next follow-up date."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    deal.followup_count = (deal.followup_count or 0) + 1
    deal.next_followup_date = date.today() + timedelta(days=7)
    db.commit()

    return {"success": True, "message": "Follow-up logged, next follow-up in 7 days"}
