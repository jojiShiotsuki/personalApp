from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.project_template import ProjectTemplate, ProjectTemplateTask
from app.models.project import Project
from app.models.task import Task, TaskStatus, TaskPriority
from app.schemas.project_template import ProjectTemplateCreate, ProjectTemplateResponse
from app.services.project_service import recalculate_project_progress

router = APIRouter(prefix="/api/project-templates", tags=["project-templates"])


@router.get("/", response_model=List[ProjectTemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    return db.query(ProjectTemplate).order_by(ProjectTemplate.created_at.desc()).all()


@router.get("/{template_id}", response_model=ProjectTemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(ProjectTemplate).filter(ProjectTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/", response_model=ProjectTemplateResponse, status_code=201)
def create_template(data: ProjectTemplateCreate, db: Session = Depends(get_db)):
    template = ProjectTemplate(name=data.name, description=data.description)
    db.add(template)
    db.flush()

    for i, task_data in enumerate(data.tasks):
        task = ProjectTemplateTask(
            template_id=template.id,
            title=task_data.title,
            description=task_data.description,
            priority=task_data.priority,
            order=i,
        )
        db.add(task)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(ProjectTemplate).filter(ProjectTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
    return None


@router.post("/from-project/{project_id}", response_model=ProjectTemplateResponse, status_code=201)
def create_template_from_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.created_at.asc()).all()

    template = ProjectTemplate(
        name=project.name,
        description=project.description,
    )
    db.add(template)
    db.flush()

    for i, task in enumerate(tasks):
        template_task = ProjectTemplateTask(
            template_id=template.id,
            title=task.title,
            description=task.description,
            priority=task.priority or TaskPriority.MEDIUM,
            order=i,
        )
        db.add(template_task)

    db.commit()
    db.refresh(template)
    return template
