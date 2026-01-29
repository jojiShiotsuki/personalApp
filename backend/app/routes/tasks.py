from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.task import Task, TaskStatus, TaskPriority
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.services.project_service import recalculate_project_progress
from app.services.recurrence_service import create_all_future_occurrences
from app.services.activity_service import log_activity

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def prepare_task_for_response(task: Task) -> Task:
    """Convert task fields for API response (handles recurrence_days string to list)"""
    if isinstance(task.recurrence_days, str):
        task.recurrence_days = task.recurrence_days.split(",") if task.recurrence_days else []
    elif task.recurrence_days is None:
        task.recurrence_days = []
    return task


@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    goal_id: Optional[int] = Query(None, description="Filter tasks by goal ID"),
    project_id: Optional[int] = Query(None, description="Filter tasks by project ID"),
    search: Optional[str] = Query(None, description="Search in task title"),
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """Get all tasks with optional filtering"""
    query = db.query(Task)

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if goal_id is not None:
        query = query.filter(Task.goal_id == goal_id)
    if project_id is not None:
        query = query.filter(Task.project_id == project_id)
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    tasks = query.offset(skip).limit(limit).all()

    for task in tasks:
        prepare_task_for_response(task)

    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a single task by ID"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return prepare_task_for_response(task)


@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task, and if it's recurring, create future occurrences"""
    task_data = task.model_dump()

    # Handle recurrence_days list to string conversion for DB storage
    if task_data.get("recurrence_days"):
        task_data["recurrence_days"] = ",".join(task_data["recurrence_days"])

    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # If this is a recurring task, create future occurrences
    if db_task.is_recurring:
        create_all_future_occurrences(db_task, db)
        db.refresh(db_task)
    # Log activity
    log_activity(db, "task_created", "task", db_task.id, {
        "priority": db_task.priority.value if db_task.priority else None,
        "has_due_date": db_task.due_date is not None
    })

    return prepare_task_for_response(db_task)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    """Update an existing task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_update.model_dump(exclude_unset=True)

    # Handle recurrence_days list to string conversion for DB storage
    if "recurrence_days" in update_data:
        if update_data["recurrence_days"]:
            update_data["recurrence_days"] = ",".join(update_data["recurrence_days"])
        else:
            update_data["recurrence_days"] = None

    # If status changed to completed, set completed_at
    if "status" in update_data and update_data["status"] == TaskStatus.COMPLETED:
        update_data["completed_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(db_task, field, value)

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)

    # Log activity if task was completed
    if "status" in update_data and update_data["status"] == TaskStatus.COMPLETED:
        days_to_complete = None
        if db_task.created_at:
            days_to_complete = (datetime.utcnow() - db_task.created_at).days
        log_activity(db, "task_completed", "task", task_id, {
            "priority": db_task.priority.value if db_task.priority else None,
            "days_to_complete": days_to_complete
        })
    # Recalculate project progress if task belongs to project
    if db_task.project_id:
        recalculate_project_progress(db_task.project_id, db)

    return prepare_task_for_response(db_task)


@router.post("/bulk-delete", status_code=200)
def bulk_delete_tasks(task_ids: List[int], db: Session = Depends(get_db)):
    """Delete multiple tasks by their IDs"""
    if not task_ids:
        raise HTTPException(status_code=400, detail="No task IDs provided")

    tasks = db.query(Task).filter(Task.id.in_(task_ids)).all()

    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found with the provided IDs")

    deleted_count = len(tasks)

    for task in tasks:
        db.delete(task)

    db.commit()

    return {"deleted_count": deleted_count, "message": f"Successfully deleted {deleted_count} task(s)"}


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(db_task)
    db.commit()
    return None


@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    status: TaskStatus,
    db: Session = Depends(get_db)
):
    """Update only the status of a task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    db_task.status = status
    if status == TaskStatus.COMPLETED:
        db_task.completed_at = datetime.utcnow()

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)

    return prepare_task_for_response(db_task)


@router.put("/{task_id}/update-all-recurring", response_model=dict)
def update_all_recurring_tasks(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db)
):
    """Update a recurring task and all its related tasks (parent and children)"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Find all related recurring tasks
    related_task_ids = []

    # If this task has a parent, get the parent and all siblings
    if db_task.parent_task_id:
        parent_id = db_task.parent_task_id
        # Get parent task
        related_task_ids.append(parent_id)
        # Get all sibling tasks (tasks with same parent)
        siblings = db.query(Task).filter(Task.parent_task_id == parent_id).all()
        related_task_ids.extend([s.id for s in siblings])
    else:
        # This is the parent task, get all children
        related_task_ids.append(db_task.id)
        children = db.query(Task).filter(Task.parent_task_id == db_task.id).all()
        related_task_ids.extend([c.id for c in children])

    # Remove duplicates
    related_task_ids = list(set(related_task_ids))

    update_data = task_update.model_dump(exclude_unset=True)

    # Handle recurrence_days list to string conversion for DB storage
    if "recurrence_days" in update_data:
        if update_data["recurrence_days"]:
            update_data["recurrence_days"] = ",".join(update_data["recurrence_days"])
        else:
            update_data["recurrence_days"] = None

    # Fields to apply to all tasks (exclude date-specific fields for children)
    shared_fields = ["title", "description", "priority", "project_id", "goal_id", "due_time"]

    updated_count = 0
    for tid in related_task_ids:
        task = db.query(Task).filter(Task.id == tid).first()
        if task:
            for field in shared_fields:
                if field in update_data:
                    setattr(task, field, update_data[field])
            task.updated_at = datetime.utcnow()
            updated_count += 1

    db.commit()

    return {
        "updated_count": updated_count,
        "message": f"Successfully updated {updated_count} recurring task(s)"
    }


@router.delete("/{task_id}/delete-all-recurring", response_model=dict)
def delete_all_recurring_tasks(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Delete a recurring task and all its related tasks (parent and children)"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Find all related recurring tasks
    related_task_ids = []

    # If this task has a parent, get the parent and all siblings
    if db_task.parent_task_id:
        parent_id = db_task.parent_task_id
        # Get parent task
        related_task_ids.append(parent_id)
        # Get all sibling tasks (tasks with same parent)
        siblings = db.query(Task).filter(Task.parent_task_id == parent_id).all()
        related_task_ids.extend([s.id for s in siblings])
    else:
        # This is the parent task, get all children
        related_task_ids.append(db_task.id)
        children = db.query(Task).filter(Task.parent_task_id == db_task.id).all()
        related_task_ids.extend([c.id for c in children])

    # Remove duplicates
    related_task_ids = list(set(related_task_ids))

    # Delete all related tasks
    deleted_count = 0
    for tid in related_task_ids:
        task = db.query(Task).filter(Task.id == tid).first()
        if task:
            db.delete(task)
            deleted_count += 1

    db.commit()

    return {
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} recurring task(s)"
    }
