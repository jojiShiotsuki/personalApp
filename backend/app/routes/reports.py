"""
Reports API — exposes aggregated data for the Reports page.

Each endpoint returns pre-computed metrics for a given date range,
defaulting to the last 30 days.
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.reports import ReportsService

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/overview")
def get_overview_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_overview(db, start, end)


@router.get("/revenue")
def get_revenue_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_revenue(db, start, end)


@router.get("/time")
def get_time_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_time(db, start, end)


@router.get("/pipeline")
def get_pipeline_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_pipeline(db, start, end)
