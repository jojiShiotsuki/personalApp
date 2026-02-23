"""
Reports service — aggregation queries for the Reports page.

Each static method corresponds to one tab (Overview, Revenue, Time, Pipeline).
All queries are compatible with both SQLite and PostgreSQL.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app.models.crm import Contact, Deal, DealStage
from app.models.project import Project, ProjectStatus
from app.models.task import Task
from app.models.time_entry import TimeEntry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_pg(db: Session) -> bool:
    """Return True when the database backend is PostgreSQL."""
    bind = db.get_bind()
    return bind.dialect.name == "postgresql"


def _bucket_key(is_pg: bool, column, is_monthly: bool):
    """Return a SQL expression that groups a date/datetime column by day or month."""
    if is_monthly:
        if is_pg:
            return func.to_char(column, "YYYY-MM")
        return func.strftime("%Y-%m", column)
    else:
        if is_pg:
            return func.to_char(column, "YYYY-MM-DD")
        return func.strftime("%Y-%m-%d", column)


def _prev_period(start_date: date, end_date: date):
    """Return (prev_start, prev_end) for the period immediately before the given range."""
    period_days = (end_date - start_date).days
    prev_start = start_date - timedelta(days=period_days)
    prev_end = start_date - timedelta(days=1)
    return prev_start, prev_end


def _pct_change(current: float, previous: float) -> float:
    """Percentage change from previous to current, safe against zero division."""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def _dec(val) -> float:
    """Convert a Decimal / None query result to a plain float."""
    if val is None:
        return 0.0
    return float(val)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReportsService:

    # ── Overview Tab ──────────────────────────────────────────────────────

    @staticmethod
    def get_overview(db: Session, start_date: date, end_date: date) -> Dict[str, Any]:
        pg = _is_pg(db)
        is_monthly = (end_date - start_date).days >= 90
        prev_start, prev_end = _prev_period(start_date, end_date)

        # --- Revenue (current & previous) ---
        total_revenue = _dec(
            db.query(func.coalesce(func.sum(Deal.value), 0))
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .scalar()
        )

        prev_revenue = _dec(
            db.query(func.coalesce(func.sum(Deal.value), 0))
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= prev_start,
                Deal.actual_close_date <= prev_end,
            )
            .scalar()
        )

        # --- Hours logged (current & previous) ---
        total_seconds = _dec(
            db.query(func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
            .filter(
                TimeEntry.start_time >= start_date,
                TimeEntry.start_time <= end_date,
            )
            .scalar()
        )
        hours_logged = round(total_seconds / 3600, 1)

        prev_seconds = _dec(
            db.query(func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
            .filter(
                TimeEntry.start_time >= prev_start,
                TimeEntry.start_time <= prev_end,
            )
            .scalar()
        )
        prev_hours = round(prev_seconds / 3600, 1)

        # --- Deals closed & win rate ---
        closed_won_count = (
            db.query(func.count(Deal.id))
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .scalar()
            or 0
        )

        closed_lost_count = (
            db.query(func.count(Deal.id))
            .filter(
                Deal.stage == DealStage.CLOSED_LOST,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .scalar()
            or 0
        )

        total_closed = closed_won_count + closed_lost_count
        win_rate = round((closed_won_count / total_closed) * 100, 1) if total_closed > 0 else 0.0

        # --- Active projects ---
        active_projects = (
            db.query(func.count(Project.id))
            .filter(
                Project.status.notin_([ProjectStatus.COMPLETED]),
            )
            .scalar()
            or 0
        )

        # --- Revenue by day/month ---
        bucket = _bucket_key(pg, Deal.actual_close_date, is_monthly)
        revenue_rows = (
            db.query(
                bucket.label("bucket"),
                func.coalesce(func.sum(Deal.value), 0).label("revenue"),
            )
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(bucket)
            .order_by(bucket)
            .all()
        )

        # Hours by the same buckets
        time_bucket = _bucket_key(pg, TimeEntry.start_time, is_monthly)
        hours_rows = (
            db.query(
                time_bucket.label("bucket"),
                func.coalesce(func.sum(TimeEntry.duration_seconds), 0).label("secs"),
            )
            .filter(
                TimeEntry.start_time >= start_date,
                TimeEntry.start_time <= end_date,
            )
            .group_by(time_bucket)
            .order_by(time_bucket)
            .all()
        )
        hours_map = {r.bucket: round(_dec(r.secs) / 3600, 1) for r in hours_rows}

        revenue_by_day = [
            {
                "date": r.bucket,
                "revenue": _dec(r.revenue),
                "hours": hours_map.get(r.bucket, 0.0),
            }
            for r in revenue_rows
        ]

        # --- Top clients ---
        top_clients = (
            db.query(
                Contact.name.label("name"),
                func.coalesce(func.sum(Deal.value), 0).label("revenue"),
            )
            .join(Deal, Deal.contact_id == Contact.id)
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(Contact.id, Contact.name)
            .order_by(func.sum(Deal.value).desc())
            .limit(5)
            .all()
        )

        return {
            "total_revenue": total_revenue,
            "revenue_change_pct": _pct_change(total_revenue, prev_revenue),
            "hours_logged": hours_logged,
            "hours_change_pct": _pct_change(hours_logged, prev_hours),
            "deals_closed": closed_won_count,
            "win_rate": win_rate,
            "active_projects": active_projects,
            "revenue_by_day": revenue_by_day,
            "top_clients": [
                {"name": c.name, "revenue": _dec(c.revenue)} for c in top_clients
            ],
        }

    # ── Revenue Tab ───────────────────────────────────────────────────────

    @staticmethod
    def get_revenue(db: Session, start_date: date, end_date: date) -> Dict[str, Any]:
        pg = _is_pg(db)
        is_monthly = (end_date - start_date).days >= 90

        # Revenue over time
        bucket = _bucket_key(pg, Deal.actual_close_date, is_monthly)
        revenue_over_time = (
            db.query(
                bucket.label("bucket"),
                func.coalesce(func.sum(Deal.value), 0).label("amount"),
            )
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(bucket)
            .order_by(bucket)
            .all()
        )

        # MRR trend (recurring deals)
        mrr_trend = (
            db.query(
                bucket.label("bucket"),
                func.coalesce(func.sum(Deal.recurring_amount), 0).label("amount"),
            )
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.is_recurring == True,  # noqa: E712
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(bucket)
            .order_by(bucket)
            .all()
        )

        # Revenue by client (top 10)
        revenue_by_client = (
            db.query(
                Contact.name.label("name"),
                func.coalesce(func.sum(Deal.value), 0).label("revenue"),
            )
            .join(Deal, Deal.contact_id == Contact.id)
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(Contact.id, Contact.name)
            .order_by(func.sum(Deal.value).desc())
            .limit(10)
            .all()
        )

        # Revenue by source (one-time vs recurring)
        one_time = _dec(
            db.query(func.coalesce(func.sum(Deal.value), 0))
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
                Deal.is_recurring == False,  # noqa: E712
            )
            .scalar()
        )
        recurring = _dec(
            db.query(func.coalesce(func.sum(Deal.value), 0))
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
                Deal.is_recurring == True,  # noqa: E712
            )
            .scalar()
        )

        # Average deal size over time
        avg_deal_size = (
            db.query(
                bucket.label("bucket"),
                func.coalesce(func.avg(Deal.value), 0).label("amount"),
            )
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(bucket)
            .order_by(bucket)
            .all()
        )

        # Won vs lost counts by period
        won_lost_bucket = _bucket_key(pg, Deal.actual_close_date, is_monthly)
        won_lost = (
            db.query(
                won_lost_bucket.label("bucket"),
                func.sum(case((Deal.stage == DealStage.CLOSED_WON, 1), else_=0)).label("won"),
                func.sum(case((Deal.stage == DealStage.CLOSED_LOST, 1), else_=0)).label("lost"),
            )
            .filter(
                Deal.stage.in_([DealStage.CLOSED_WON, DealStage.CLOSED_LOST]),
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(won_lost_bucket)
            .order_by(won_lost_bucket)
            .all()
        )

        return {
            "revenue_over_time": [
                {"date": r.bucket, "amount": _dec(r.amount)} for r in revenue_over_time
            ],
            "mrr_trend": [
                {"date": r.bucket, "amount": _dec(r.amount)} for r in mrr_trend
            ],
            "revenue_by_client": [
                {"name": r.name, "revenue": _dec(r.revenue)} for r in revenue_by_client
            ],
            "revenue_by_source": {"one_time": one_time, "recurring": recurring},
            "avg_deal_size": [
                {"date": r.bucket, "amount": round(_dec(r.amount), 2)} for r in avg_deal_size
            ],
            "won_vs_lost": [
                {"date": r.bucket, "won": int(r.won or 0), "lost": int(r.lost or 0)}
                for r in won_lost
            ],
        }

    # ── Time Tab ──────────────────────────────────────────────────────────

    @staticmethod
    def get_time(db: Session, start_date: date, end_date: date) -> Dict[str, Any]:
        pg = _is_pg(db)
        is_monthly = (end_date - start_date).days >= 90

        base_filter = and_(
            TimeEntry.start_time >= start_date,
            TimeEntry.start_time <= end_date,
        )

        # Total hours
        total_seconds = _dec(
            db.query(func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
            .filter(base_filter)
            .scalar()
        )
        total_hours = round(total_seconds / 3600, 2)

        # Billable amount
        billable_amount = _dec(
            db.query(
                func.coalesce(
                    func.sum(TimeEntry.duration_seconds * TimeEntry.hourly_rate / 3600),
                    0,
                )
            )
            .filter(base_filter, TimeEntry.is_billable == True)  # noqa: E712
            .scalar()
        )

        # Average hours per day
        period_days = max((end_date - start_date).days, 1)
        avg_hours_per_day = round(total_hours / period_days, 2)

        # Hours over time
        bucket = _bucket_key(pg, TimeEntry.start_time, is_monthly)
        hours_over_time = (
            db.query(
                bucket.label("bucket"),
                func.coalesce(func.sum(TimeEntry.duration_seconds), 0).label("secs"),
            )
            .filter(base_filter)
            .group_by(bucket)
            .order_by(bucket)
            .all()
        )

        # Billable split
        billable_secs = _dec(
            db.query(func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
            .filter(base_filter, TimeEntry.is_billable == True)  # noqa: E712
            .scalar()
        )
        non_billable_secs = total_seconds - billable_secs

        # Time by project (top 10)
        time_by_project = (
            db.query(
                Project.name.label("name"),
                func.coalesce(func.sum(TimeEntry.duration_seconds), 0).label("secs"),
            )
            .join(Project, TimeEntry.project_id == Project.id)
            .filter(base_filter, TimeEntry.project_id.isnot(None))
            .group_by(Project.id, Project.name)
            .order_by(func.sum(TimeEntry.duration_seconds).desc())
            .limit(10)
            .all()
        )

        # Time by category
        time_by_category = (
            db.query(
                TimeEntry.category.label("category"),
                func.coalesce(func.sum(TimeEntry.duration_seconds), 0).label("secs"),
            )
            .filter(base_filter, TimeEntry.category.isnot(None))
            .group_by(TimeEntry.category)
            .order_by(func.sum(TimeEntry.duration_seconds).desc())
            .all()
        )

        return {
            "total_hours": total_hours,
            "billable_amount": round(billable_amount, 2),
            "avg_hours_per_day": avg_hours_per_day,
            "hours_over_time": [
                {"date": r.bucket, "hours": round(_dec(r.secs) / 3600, 2)}
                for r in hours_over_time
            ],
            "billable_split": {
                "billable": round(billable_secs / 3600, 2),
                "non_billable": round(non_billable_secs / 3600, 2),
            },
            "time_by_project": [
                {"name": r.name, "hours": round(_dec(r.secs) / 3600, 2)}
                for r in time_by_project
            ],
            "time_by_category": [
                {
                    "category": r.category.value if r.category else "uncategorized",
                    "hours": round(_dec(r.secs) / 3600, 2),
                }
                for r in time_by_category
            ],
        }

    # ── Pipeline Tab ──────────────────────────────────────────────────────

    @staticmethod
    def get_pipeline(db: Session, start_date: date, end_date: date) -> Dict[str, Any]:
        pg = _is_pg(db)
        is_monthly = (end_date - start_date).days >= 90
        today = date.today()

        active_stages = [
            DealStage.LEAD,
            DealStage.PROSPECT,
            DealStage.PROPOSAL,
            DealStage.NEGOTIATION,
        ]

        # Pipeline value (sum of active deals)
        pipeline_value = _dec(
            db.query(func.coalesce(func.sum(Deal.value), 0))
            .filter(Deal.stage.in_(active_stages))
            .scalar()
        )

        # Win rate in period
        won_count = (
            db.query(func.count(Deal.id))
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .scalar()
            or 0
        )
        lost_count = (
            db.query(func.count(Deal.id))
            .filter(
                Deal.stage == DealStage.CLOSED_LOST,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .scalar()
            or 0
        )
        total_closed = won_count + lost_count
        win_rate = round((won_count / total_closed) * 100, 1) if total_closed > 0 else 0.0

        # Average days to close
        # For SQLite: julianday(actual_close_date) - julianday(created_at)
        # For PostgreSQL: EXTRACT(EPOCH FROM (actual_close_date - created_at::date)) / 86400
        if pg:
            days_expr = func.extract("epoch", Deal.actual_close_date - func.cast(Deal.created_at, Date)) / 86400
        else:
            days_expr = func.julianday(Deal.actual_close_date) - func.julianday(Deal.created_at)

        avg_days_result = (
            db.query(func.coalesce(func.avg(days_expr), 0))
            .filter(
                Deal.stage == DealStage.CLOSED_WON,
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
                Deal.actual_close_date.isnot(None),
            )
            .scalar()
        )
        avg_days_to_close = round(_dec(avg_days_result), 1)

        # Funnel — all active deals by stage
        funnel_rows = (
            db.query(
                Deal.stage.label("stage"),
                func.count(Deal.id).label("count"),
                func.coalesce(func.sum(Deal.value), 0).label("value"),
            )
            .filter(Deal.stage.in_(active_stages))
            .group_by(Deal.stage)
            .all()
        )

        # Ensure all stages appear in order
        stage_order = [DealStage.LEAD, DealStage.PROSPECT, DealStage.PROPOSAL, DealStage.NEGOTIATION]
        funnel_map = {r.stage: {"count": int(r.count), "value": _dec(r.value)} for r in funnel_rows}
        funnel = [
            {
                "stage": s.value,
                "count": funnel_map.get(s, {}).get("count", 0),
                "value": funnel_map.get(s, {}).get("value", 0.0),
            }
            for s in stage_order
        ]

        # Pipeline value over time (active deals created in period, grouped by date)
        bucket = _bucket_key(pg, Deal.created_at, is_monthly)
        pipeline_over_time = (
            db.query(
                bucket.label("bucket"),
                func.coalesce(func.sum(Deal.value), 0).label("value"),
            )
            .filter(
                Deal.stage.in_(active_stages),
                Deal.created_at >= start_date,
                Deal.created_at <= end_date,
            )
            .group_by(bucket)
            .order_by(bucket)
            .all()
        )

        # Win rate trend
        won_lost_bucket = _bucket_key(pg, Deal.actual_close_date, is_monthly)
        win_rate_rows = (
            db.query(
                won_lost_bucket.label("bucket"),
                func.sum(case((Deal.stage == DealStage.CLOSED_WON, 1), else_=0)).label("won"),
                func.sum(case((Deal.stage == DealStage.CLOSED_LOST, 1), else_=0)).label("lost"),
            )
            .filter(
                Deal.stage.in_([DealStage.CLOSED_WON, DealStage.CLOSED_LOST]),
                Deal.actual_close_date >= start_date,
                Deal.actual_close_date <= end_date,
            )
            .group_by(won_lost_bucket)
            .order_by(won_lost_bucket)
            .all()
        )

        win_rate_trend = []
        for r in win_rate_rows:
            w = int(r.won or 0)
            l = int(r.lost or 0)  # noqa: E741
            total = w + l
            rate = round((w / total) * 100, 1) if total > 0 else 0.0
            win_rate_trend.append({"date": r.bucket, "rate": rate})

        # Stalled deals — active deals not updated in 14+ days
        stale_cutoff = today - timedelta(days=14)
        stalled_query = (
            db.query(Deal)
            .filter(
                Deal.stage.in_(active_stages),
                Deal.updated_at < stale_cutoff,
            )
            .order_by(Deal.updated_at.asc())
            .all()
        )

        stalled_deals = []
        for d in stalled_query:
            days_stalled = (today - d.updated_at.date()).days if d.updated_at else 0
            stalled_deals.append(
                {
                    "id": d.id,
                    "title": d.title,
                    "stage": d.stage.value if d.stage else None,
                    "value": _dec(d.value),
                    "days_stalled": days_stalled,
                }
            )

        return {
            "pipeline_value": pipeline_value,
            "win_rate": win_rate,
            "avg_days_to_close": avg_days_to_close,
            "funnel": funnel,
            "pipeline_over_time": [
                {"date": r.bucket, "value": _dec(r.value)} for r in pipeline_over_time
            ],
            "win_rate_trend": win_rate_trend,
            "stalled_deals": stalled_deals,
        }
