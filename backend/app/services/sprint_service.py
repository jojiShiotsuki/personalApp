from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import Optional, List
import json

from app.models.sprint import Sprint, SprintDay, SprintStatus, SPRINT_DAY_TASKS, WEEK_THEMES
from app.models.daily_outreach import DailyOutreachLog
from app.schemas.sprint import (
    SprintCreate,
    SprintUpdate,
    SprintResponse,
    SprintDayResponse,
    SprintDayTask,
    SprintWeekSummary,
    ToggleTaskResponse,
    UpdateNotesResponse,
)
from app.schemas.daily_outreach import DailyOutreachStatsResponse, ActivityMetric
from app.services.daily_outreach_service import get_today_stats


def create_sprint(db: Session, data: SprintCreate) -> Sprint:
    """Create a new sprint with 30 empty days (tasks added separately via Task API)."""
    # Check if there's already an active sprint
    existing = db.query(Sprint).filter(Sprint.status == SprintStatus.ACTIVE).first()
    if existing:
        raise ValueError("An active sprint already exists. Complete or abandon it first.")

    start = data.start_date or date.today()
    end = start + timedelta(days=29)  # 30 days total (0-29)

    sprint = Sprint(
        title=data.title,
        description=data.description,
        start_date=start,
        end_date=end,
        status=SprintStatus.ACTIVE,
        week_themes=json.dumps(WEEK_THEMES),
    )
    db.add(sprint)
    db.flush()  # Get the sprint ID

    # Create 30 empty sprint days (tasks will be added via Task API)
    for day_num in range(1, 31):
        week_num = min(4, (day_num - 1) // 7 + 1)
        log_date = start + timedelta(days=day_num - 1)

        sprint_day = SprintDay(
            sprint_id=sprint.id,
            day_number=day_num,
            week_number=week_num,
            log_date=log_date,
            is_complete=False,
        )
        db.add(sprint_day)

    db.commit()
    db.refresh(sprint)
    return sprint


def get_active_sprint(db: Session) -> Optional[Sprint]:
    """Get the current active sprint with days eagerly loaded."""
    return db.query(Sprint).options(
        joinedload(Sprint.days)
    ).filter(Sprint.status == SprintStatus.ACTIVE).first()


def get_sprint_by_id(db: Session, sprint_id: int) -> Optional[Sprint]:
    """Get a sprint by its ID with days eagerly loaded."""
    return db.query(Sprint).options(
        joinedload(Sprint.days)
    ).filter(Sprint.id == sprint_id).first()


def get_all_sprints(db: Session) -> List[Sprint]:
    """Get all sprints, ordered by creation date descending."""
    return db.query(Sprint).order_by(desc(Sprint.created_at)).all()


def pause_sprint(db: Session, sprint_id: int) -> Sprint:
    """Pause an active sprint."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")
    if sprint.status != SprintStatus.ACTIVE:
        raise ValueError("Can only pause an active sprint")

    sprint.status = SprintStatus.PAUSED
    db.commit()
    db.refresh(sprint)
    return sprint


def resume_sprint(db: Session, sprint_id: int) -> Sprint:
    """Resume a paused sprint."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")
    if sprint.status != SprintStatus.PAUSED:
        raise ValueError("Can only resume a paused sprint")

    # Check if there's another active sprint
    existing_active = get_active_sprint(db)
    if existing_active and existing_active.id != sprint_id:
        raise ValueError("Another sprint is already active")

    sprint.status = SprintStatus.ACTIVE
    db.commit()
    db.refresh(sprint)
    return sprint


def abandon_sprint(db: Session, sprint_id: int) -> Sprint:
    """Abandon a sprint."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")
    if sprint.status == SprintStatus.COMPLETED:
        raise ValueError("Cannot abandon a completed sprint")

    sprint.status = SprintStatus.ABANDONED
    db.commit()
    db.refresh(sprint)
    return sprint


def complete_sprint(db: Session, sprint_id: int) -> Sprint:
    """Mark a sprint as completed."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")

    sprint.status = SprintStatus.COMPLETED
    db.commit()
    db.refresh(sprint)
    return sprint


