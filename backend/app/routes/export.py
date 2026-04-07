import csv
import io
import json
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from datetime import date, datetime, timedelta
from typing import Optional

from app.database import get_db
from app.models.crm import Contact, Deal, Interaction
from app.models.task import Task
from app.models.project import Project
from app.models.outreach import OutreachProspect, OutreachCampaign
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


def _csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    """Helper to create a CSV streaming response from a list of dicts."""
    if not rows:
        output = io.StringIO()
        output.write("")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/contacts.csv")
def export_contacts_csv(db: Session = Depends(get_db)):
    """Export all contacts as CSV."""
    contacts = db.query(Contact).order_by(Contact.name).all()
    rows = [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email or "",
            "phone": c.phone or "",
            "company": c.company or "",
            "status": c.status.value if c.status else "",
            "source": c.source or "",
            "created_at": str(c.created_at) if c.created_at else "",
        }
        for c in contacts
    ]
    return _csv_response(rows, "contacts.csv")


@router.get("/deals.csv")
def export_deals_csv(db: Session = Depends(get_db)):
    """Export all deals as CSV."""
    deals = db.query(Deal).order_by(Deal.created_at.desc()).all()
    rows = [
        {
            "id": d.id,
            "title": d.title,
            "value": float(d.value) if d.value else 0,
            "stage": d.stage.value if d.stage else "",
            "probability": d.probability or 0,
            "expected_close_date": str(d.expected_close_date) if d.expected_close_date else "",
            "actual_close_date": str(d.actual_close_date) if d.actual_close_date else "",
            "is_recurring": d.is_recurring,
            "recurring_amount": float(d.recurring_amount) if d.recurring_amount else 0,
            "created_at": str(d.created_at) if d.created_at else "",
        }
        for d in deals
    ]
    return _csv_response(rows, "deals.csv")


@router.get("/tasks.csv")
def export_tasks_csv(db: Session = Depends(get_db)):
    """Export all tasks as CSV."""
    tasks = db.query(Task).order_by(Task.due_date.desc().nullslast()).all()
    rows = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description or "",
            "status": t.status.value if t.status else "",
            "priority": t.priority.value if t.priority else "",
            "due_date": str(t.due_date) if t.due_date else "",
            "completed_at": str(t.completed_at) if t.completed_at else "",
            "created_at": str(t.created_at) if t.created_at else "",
        }
        for t in tasks
    ]
    return _csv_response(rows, "tasks.csv")


def _serialize_row(obj) -> dict:
    """Convert a SQLAlchemy model instance to a JSON-safe dict."""
    mapper = inspect(type(obj))
    row = {}
    for attr in mapper.column_attrs:
        val = getattr(obj, attr.key)
        if isinstance(val, (datetime, date)):
            val = val.isoformat()
        elif hasattr(val, 'value'):
            val = val.value
        row[attr.key] = val
    return row


@router.get("/prospects.csv")
def export_prospects_csv(
    campaign_id: Optional[int] = Query(None, description="Filter by campaign ID (optional — exports all if not set)"),
    db: Session = Depends(get_db),
):
    """Export outreach prospects as CSV with ALL fields.

    If campaign_id is provided, exports only prospects for that campaign.
    Otherwise, exports every prospect across every campaign.
    """
    query = db.query(OutreachProspect).order_by(
        OutreachProspect.campaign_id,
        OutreachProspect.id,
    )
    if campaign_id is not None:
        query = query.filter(OutreachProspect.campaign_id == campaign_id)
    prospects = query.all()

    # Build a campaign_id -> campaign_name lookup so the CSV is human-readable
    campaign_ids = {p.campaign_id for p in prospects if p.campaign_id is not None}
    campaigns = (
        db.query(OutreachCampaign)
        .filter(OutreachCampaign.id.in_(campaign_ids))
        .all()
        if campaign_ids else []
    )
    campaign_name_by_id = {c.id: c.name for c in campaigns}

    rows = []
    for p in prospects:
        row = _serialize_row(p)
        # Add derived/joined fields
        row["campaign_name"] = campaign_name_by_id.get(p.campaign_id, "")
        # Flatten website_issues list into a comma-separated string for CSV friendliness
        if isinstance(row.get("website_issues"), list):
            row["website_issues"] = ", ".join(str(x) for x in row["website_issues"])
        # Flatten custom_fields dict into a JSON string
        if isinstance(row.get("custom_fields"), dict):
            row["custom_fields"] = json.dumps(row["custom_fields"])
        rows.append(row)

    filename = (
        f"prospects-campaign-{campaign_id}.csv"
        if campaign_id is not None
        else "prospects-all.csv"
    )
    return _csv_response(rows, filename)


@router.get("/backup.json")
def export_full_backup(db: Session = Depends(get_db)):
    """Export full database as JSON backup."""
    backup = {
        "exported_at": datetime.utcnow().isoformat(),
        "contacts": [_serialize_row(r) for r in db.query(Contact).all()],
        "deals": [_serialize_row(r) for r in db.query(Deal).all()],
        "interactions": [_serialize_row(r) for r in db.query(Interaction).all()],
        "tasks": [_serialize_row(r) for r in db.query(Task).all()],
        "projects": [_serialize_row(r) for r in db.query(Project).all()],
    }
    content = json.dumps(backup, indent=2, default=str)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=vertex-backup-{date.today().isoformat()}.json"},
    )
