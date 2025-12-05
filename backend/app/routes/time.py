from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import csv
import io

from app.database import get_db
from app.models.time_entry import TimeEntry, TimeEntryCategory
from app.models.task import Task
from app.models.project import Project
from app.models.crm import Deal
from app.schemas.time_entry import (
    TimeEntryStart,
    TimeEntryCreate,
    TimeEntryUpdate,
    TimeEntryResponse,
    TimeSummary,
    TimeSummaryResponse,
    TimeEntryCategory as TimeEntryCategorySchema,
)

router = APIRouter(prefix="/api/time", tags=["time"])


# Constants
SECONDS_PER_HOUR = 3600

def ensure_utc_aware(dt):
    """Ensure datetime is UTC timezone-aware."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def enrich_time_entry(entry: TimeEntry, db: Session = None) -> dict:
    """Add related entity names and computed fields to time entry.

    If relationships are already loaded (via joinedload), no additional queries needed.
    """
    data = {
        "id": entry.id,
        "description": entry.description,
        "start_time": ensure_utc_aware(entry.start_time),
        "end_time": ensure_utc_aware(entry.end_time),
        "duration_seconds": entry.duration_seconds,
        "is_running": entry.is_running,
        "is_paused": entry.is_paused,
        "paused_duration_seconds": entry.paused_duration_seconds or 0,
        "task_id": entry.task_id,
        "project_id": entry.project_id,
        "deal_id": entry.deal_id,
        "hourly_rate": entry.hourly_rate,
        "is_billable": entry.is_billable if entry.is_billable is not None else True,
        "category": entry.category.value if entry.category else None,
        "created_at": ensure_utc_aware(entry.created_at),
        "updated_at": ensure_utc_aware(entry.updated_at),
        "task_title": None,
        "project_name": None,
        "deal_title": None,
        "billable_amount": None,
    }

    # Use pre-loaded relationships if available (no additional queries)
    if hasattr(entry, 'task') and entry.task:
        data["task_title"] = entry.task.title
    if hasattr(entry, 'project') and entry.project:
        data["project_name"] = entry.project.name
    if hasattr(entry, 'deal') and entry.deal:
        data["deal_title"] = entry.deal.title

    # Calculate billable amount (only if billable)
    if entry.duration_seconds and entry.hourly_rate and data["is_billable"]:
        hours = entry.duration_seconds / SECONDS_PER_HOUR
        data["billable_amount"] = float(entry.hourly_rate) * hours

    return data


def get_entry_with_relations(db: Session, entry_id: int = None, is_running: bool = None):
    """Get time entry with eager-loaded relationships to avoid N+1 queries."""
    query = db.query(TimeEntry).options(
        joinedload(TimeEntry.task),
        joinedload(TimeEntry.project),
        joinedload(TimeEntry.deal)
    )
    if entry_id:
        return query.filter(TimeEntry.id == entry_id).first()
    if is_running is not None:
        return query.filter(TimeEntry.is_running == is_running).first()
    return query


def get_entries_with_relations(db: Session, base_query=None):
    """Get time entries with eager-loaded relationships."""
    if base_query is None:
        base_query = db.query(TimeEntry)
    return base_query.options(
        joinedload(TimeEntry.task),
        joinedload(TimeEntry.project),
        joinedload(TimeEntry.deal)
    )


def get_hourly_rate(task_id: Optional[int], project_id: Optional[int], deal_id: Optional[int], db: Session) -> Optional[Decimal]:
    """Inherit hourly rate from deal or project"""
    if deal_id:
        deal = db.query(Deal).filter(Deal.id == deal_id).first()
        if deal and deal.hourly_rate:
            return deal.hourly_rate

    if project_id:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.hourly_rate:
            return project.hourly_rate

    return None


# ============ Timer Control ============

@router.get("/current", response_model=Optional[TimeEntryResponse])
def get_current_timer(db: Session = Depends(get_db)):
    """Get the currently running timer, if any"""
    entry = get_entry_with_relations(db, is_running=True)
    if not entry:
        return None
    return enrich_time_entry(entry)


@router.post("/start", response_model=TimeEntryResponse, status_code=201)
def start_timer(data: TimeEntryStart, db: Session = Depends(get_db)):
    """Start a new timer. Stops any existing running timer."""
    # Stop any existing running timer
    existing = db.query(TimeEntry).filter(TimeEntry.is_running == True).first()
    if existing:
        existing.is_running = False
        existing.end_time = datetime.now(timezone.utc)
        # Calculate duration
        if existing.start_time:
            start = ensure_utc_aware(existing.start_time)
            elapsed = (existing.end_time - start).total_seconds()
            existing.duration_seconds = int(elapsed - (existing.paused_duration_seconds or 0))
        existing.updated_at = datetime.now(timezone.utc)

    # Inherit hourly rate if not provided
    hourly_rate = data.hourly_rate
    if hourly_rate is None:
        hourly_rate = get_hourly_rate(data.task_id, data.project_id, data.deal_id, db)

    # Create new timer
    entry = TimeEntry(
        description=data.description,
        start_time=datetime.now(timezone.utc),
        is_running=True,
        is_paused=False,
        paused_duration_seconds=0,
        task_id=data.task_id,
        project_id=data.project_id,
        deal_id=data.deal_id,
        hourly_rate=hourly_rate,
        is_billable=data.is_billable,
        category=data.category,
    )
    db.add(entry)
    db.commit()

    # Re-fetch with relationships
    entry = get_entry_with_relations(db, entry_id=entry.id)
    return enrich_time_entry(entry)


@router.post("/stop", response_model=TimeEntryResponse)
def stop_timer(db: Session = Depends(get_db)):
    """Stop the running timer"""
    entry = db.query(TimeEntry).filter(TimeEntry.is_running == True).first()
    if not entry:
        raise HTTPException(status_code=404, detail="No running timer found")

    entry.is_running = False
    entry.is_paused = False
    entry.end_time = datetime.now(timezone.utc)

    # Calculate duration
    if entry.start_time:
        start = ensure_utc_aware(entry.start_time)
        elapsed = (entry.end_time - start).total_seconds()
        entry.duration_seconds = int(elapsed - (entry.paused_duration_seconds or 0))

    entry.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Re-fetch with relationships
    entry = get_entry_with_relations(db, entry_id=entry.id)
    return enrich_time_entry(entry)


@router.post("/pause", response_model=TimeEntryResponse)
def pause_timer(db: Session = Depends(get_db)):
    """Pause the running timer"""
    entry = db.query(TimeEntry).filter(TimeEntry.is_running == True).first()
    if not entry:
        raise HTTPException(status_code=404, detail="No running timer found")

    if entry.is_paused:
        raise HTTPException(status_code=400, detail="Timer is already paused")

    entry.is_paused = True
    # Store when we paused (using end_time temporarily)
    entry.end_time = datetime.now(timezone.utc)
    entry.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Re-fetch with relationships
    entry = get_entry_with_relations(db, entry_id=entry.id)
    return enrich_time_entry(entry)


@router.post("/resume", response_model=TimeEntryResponse)
def resume_timer(db: Session = Depends(get_db)):
    """Resume a paused timer"""
    entry = db.query(TimeEntry).filter(TimeEntry.is_running == True).first()
    if not entry:
        raise HTTPException(status_code=404, detail="No running timer found")

    if not entry.is_paused:
        raise HTTPException(status_code=400, detail="Timer is not paused")

    # Calculate how long we were paused
    if entry.end_time:
        end = ensure_utc_aware(entry.end_time)
        pause_duration = (datetime.now(timezone.utc) - end).total_seconds()
        entry.paused_duration_seconds = (entry.paused_duration_seconds or 0) + int(pause_duration)

    entry.is_paused = False
    entry.end_time = None
    entry.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Re-fetch with relationships
    entry = get_entry_with_relations(db, entry_id=entry.id)
    return enrich_time_entry(entry)


# ============ Time Entries CRUD ============

@router.get("/entries", response_model=List[TimeEntryResponse])
def list_entries(
    start_date: Optional[date] = Query(None, description="Filter entries starting from this date"),
    end_date: Optional[date] = Query(None, description="Filter entries ending on this date"),
    task_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    deal_id: Optional[int] = Query(None),
    is_billable: Optional[bool] = Query(None, description="Filter by billable status"),
    category: Optional[TimeEntryCategorySchema] = Query(None, description="Filter by category"),
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List time entries with optional filters"""
    query = db.query(TimeEntry).filter(TimeEntry.is_running == False)

    if start_date:
        query = query.filter(TimeEntry.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(TimeEntry.start_time <= datetime.combine(end_date, datetime.max.time()))
    if task_id:
        query = query.filter(TimeEntry.task_id == task_id)
    if project_id:
        query = query.filter(TimeEntry.project_id == project_id)
    if deal_id:
        query = query.filter(TimeEntry.deal_id == deal_id)
    if is_billable is not None:
        query = query.filter(TimeEntry.is_billable == is_billable)
    if category:
        query = query.filter(TimeEntry.category == category)

    # Use eager loading to avoid N+1 queries
    query = get_entries_with_relations(db, query)
    entries = query.order_by(TimeEntry.start_time.desc()).offset(offset).limit(limit).all()

    return [enrich_time_entry(e) for e in entries]


@router.post("/entries", response_model=TimeEntryResponse, status_code=201)
def create_entry(data: TimeEntryCreate, db: Session = Depends(get_db)):
    """Create a manual time entry"""
    # Calculate duration if not provided
    duration = data.duration_seconds
    if duration is None:
        duration = int((data.end_time - data.start_time).total_seconds())

    # Inherit hourly rate if not provided
    hourly_rate = data.hourly_rate
    if hourly_rate is None:
        hourly_rate = get_hourly_rate(data.task_id, data.project_id, data.deal_id, db)

    entry = TimeEntry(
        description=data.description,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_seconds=duration,
        is_running=False,
        is_paused=False,
        paused_duration_seconds=0,
        task_id=data.task_id,
        project_id=data.project_id,
        deal_id=data.deal_id,
        hourly_rate=hourly_rate,
        is_billable=data.is_billable,
        category=data.category,
    )
    db.add(entry)
    db.commit()

    # Re-fetch with relationships
    entry = get_entry_with_relations(db, entry_id=entry.id)
    return enrich_time_entry(entry)


@router.get("/entries/{entry_id}", response_model=TimeEntryResponse)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    """Get a single time entry"""
    entry = get_entry_with_relations(db, entry_id=entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return enrich_time_entry(entry)


@router.put("/entries/{entry_id}", response_model=TimeEntryResponse)
def update_entry(entry_id: int, data: TimeEntryUpdate, db: Session = Depends(get_db)):
    """Update a time entry"""
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    update_data = data.model_dump(exclude_unset=True)

    # Validate time constraints if updating times
    new_start = update_data.get('start_time', entry.start_time)
    new_end = update_data.get('end_time', entry.end_time)
    if new_start and new_end and new_end <= new_start:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")

    # Prevent setting is_running=True on completed entries (not allowed via update)
    # is_running should only be controlled via start/stop endpoints

    # Apply safe fields only
    safe_fields = {'description', 'start_time', 'end_time', 'duration_seconds',
                   'task_id', 'project_id', 'deal_id', 'hourly_rate', 'is_billable', 'category'}

    for field, value in update_data.items():
        if field in safe_fields:
            setattr(entry, field, value)

    # Recalculate duration if times changed
    if ('start_time' in update_data or 'end_time' in update_data) and 'duration_seconds' not in update_data:
        if entry.start_time and entry.end_time:
            entry.duration_seconds = int((ensure_utc_aware(entry.end_time) - ensure_utc_aware(entry.start_time)).total_seconds())

    entry.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Re-fetch with relationships
    entry = get_entry_with_relations(db, entry_id=entry.id)
    return enrich_time_entry(entry)


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    """Delete a time entry"""
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    db.delete(entry)
    db.commit()
    return None


# ============ Summaries ============

def calculate_summary(entries: List[TimeEntry]) -> TimeSummary:
    """Calculate summary statistics for a list of entries"""
    total_seconds = sum(e.duration_seconds or 0 for e in entries)
    # Only include billable entries in billable total
    total_billable = sum(
        (e.duration_seconds or 0) / SECONDS_PER_HOUR * float(e.hourly_rate or 0)
        for e in entries
        if e.is_billable and e.hourly_rate
    )
    return TimeSummary(
        total_seconds=total_seconds,
        total_hours=round(total_seconds / SECONDS_PER_HOUR, 2),
        total_billable=round(total_billable, 2),
        entry_count=len(entries),
    )


@router.get("/summary", response_model=TimeSummaryResponse)
def get_summary(db: Session = Depends(get_db)):
    """Get time summaries for today, this week, and this month"""
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), datetime.min.time())
    week_start = today_start - timedelta(days=now.weekday())
    month_start = datetime.combine(now.date().replace(day=1), datetime.min.time())

    # Get completed entries only
    base_query = db.query(TimeEntry).filter(TimeEntry.is_running == False)

    today_entries = base_query.filter(TimeEntry.start_time >= today_start).all()
    week_entries = base_query.filter(TimeEntry.start_time >= week_start).all()
    month_entries = base_query.filter(TimeEntry.start_time >= month_start).all()

    return TimeSummaryResponse(
        today=calculate_summary(today_entries),
        this_week=calculate_summary(week_entries),
        this_month=calculate_summary(month_entries),
    )


