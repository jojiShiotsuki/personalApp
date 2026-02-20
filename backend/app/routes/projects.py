from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List
from datetime import datetime, date
import json
import logging

from app.database import get_db
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskStatus
from app.models.project_template import ProjectTemplate, ProjectTemplateTask
from app.models.crm import Contact
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.task import TaskCreate, TaskResponse
from app.services.project_service import recalculate_project_progress

logger = logging.getLogger(__name__)

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
    # Batch-fetch contact names
    contact_ids = [p.contact_id for p in projects if p.contact_id]
    contact_map = {}
    if contact_ids:
        contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
        contact_map = {c.id: c.name for c in contacts}
    for project in projects:
        counts = counts_map.get(project.id, {"total": 0, "completed": 0})
        project.task_count = counts["total"]
        project.completed_task_count = counts["completed"]
        project.contact_name = contact_map.get(project.contact_id) if project.contact_id else None
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
    if project.contact_id:
        contact = db.query(Contact).filter(Contact.id == project.contact_id).first()
        project.contact_name = contact.name if contact else None
    else:
        project.contact_name = None
    return project


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(name=project.name, description=project.description, contact_id=project.contact_id, service_type=project.service_type)
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
    if db_project.contact_id:
        contact = db.query(Contact).filter(Contact.id == db_project.contact_id).first()
        db_project.contact_name = contact.name if contact else None
    else:
        db_project.contact_name = None
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
    if db_project.contact_id:
        contact = db.query(Contact).filter(Contact.id == db_project.contact_id).first()
        db_project.contact_name = contact.name if contact else None
    else:
        db_project.contact_name = None
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


@router.post("/{project_id}/auto-schedule")
def auto_schedule_tasks(project_id: int, db: Session = Depends(get_db)):
    """Use AI to intelligently assign due dates to incomplete tasks based on project deadline."""
    from app.services.gemini_service import get_client

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.deadline:
        raise HTTPException(status_code=400, detail="Project has no deadline set")

    # Get incomplete tasks
    tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.status != TaskStatus.COMPLETED,
    ).order_by(Task.created_at.asc()).all()

    if not tasks:
        raise HTTPException(status_code=400, detail="No incomplete tasks to schedule")

    today = date.today()
    deadline = project.deadline
    if deadline <= today:
        raise HTTPException(status_code=400, detail="Project deadline is in the past")

    # Build task list for AI
    task_list = []
    for t in tasks:
        task_info = {
            "id": t.id,
            "title": t.title,
            "description": t.description or "",
            "priority": t.priority.value if t.priority else "medium",
            "phase": t.phase or "",
        }
        task_list.append(task_info)

    prompt = f"""You are a project planning assistant. Given a list of tasks for a project, assign a realistic due date to each task.

Project: "{project.name}"
{f'Description: "{project.description}"' if project.description else ''}
Today's date: {today.isoformat()}
Project deadline: {deadline.isoformat()}
Available working days: {(deadline - today).days} days

Tasks to schedule:
{json.dumps(task_list, indent=2)}

Rules:
1. All due dates must be between {today.isoformat()} and {deadline.isoformat()} (inclusive)
2. Consider task complexity based on the title and description — harder tasks need more time
3. Consider task priority — urgent/high priority tasks should generally be scheduled earlier
4. If tasks have phases, keep tasks within the same phase close together chronologically
5. Spread tasks realistically — don't bunch everything at the deadline
6. Leave some buffer before the deadline for the final tasks
7. Earlier phases should have earlier dates

Return ONLY a valid JSON array where each item has "id" (the task id as integer) and "due_date" (YYYY-MM-DD format). Example:
[{{"id": 1, "due_date": "2026-02-20"}}, {{"id": 2, "due_date": "2026-02-25"}}]

Return ONLY the JSON array, no other text."""

    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = response.text.strip()

        # Clean up response — strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3].strip()

        schedule = json.loads(text)

        if not isinstance(schedule, list):
            raise ValueError("AI response was not a JSON array")

        # Build lookup
        task_map = {t.id: t for t in tasks}
        updated_count = 0

        for entry in schedule:
            task_id = entry.get("id")
            due_date_str = entry.get("due_date")
            if not task_id or not due_date_str:
                continue

            task = task_map.get(task_id)
            if not task:
                continue

            try:
                parsed_date = date.fromisoformat(due_date_str)
                # Clamp to valid range
                if parsed_date < today:
                    parsed_date = today
                if parsed_date > deadline:
                    parsed_date = deadline
                task.due_date = parsed_date
                updated_count += 1
            except ValueError:
                logger.warning(f"Invalid date '{due_date_str}' for task {task_id}")
                continue

        db.commit()

        return {
            "message": f"Scheduled {updated_count} task(s) with AI-generated deadlines",
            "updated_count": updated_count,
            "total_tasks": len(tasks),
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        raise HTTPException(status_code=500, detail="AI returned invalid scheduling data")
    except ValueError as e:
        logger.error(f"AI service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Auto-schedule failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to auto-schedule tasks")
