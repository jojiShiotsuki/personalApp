import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Task
from app.schemas.task import TaskParseRequest, TaskBulkParseRequest, TaskResponse
from app.services.task_parser import TaskParser

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.post("/parse", response_model=TaskResponse, status_code=201)
def parse_and_create_task(request: TaskParseRequest, db: Session = Depends(get_db)):
    """
    Parse natural language text and create a task.

    Examples:
    - "Meeting with Sarah tomorrow at 3pm"
    - "Call John high priority"
    - "Proposal due Friday"
    """
    parsed = TaskParser.parse(request.text)

    db_task = Task(**parsed)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.post("/parse-bulk", response_model=List[TaskResponse])
def parse_and_create_bulk(
    request: TaskBulkParseRequest,
    db: Session = Depends(get_db)
):
    """
    Parse multiple task lines and create all tasks atomically.

    Handles mixed formats:
    - Bulleted lists (-, *, •)
    - Numbered lists (1., 2., 3.)
    - Plain lines

    Creates all tasks in single database transaction.
    """
    def clean_line(line: str) -> str:
        line = line.strip()
        # Remove bullet points
        line = re.sub(r'^[-*•]\s*', '', line)
        # Remove numbered list markers
        line = re.sub(r'^\d+\.\s*', '', line)
        return line.strip()

    tasks = []
    for line in request.lines:
        cleaned = clean_line(line)
        if cleaned:  # Skip empty lines
            parsed = TaskParser.parse(cleaned)
            db_task = Task(**parsed)
            tasks.append(db_task)

    if not tasks:
        raise HTTPException(
            status_code=400,
            detail="No valid tasks found in input"
        )

    # Add all to session (atomic transaction)
    db.add_all(tasks)
    db.commit()

    # Refresh all to get IDs and timestamps
    for task in tasks:
        db.refresh(task)

    return tasks