def update_sprint(db: Session, sprint_id: int, data: SprintUpdate) -> Sprint:
    """Update a sprint's details."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")

    if data.title is not None:
        sprint.title = data.title
    if data.description is not None:
        sprint.description = data.description

    db.commit()
    db.refresh(sprint)
    return sprint


def delete_sprint(db: Session, sprint_id: int) -> bool:
    """Delete a sprint and all its days."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")

    if sprint.status == SprintStatus.ACTIVE:
        raise ValueError("Cannot delete an active sprint. Pause or abandon it first.")

    # Delete all sprint days first (cascade should handle this, but being explicit)
    db.query(SprintDay).filter(SprintDay.sprint_id == sprint_id).delete()

    # Delete the sprint
    db.delete(sprint)
    db.commit()
    return True


def advance_day(db: Session, sprint_id: int) -> Sprint:
    """Advance the sprint to the next day by shifting all dates back by 1 day."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")
    if sprint.status != SprintStatus.ACTIVE:
        raise ValueError("Can only advance an active sprint")
    if sprint.current_day >= 30:
        raise ValueError("Sprint is already on day 30")

    # Shift sprint dates back by 1 day
    sprint.start_date = sprint.start_date - timedelta(days=1)
    sprint.end_date = sprint.end_date - timedelta(days=1)

    # Shift all sprint day log_dates back by 1 day
    for day in sprint.days:
        day.log_date = day.log_date - timedelta(days=1)

    db.commit()
    db.refresh(sprint)
    return sprint


def go_back_day(db: Session, sprint_id: int) -> Sprint:
    """Go back to the previous day by shifting all dates forward by 1 day."""
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise ValueError("Sprint not found")
    if sprint.status != SprintStatus.ACTIVE:
        raise ValueError("Can only go back on an active sprint")
    if sprint.current_day <= 1:
        raise ValueError("Sprint is already on day 1")

    # Shift sprint dates forward by 1 day
    sprint.start_date = sprint.start_date + timedelta(days=1)
    sprint.end_date = sprint.end_date + timedelta(days=1)

    # Shift all sprint day log_dates forward by 1 day
    for day in sprint.days:
        day.log_date = day.log_date + timedelta(days=1)

    db.commit()
    db.refresh(sprint)
    return sprint


def get_sprint_day(db: Session, sprint_id: int, day_number: int) -> Optional[SprintDay]:
    """Get a specific day within a sprint."""
    return db.query(SprintDay).filter(
        SprintDay.sprint_id == sprint_id,
        SprintDay.day_number == day_number
    ).first()


def get_today_sprint_day(db: Session, sprint: Sprint) -> Optional[SprintDay]:
    """Get today's sprint day for the given sprint."""
    today = date.today()
    return db.query(SprintDay).filter(
        SprintDay.sprint_id == sprint.id,
        SprintDay.log_date == today
    ).first()


def toggle_task(db: Session, sprint_id: int, day_number: int, task_index: int) -> ToggleTaskResponse:
    """Toggle a task's completion status."""
    sprint_day = get_sprint_day(db, sprint_id, day_number)
    if not sprint_day:
        raise ValueError("Sprint day not found")

    tasks = sprint_day.get_tasks_list()
    if task_index < 0 or task_index >= len(tasks):
        raise ValueError(f"Task index {task_index} out of range")

    # Toggle the task
    tasks[task_index]["completed"] = not tasks[task_index]["completed"]
    sprint_day.set_tasks_list(tasks)

    # Check if all tasks are complete
    sprint_day.check_completion()

    db.commit()
    db.refresh(sprint_day)

    day_response = build_sprint_day_response(db, sprint_day)

    return ToggleTaskResponse(
        day=day_response,
        task_index=task_index,
        completed=tasks[task_index]["completed"],
        message=f"Task {'completed' if tasks[task_index]['completed'] else 'uncompleted'}"
    )


