from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Optional

from app.database import get_db
from app.services.export_service import ExportService

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/context")
def get_context_export(
    start_date: Optional[date] = Query(None, description="Start date for filtering (default: 30 days ago)"),
    end_date: Optional[date] = Query(None, description="End date for filtering (default: today)"),
    db: Session = Depends(get_db)
):
    """
    Generate comprehensive markdown context report for Claude CEO mentor.

    Includes:
    - Task summary (completed, pending, overdue)
    - CRM overview (active deals, pipeline value)
    - Recent interactions
    - Pipeline health metrics
    - Key business metrics
    """
    markdown = ExportService.generate_context_report(db, start_date, end_date)

    return {
        "markdown": markdown,
        "start_date": start_date or (date.today() - timedelta(days=30)),
        "end_date": end_date or date.today()
    }
