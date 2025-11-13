from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.task import Task, TaskStatus
from datetime import datetime


def recalculate_project_progress(project_id: int, db: Session) -> int:
    """
    Recalculate project progress based on completed tasks.
    Returns progress percentage (0-100).
    """
    tasks = db.query(Task).filter(Task.project_id == project_id).all()

    if not tasks:
        return 0

    completed_count = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    progress = int((completed_count / len(tasks)) * 100)

    # Update project
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.progress = progress
        project.updated_at = datetime.utcnow()
        db.commit()

    return progress