def update_day_notes(db: Session, sprint_id: int, day_number: int, notes: str) -> UpdateNotesResponse:
    """Update notes for a sprint day."""
    sprint_day = get_sprint_day(db, sprint_id, day_number)
    if not sprint_day:
        raise ValueError("Sprint day not found")

    sprint_day.notes = notes
    db.commit()
    db.refresh(sprint_day)

    return UpdateNotesResponse(
        day_number=day_number,
        notes=notes,
        message="Notes updated successfully"
    )


def link_outreach_log(db: Session, sprint_day: SprintDay, outreach_log: DailyOutreachLog):
    """Link an outreach log to a sprint day."""
    sprint_day.outreach_log_id = outreach_log.id
    db.commit()


def build_sprint_day_response(db: Session, sprint_day: SprintDay) -> SprintDayResponse:
    """Build a SprintDayResponse with outreach stats if available."""
    from app.schemas.task import TaskResponse

    # Use real Task entities from the relationship
    tasks = [TaskResponse.model_validate(t) for t in sprint_day.sprint_tasks]

    # Get outreach stats for this day
    outreach_stats = None
    outreach_log = db.query(DailyOutreachLog).filter(
        DailyOutreachLog.log_date == sprint_day.log_date
    ).first()

    if outreach_log:
        outreach_stats = DailyOutreachStatsResponse(
            date=outreach_log.log_date,
            cold_emails=ActivityMetric.from_values(
                outreach_log.cold_emails_sent, outreach_log.target_cold_emails
            ),
            linkedin=ActivityMetric.from_values(
                outreach_log.linkedin_actions, outreach_log.target_linkedin
            ),
            calls=ActivityMetric.from_values(
                outreach_log.follow_up_calls, outreach_log.target_calls
            ),
            looms=ActivityMetric.from_values(
                outreach_log.loom_audits_sent, outreach_log.target_looms
            ),
            all_targets_met=outreach_log.all_targets_met,
        )

    return SprintDayResponse(
        id=sprint_day.id,
        sprint_id=sprint_day.sprint_id,
        day_number=sprint_day.day_number,
        week_number=sprint_day.week_number,
        log_date=sprint_day.log_date,
        tasks=tasks,
        is_complete=sprint_day.is_complete,
        notes=sprint_day.notes,
        outreach_log_id=sprint_day.outreach_log_id,
        outreach_stats=outreach_stats,
        created_at=sprint_day.created_at,
        updated_at=sprint_day.updated_at,
    )


def build_sprint_response(db: Session, sprint: Sprint) -> SprintResponse:
    """Build a full SprintResponse with week summaries and today's day."""
    themes = sprint.get_week_themes_list()
    current_day = sprint.current_day
    current_week = sprint.current_week

    # Build week summaries
    weeks = []
    for week_num in range(1, 5):
        week_days = [d for d in sprint.days if d.week_number == week_num]
        days_completed = sum(1 for d in week_days if d.is_complete)

        # Week 4 has 9 days (days 22-30), others have 7
        total_days = 9 if week_num == 4 else 7

        weeks.append(SprintWeekSummary(
            week_number=week_num,
            theme=themes[week_num - 1] if week_num <= len(themes) else f"Week {week_num}",
            days_completed=days_completed,
            total_days=total_days,
            is_current_week=(week_num == current_week),
        ))

    # Get today's sprint day
    today_day = get_today_sprint_day(db, sprint)
    today_response = build_sprint_day_response(db, today_day) if today_day else None

    # Build all days (sorted by day number)
    all_days = [
        build_sprint_day_response(db, day)
        for day in sorted(sprint.days, key=lambda d: d.day_number)
    ]

    return SprintResponse(
        id=sprint.id,
        title=sprint.title,
        description=sprint.description,
        start_date=sprint.start_date,
        end_date=sprint.end_date,
        status=sprint.status,
        current_day=current_day,
        current_week=current_week,
        progress_percentage=sprint.progress_percentage,
        weeks=weeks,
        today=today_response,
        days=all_days,
        created_at=sprint.created_at,
        updated_at=sprint.updated_at,
    )
