from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Task
from app.schemas.task import TaskParseRequest, TaskResponse
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
