from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.task import Task, TaskStatus, TaskPriority
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.services.project_service import recalculate_project_progress
from app.services.recurrence_service import create_all_future_occurrences

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
