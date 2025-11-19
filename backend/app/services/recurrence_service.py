"""Service for handling recurring task logic."""
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from typing import Optional

from app.models.task import Task, TaskStatus, RecurrenceType


def calculate_next_due_date(
    current_due_date: date,
    recurrence_type: RecurrenceType,
    interval: int = 1,
    recurrence_days: Optional[str] = None
) -> date:
    """Calculate the next due date based on recurrence type and interval."""
    if recurrence_type == RecurrenceType.DAILY:
        return current_due_date + timedelta(days=interval)
    elif recurrence_type == RecurrenceType.WEEKLY:
        if recurrence_days:
            # Map days to integers (0=Monday, 6=Sunday)
            day_map = {
                "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6
            }
            target_days = sorted([day_map[d] for d in recurrence_days.split(",") if d in day_map])
            
            if not target_days:
                return current_due_date + timedelta(weeks=interval)
                
            current_weekday = current_due_date.weekday()
            
            # Find next day in the same week
            for day in target_days:
                if day > current_weekday:
                    days_ahead = day - current_weekday
                    return current_due_date + timedelta(days=days_ahead)
            
            # If no day left in this week, go to the first day of the next interval
            # If interval is 1, it's next week. If 2, it's 2 weeks from the start of this week?
            # Usually "Every 2 weeks" means skip a week.
            # So we find the first target day in the next cycle.
            
            # Calculate days to the first target day in the next interval
            # First, get to the start of the next interval week (Monday)
            # Days to next Monday = 7 - current_weekday
            # Then add weeks for interval - 1 (since we are already moving to next week)
            # Then add the first target day offset
            
            days_to_next_monday = 7 - current_weekday
            weeks_to_skip = interval - 1
            days_offset = days_to_next_monday + (weeks_to_skip * 7) + target_days[0]
            
            return current_due_date + timedelta(days=days_offset)
            
        return current_due_date + timedelta(weeks=interval)
    elif recurrence_type == RecurrenceType.MONTHLY:
        return current_due_date + relativedelta(months=interval)
    elif recurrence_type == RecurrenceType.YEARLY:
        return current_due_date + relativedelta(years=interval)
    else:
        raise ValueError(f"Unknown recurrence type: {recurrence_type}")


def should_create_next_occurrence(task: Task) -> bool:
    """Check if we should create the next occurrence of a recurring task."""
    if not task.is_recurring:
        return False

    # Check if we've reached the maximum occurrences
    if task.recurrence_count is not None:
        if task.occurrences_created >= task.recurrence_count:
            return False

    # Check if we've passed the end date
    if task.recurrence_end_date is not None:
        if task.due_date and task.due_date >= task.recurrence_end_date:
            return False

    return True


def create_next_occurrence(task: Task, db: Session) -> Optional[Task]:
    """Create the next occurrence of a recurring task."""
    if not should_create_next_occurrence(task):
        return None

    if not task.due_date or not task.recurrence_type:
        return None

    # Calculate next due date
    next_due_date = calculate_next_due_date(
        task.due_date,
        task.recurrence_type,
        task.recurrence_interval or 1,
        task.recurrence_days
    )

    # Check if next due date exceeds end date
    if task.recurrence_end_date and next_due_date > task.recurrence_end_date:
        return None

    # Create new task instance
    new_task = Task(
        title=task.title,
        description=task.description,
        due_date=next_due_date,
        due_time=task.due_time,
        priority=task.priority,
        status=TaskStatus.PENDING,
        goal_id=task.goal_id,
        project_id=task.project_id,
        # Link to parent recurring task
        parent_task_id=task.id,
        # Don't copy recurrence settings to child tasks
        is_recurring=False,
    )

    db.add(new_task)

    # Update occurrences counter on parent task
    task.occurrences_created += 1

    db.commit()
    db.refresh(new_task)

    return new_task


def create_all_future_occurrences(task: Task, db: Session) -> int:
    """Create all future occurrences of a recurring task up to the limit.

    This is useful when creating a new recurring task - it will generate
    all occurrences up front instead of creating them one at a time.

    Returns the number of occurrences created.
    """
    if not task.is_recurring or not task.due_date or not task.recurrence_type:
        return 0

    created_count = 0
    current_date = task.due_date
    max_iterations = task.recurrence_count or 100  # Safety limit

    for i in range(max_iterations):
        if not should_create_next_occurrence(task):
            break

        next_date = calculate_next_due_date(
            current_date,
            task.recurrence_type,
            task.recurrence_interval or 1,
            task.recurrence_days
        )

        # Check if next date exceeds end date
        if task.recurrence_end_date and next_date > task.recurrence_end_date:
            break

        # Create the occurrence
        new_task = Task(
            title=task.title,
            description=task.description,
            due_date=next_date,
            due_time=task.due_time,
            priority=task.priority,
            status=TaskStatus.PENDING,
            goal_id=task.goal_id,
            project_id=task.project_id,
            parent_task_id=task.id,
            is_recurring=False,
        )

        db.add(new_task)
        task.occurrences_created += 1
        created_count += 1
        current_date = next_date

    if created_count > 0:
        db.commit()

    return created_count
