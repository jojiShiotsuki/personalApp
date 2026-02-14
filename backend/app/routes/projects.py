from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskStatus
from app.models.project_template import ProjectTemplate, ProjectTemplateTask
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.task import TaskCreate, TaskResponse
from app.services.project_service import recalculate_project_progress

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    if not projects:
        return []
    project_ids = [p.id for p in projects]
    task_counts = db.query(
        Task.project_id,
        func.count(Task.id).label("total"),
        func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)).label("completed")
    ).filter(Task.project_id.in_(project_ids)).group_by(Task.project_id).all()
    counts_map = {tc.project_id: {"total": tc.total, "completed": int(tc.completed or 0)} for tc in task_counts}
    for project in projects:
        counts = counts_map.get(project.id, {"total": 0, "completed": 0})
        project.task_count = counts["total"]
        project.completed_task_count = counts["completed"]
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    task_counts = db.query(
        func.count(Task.id).label("total"),
        func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)).label("completed")
    ).filter(Task.project_id == project_id).first()
    project.task_count = task_counts.total if task_counts else 0
    project.completed_task_count = int(task_counts.completed or 0) if task_counts else 0
    return project


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(name=project.name, description=project.description)
    db.add(db_project)
    db.flush()

    task_count = 0
    if project.template_id:
        template = db.query(ProjectTemplate).filter(ProjectTemplate.id == project.template_id).first()
        if template:
            template_tasks = db.query(ProjectTemplateTask).filter(
                ProjectTemplateTask.template_id == template.id
            ).order_by(ProjectTemplateTask.order).all()
            for tt in template_tasks:
                task = Task(
                    title=tt.title,
                    description=tt.description,
                    priority=tt.priority,
                    phase=tt.phase,
                    status=TaskStatus.PENDING,
                    project_id=db_project.id,
                )
                db.add(task)
                task_count += 1

    db.commit()
    db.refresh(db_project)
    db_project.task_count = task_count
    db_project.completed_task_count = 0
    return db_project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project_update: ProjectUpdate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_project, field, value)
    # Auto-set completed_at when status changes to COMPLETED
    if "status" in update_data:
        if update_data["status"] == ProjectStatus.COMPLETED and db_project.completed_at is None:
            db_project.completed_at = datetime.utcnow()
        elif update_data["status"] != ProjectStatus.COMPLETED:
            db_project.completed_at = None
    db_project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_project)
    task_counts = db.query(
        func.count(Task.id).label("total"),
        func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)).label("completed")
    ).filter(Task.project_id == project_id).first()
    db_project.task_count = task_counts.total if task_counts else 0
    db_project.completed_task_count = int(task_counts.completed or 0) if task_counts else 0
    return db_project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(db_project)
    db.commit()
    return None


def prepare_task_for_response(task: Task) -> Task:
    if isinstance(task.recurrence_days, str):
        task.recurrence_days = task.recurrence_days.split(",") if task.recurrence_days else []
    elif task.recurrence_days is None:
        task.recurrence_days = []
    return task


@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
def get_project_tasks(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.created_at.asc()).all()
    for task in tasks:
        prepare_task_for_response(task)
    return tasks


@router.post("/{project_id}/apply-template/{template_id}", status_code=201)
def apply_template_to_project(project_id: int, template_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    template = db.query(ProjectTemplate).filter(ProjectTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template_tasks = db.query(ProjectTemplateTask).filter(
        ProjectTemplateTask.template_id == template.id
    ).order_by(ProjectTemplateTask.order).all()
    added = 0
    for tt in template_tasks:
        task = Task(
            title=tt.title,
            description=tt.description,
            priority=tt.priority,
            phase=tt.phase,
            status=TaskStatus.PENDING,
            project_id=project_id,
        )
        db.add(task)
        added += 1
    db.commit()
    recalculate_project_progress(project_id, db)
    return {"message": f"Added {added} tasks from template", "tasks_added": added}


@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=201)
def create_project_task(project_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    task_data = task.model_dump()
    task_data["project_id"] = project_id
    if task_data.get("recurrence_days"):
        task_data["recurrence_days"] = ",".join(task_data["recurrence_days"])
    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    recalculate_project_progress(project_id, db)
    return prepare_task_for_response(db_task)