@router.get("/summary/deal/{deal_id}", response_model=TimeSummary)
def get_deal_summary(deal_id: int, db: Session = Depends(get_db)):
    """Get time summary for a specific deal"""
    entries = db.query(TimeEntry).filter(
        TimeEntry.deal_id == deal_id,
        TimeEntry.is_running == False
    ).all()
    return calculate_summary(entries)


@router.get("/summary/project/{project_id}", response_model=TimeSummary)
def get_project_summary(project_id: int, db: Session = Depends(get_db)):
    """Get time summary for a specific project"""
    entries = db.query(TimeEntry).filter(
        TimeEntry.project_id == project_id,
        TimeEntry.is_running == False
    ).all()
    return calculate_summary(entries)


@router.get("/summary/task/{task_id}", response_model=TimeSummary)
def get_task_summary(task_id: int, db: Session = Depends(get_db)):
    """Get time summary for a specific task"""
    entries = db.query(TimeEntry).filter(
        TimeEntry.task_id == task_id,
        TimeEntry.is_running == False
    ).all()
    return calculate_summary(entries)


# ============ Export ============

@router.get("/export/csv")
def export_entries_csv(
    start_date: Optional[date] = Query(None, description="Filter entries starting from this date"),
    end_date: Optional[date] = Query(None, description="Filter entries ending on this date"),
    task_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    deal_id: Optional[int] = Query(None),
    is_billable: Optional[bool] = Query(None, description="Filter by billable status"),
    category: Optional[TimeEntryCategorySchema] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db)
):
    """Export time entries to CSV format for invoicing"""
    query = db.query(TimeEntry).filter(TimeEntry.is_running == False)

    if start_date:
        query = query.filter(TimeEntry.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(TimeEntry.start_time <= datetime.combine(end_date, datetime.max.time()))
    if task_id:
        query = query.filter(TimeEntry.task_id == task_id)
    if project_id:
        query = query.filter(TimeEntry.project_id == project_id)
    if deal_id:
        query = query.filter(TimeEntry.deal_id == deal_id)
    if is_billable is not None:
        query = query.filter(TimeEntry.is_billable == is_billable)
    if category:
        query = query.filter(TimeEntry.category == category)

    # Use eager loading
    query = get_entries_with_relations(db, query)
    entries = query.order_by(TimeEntry.start_time.desc()).all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        'Date', 'Start Time', 'End Time', 'Duration (hours)', 'Description',
        'Project', 'Task', 'Deal', 'Category', 'Billable', 'Hourly Rate', 'Amount'
    ])

    # Data rows
    for entry in entries:
        enriched = enrich_time_entry(entry)
        hours = (entry.duration_seconds or 0) / SECONDS_PER_HOUR
        amount = enriched.get('billable_amount') or 0

        writer.writerow([
            entry.start_time.strftime('%Y-%m-%d') if entry.start_time else '',
            entry.start_time.strftime('%H:%M') if entry.start_time else '',
            entry.end_time.strftime('%H:%M') if entry.end_time else '',
            round(hours, 2),
            entry.description or '',
            enriched.get('project_name') or '',
            enriched.get('task_title') or '',
            enriched.get('deal_title') or '',
            entry.category.value if entry.category else '',
            'Yes' if entry.is_billable else 'No',
            float(entry.hourly_rate) if entry.hourly_rate else '',
            round(amount, 2) if amount else ''
        ])

    # Return CSV response
    output.seek(0)
    filename = f"time_entries_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
