# ClickUp-Style Project Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a ClickUp-inspired project management system with project containers, task lists, progress tracking, and Kanban board views.

**Architecture:** Extend existing Task model with optional project_id foreign key. New Project model with auto-calculated progress. Reuse existing KanbanBoard and TaskItem components for immediate drag-drop functionality.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, TypeScript, TanStack Query, @hello-pangea/dnd

---

## Phase 1: Backend Foundation

### Task 1: Create Project Model

**Files:**
- Create: `backend/app/models/project.py`
- Reference: `backend/app/models/task.py` (existing pattern)

**Step 1: Create project model file**

Create `backend/app/models/project.py`:

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class ProjectStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.TODO)
    progress = Column(Integer, default=0)  # 0-100

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', status={self.status})>"
```

**Step 2: Update Task model to link to projects**

Modify `backend/app/models/task.py`, add after the existing columns:

```python
# Add after existing columns, before __repr__
project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

# Add after existing relationships (if any), before __repr__
project = relationship("Project", back_populates="tasks")
```

**Step 3: Export Project model**

Modify `backend/app/models/__init__.py` to include:

```python
from app.models.project import Project, ProjectStatus
```

**Step 4: Verify imports work**

Run from backend directory:
```bash
cd backend
venv/Scripts/python.exe -c "from app.models.project import Project, ProjectStatus; print('Success')"
```

Expected: `Success`

**Step 5: Commit**

```bash
git add backend/app/models/project.py backend/app/models/task.py backend/app/models/__init__.py
git commit -m "feat: add Project model with task relationship"
```

---

### Task 2: Create Project Schemas

**Files:**
- Create: `backend/app/schemas/project.py`
- Reference: `backend/app/schemas/task.py` (existing pattern)

**Step 1: Create project schemas file**

Create `backend/app/schemas/project.py`:

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[ProjectStatus] = None


class ProjectResponse(ProjectBase):
    id: int
    status: ProjectStatus
    progress: int
    created_at: datetime
    updated_at: datetime
    task_count: Optional[int] = None
    completed_task_count: Optional[int] = None

    class Config:
        from_attributes = True
```

**Step 2: Export schemas**

Modify `backend/app/schemas/__init__.py` to include:

```python
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
```

**Step 3: Verify imports work**

Run from backend directory:
```bash
venv/Scripts/python.exe -c "from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse; print('Success')"
```

Expected: `Success`

**Step 4: Commit**

```bash
git add backend/app/schemas/project.py backend/app/schemas/__init__.py
git commit -m "feat: add Project Pydantic schemas"
```

---

### Task 3: Create Database Migration

**Files:**
- Create: `backend/alembic/versions/XXXX_add_projects.py` (auto-generated)
- Reference: `backend/alembic/versions/` (previous migrations)

**Step 1: Generate migration**

Run from backend directory:
```bash
cd backend
venv/Scripts/alembic.exe revision --autogenerate -m "add projects table"
```

Expected: Creates new migration file with timestamp

**Step 2: Review generated migration**

Open the newly created file in `backend/alembic/versions/`.

Verify it includes:
- `op.create_table('projects', ...)` with all columns
- `op.add_column('tasks', sa.Column('project_id', ...))`
- `op.create_foreign_key(..., 'tasks', 'projects', ['project_id'], ['id'])`

**Step 3: Run migration**

```bash
venv/Scripts/alembic.exe upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade ... -> ..., add projects table`

**Step 4: Verify database schema**

Check that tables exist:
```bash
venv/Scripts/python.exe -c "from app.database import engine; from sqlalchemy import inspect; inspector = inspect(engine); print('projects' in inspector.get_table_names()); print('project_id' in [c['name'] for c in inspector.get_columns('tasks')])"
```

Expected: `True` and `True`

**Step 5: Commit**

```bash
git add backend/alembic/versions/*.py
git commit -m "chore: add database migration for projects table"
```

---

## Phase 2: Backend API

### Task 4: Create Progress Calculation Helper

**Files:**
- Create: `backend/app/services/project_service.py`

**Step 1: Create service file with progress calculation**

Create `backend/app/services/project_service.py`:

```python
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
```

**Step 2: Verify function works**

Test manually with Python:
```bash
cd backend
venv/Scripts/python.exe -c "from app.services.project_service import recalculate_project_progress; print('Success')"
```

Expected: `Success`

**Step 3: Commit**

```bash
git add backend/app/services/project_service.py
git commit -m "feat: add progress calculation service"
```

---

### Task 5: Create Project Routes - CRUD Endpoints

**Files:**
- Create: `backend/app/routes/projects.py`
- Reference: `backend/app/routes/goals.py` (similar pattern)

**Step 1: Create basic CRUD routes**

Create `backend/app/routes/projects.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    """Get all projects with task counts"""
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()

    # Add task counts
    for project in projects:
        total_tasks = db.query(Task).filter(Task.project_id == project.id).count()
        completed_tasks = db.query(Task).filter(
            Task.project_id == project.id,
            Task.status == TaskStatus.COMPLETED
        ).count()
        project.task_count = total_tasks
        project.completed_task_count = completed_tasks

    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get a single project by ID"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Add task counts
    total_tasks = db.query(Task).filter(Task.project_id == project.id).count()
    completed_tasks = db.query(Task).filter(
        Task.project_id == project.id,
        Task.status == TaskStatus.COMPLETED
    ).count()
    project.task_count = total_tasks
    project.completed_task_count = completed_tasks

    return project


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project"""
    db_project = Project(
        name=project.name,
        description=project.description,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Add task counts (will be 0 for new project)
    db_project.task_count = 0
    db_project.completed_task_count = 0

    return db_project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing project"""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_project, field, value)

    db_project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_project)

    # Add task counts
    total_tasks = db.query(Task).filter(Task.project_id == project_id).count()
    completed_tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.status == TaskStatus.COMPLETED
    ).count()
    db_project.task_count = total_tasks
    db_project.completed_task_count = completed_tasks

    return db_project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project (cascades to tasks)"""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(db_project)
    db.commit()
    return None
```

**Step 2: Add missing import**

Add at top of file:
```python
from datetime import datetime
```

**Step 3: Commit**

```bash
git add backend/app/routes/projects.py
git commit -m "feat: add project CRUD endpoints"
```

---

### Task 6: Create Project Task Routes

**Files:**
- Modify: `backend/app/routes/projects.py` (add task endpoints)

**Step 1: Add task endpoints to projects router**

Add to `backend/app/routes/projects.py` after the delete endpoint:

```python
from app.schemas.task import TaskCreate, TaskResponse
from app.services.project_service import recalculate_project_progress


@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
def get_project_tasks(project_id: int, db: Session = Depends(get_db)):
    """Get all tasks for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(
        Task.created_at.desc()
    ).all()

    return tasks


@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=201)
def create_project_task(
    project_id: int,
    task: TaskCreate,
    db: Session = Depends(get_db)
):
    """Create a task in a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create task with project_id
    task_data = task.model_dump()
    task_data["project_id"] = project_id

    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Recalculate progress
    recalculate_project_progress(project_id, db)

    return db_task
```

**Step 2: Update imports at top of file**

Ensure these imports exist at the top:
```python
from app.schemas.task import TaskCreate, TaskResponse
from app.services.project_service import recalculate_project_progress
```

**Step 3: Commit**

```bash
git add backend/app/routes/projects.py
git commit -m "feat: add project task creation endpoints"
```

---

### Task 7: Register Project Router

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Import and register project router**

Modify `backend/app/main.py`, add import with other route imports:

```python
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects
```

**Step 2: Register router**

Add after existing router registrations (around line 38):

```python
app.include_router(projects.router)
```

**Step 3: Test that server starts**

Run from backend directory:
```bash
cd backend
timeout 5 venv/Scripts/python.exe -m uvicorn app.main:app --port 8000 2>&1 | findstr /C:"Application startup complete"
```

Expected: Should see "Application startup complete" before timeout

**Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register projects router"
```

---

### Task 8: Update Task Routes for Progress Recalculation

**Files:**
- Modify: `backend/app/routes/tasks.py`

**Step 1: Add progress recalculation to task update**

Modify `backend/app/routes/tasks.py`, add import at top:

```python
from app.services.project_service import recalculate_project_progress
```

**Step 2: Update the PUT endpoint**

Find the `update_task` function (likely around `@router.put("/{task_id}")`).

Add after the task update logic, before returning:

```python
# Recalculate project progress if task belongs to project
if db_task.project_id:
    recalculate_project_progress(db_task.project_id, db)
```

**Step 3: Commit**

```bash
git add backend/app/routes/tasks.py
git commit -m "feat: recalculate project progress on task updates"
```

---

## Phase 3: Frontend Types & API Client

### Task 9: Add Project TypeScript Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add ProjectStatus enum**

Add to `frontend/src/types/index.ts` after existing enums:

```typescript
export enum ProjectStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}
```

**Step 2: Add Project types**

Add after the enum:

```typescript
export type Project = {
  id: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  progress: number;
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_task_count?: number;
}

export type ProjectCreate = {
  name: string;
  description?: string;
}

export type ProjectUpdate = {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}
```

**Step 3: Add project_id to Task types**

Find the `Task` type definition and add:

```typescript
project_id?: number;
```

Find the `TaskCreate` type and add:

```typescript
project_id?: number;
```

**Step 4: Verify TypeScript compiles**

Run from frontend directory:
```bash
cd frontend
npm run build
```

Expected: Build succeeds with no type errors

**Step 5: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add Project TypeScript types"
```

---

### Task 10: Add Project API Client Methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add projectApi export**

Add to `frontend/src/lib/api.ts` at the end:

```typescript
export const projectApi = {
  getAll: async (): Promise<Project[]> => {
    const response = await fetch(`${API_BASE}/api/projects`);
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  },

  getById: async (id: number): Promise<Project> => {
    const response = await fetch(`${API_BASE}/api/projects/${id}`);
    if (!response.ok) throw new Error('Failed to fetch project');
    return response.json();
  },

  create: async (data: ProjectCreate): Promise<Project> => {
    const response = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create project');
    return response.json();
  },

  update: async (id: number, data: ProjectUpdate): Promise<Project> => {
    const response = await fetch(`${API_BASE}/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update project');
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/projects/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete project');
  },

  getTasks: async (projectId: number): Promise<Task[]> => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch project tasks');
    return response.json();
  },

  createTask: async (projectId: number, data: TaskCreate): Promise<Task> => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  },
};
```

**Step 2: Add imports at top**

Ensure these imports exist:
```typescript
import type { Project, ProjectCreate, ProjectUpdate } from '@/types';
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add project API client methods"
```

---

## Phase 4: Projects List Page

### Task 11: Create ProjectCard Component

**Files:**
- Create: `frontend/src/components/ProjectCard.tsx`
- Reference: `frontend/src/components/DealCard.tsx` (styling pattern)

**Step 1: Create ProjectCard component**

Create `frontend/src/components/ProjectCard.tsx`:

```typescript
import { Project, ProjectStatus } from '@/types';
import { Folder, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ProjectCardProps {
  project: Project;
}

const statusConfig = {
  [ProjectStatus.TODO]: {
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
    label: 'To Do',
  },
  [ProjectStatus.IN_PROGRESS]: {
    badge: 'bg-blue-100 text-blue-700 border-blue-300',
    label: 'In Progress',
  },
  [ProjectStatus.COMPLETED]: {
    badge: 'bg-green-100 text-green-700 border-green-300',
    label: 'Completed',
  },
};

export default function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  const getProgressColor = (progress: number) => {
    if (progress < 34) return 'bg-red-500';
    if (progress < 67) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-lg">{project.name}</h3>
        </div>
        <span
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border',
            statusConfig[project.status].badge
          )}
        >
          {statusConfig[project.status].label}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-medium">{project.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all', getProgressColor(project.progress))}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Task Count */}
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <CheckCircle2 className="w-4 h-4" />
        <span>
          {project.completed_task_count || 0} of {project.task_count || 0} tasks
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/ProjectCard.tsx
git commit -m "feat: add ProjectCard component"
```

---

### Task 12: Create ProjectModal Component

**Files:**
- Create: `frontend/src/components/ProjectModal.tsx`
- Reference: `frontend/src/components/QuickAddGoalModal.tsx` (modal pattern)

**Step 1: Create ProjectModal component**

Create `frontend/src/components/ProjectModal.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Project, ProjectCreate } from '@/types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectCreate) => void;
  project?: Project;
}

export default function ProjectModal({
  isOpen,
  onClose,
  onSubmit,
  project,
}: ProjectModalProps) {
  const [formData, setFormData] = useState<ProjectCreate>({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
      });
    } else {
      setFormData({ name: '', description: '' });
    }
  }, [project, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
    setFormData({ name: '', description: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {project ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g., Website Redesign"
              required
              maxLength={255}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows={3}
              placeholder="Optional project description"
              maxLength={2000}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!formData.name.trim()}
            >
              {project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/ProjectModal.tsx
git commit -m "feat: add ProjectModal component"
```

---

### Task 13: Create Projects Overview Page

**Files:**
- Create: `frontend/src/pages/Projects.tsx`
- Reference: `frontend/src/pages/Goals.tsx` (similar structure)

**Step 1: Create Projects page**

Create `frontend/src/pages/Projects.tsx`:

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { projectApi } from '@/lib/api';
import { ProjectCreate } from '@/types';
import ProjectCard from '@/components/ProjectCard';
import ProjectModal from '@/components/ProjectModal';
import { toast } from 'sonner';

export default function Projects() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      toast.success('Project created successfully');
    },
    onError: () => {
      toast.error('Failed to create project');
    },
  });

  const handleCreate = (data: ProjectCreate) => {
    createMutation.mutate(data);
  };

  // Filter projects by search query
  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="text-center py-12">Loading projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
```

**Step 2: Add route to app**

Modify `frontend/src/App.tsx`, add import:

```typescript
import Projects from './pages/Projects';
```

Add route in the Routes section:

```typescript
<Route path="/projects" element={<Projects />} />
```

**Step 3: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/pages/Projects.tsx frontend/src/App.tsx
git commit -m "feat: add Projects overview page"
```

---

## Phase 5: Project Detail Page

### Task 14: Create ProjectDetail Page Structure

**Files:**
- Create: `frontend/src/pages/ProjectDetail.tsx`

**Step 1: Create ProjectDetail page with tabs**

Create `frontend/src/pages/ProjectDetail.tsx`:

```typescript
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { projectApi } from '@/lib/api';
import { ProjectStatus } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'list' | 'board';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || '0');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: projectId > 0,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { status: ProjectStatus }) =>
      projectApi.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast.success('Project updated');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => projectApi.delete(projectId),
    onSuccess: () => {
      toast.success('Project deleted');
      navigate('/projects');
    },
  });

  const handleDelete = () => {
    if (
      confirm(
        `Delete "${project?.name}"? This will also delete ${project?.task_count || 0} tasks.`
      )
    ) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!project) {
    return <div className="p-6">Project not found</div>;
  }

  const statusConfig = {
    [ProjectStatus.TODO]: { label: 'To Do', color: 'text-gray-700' },
    [ProjectStatus.IN_PROGRESS]: { label: 'In Progress', color: 'text-blue-700' },
    [ProjectStatus.COMPLETED]: { label: 'Completed', color: 'text-green-700' },
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Status Selector */}
            <select
              value={project.status}
              onChange={(e) =>
                updateMutation.mutate({ status: e.target.value as ProjectStatus })
              }
              className={cn(
                'px-3 py-2 border border-gray-300 rounded-lg font-medium',
                statusConfig[project.status].color
              )}
            >
              {Object.entries(statusConfig).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              title="Delete Project"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {(['overview', 'list', 'board'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-3 border-b-2 font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'list' && <ListTab projectId={projectId} />}
        {activeTab === 'board' && <BoardTab projectId={projectId} />}
      </div>
    </div>
  );
}

// Placeholder components (will implement in next tasks)
function OverviewTab({ project }: { project: any }) {
  return <div>Overview content coming soon</div>;
}

function ListTab({ projectId }: { projectId: number }) {
  return <div>List content coming soon</div>;
}

function BoardTab({ projectId }: { projectId: number }) {
  return <div>Board content coming soon</div>;
}
```

**Step 2: Add route**

Modify `frontend/src/App.tsx`, add route:

```typescript
<Route path="/projects/:id" element={<ProjectDetail />} />
```

**Step 3: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/pages/ProjectDetail.tsx frontend/src/App.tsx
git commit -m "feat: add ProjectDetail page structure with tabs"
```

---

### Task 15: Implement Overview Tab

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx` (OverviewTab component)

**Step 1: Replace OverviewTab placeholder**

In `frontend/src/pages/ProjectDetail.tsx`, replace the `OverviewTab` function:

```typescript
function OverviewTab({ project }: { project: any }) {
  const progressColor =
    project.progress < 34 ? 'text-red-600' :
    project.progress < 67 ? 'text-yellow-600' :
    'text-green-600';

  const progressBg =
    project.progress < 34 ? 'bg-red-500' :
    project.progress < 67 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <div className="space-y-6">
      {/* Progress Circle */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-48 h-48">
              <circle
                className="text-gray-200"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
              />
              <circle
                className={progressBg.replace('bg-', 'text-')}
                strokeWidth="12"
                strokeDasharray={88 * 2 * Math.PI}
                strokeDashoffset={88 * 2 * Math.PI * (1 - project.progress / 100)}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={cn('text-4xl font-bold', progressColor)}>
                {project.progress}%
              </span>
              <span className="text-sm text-gray-500">Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Total Tasks</div>
          <div className="text-2xl font-bold">{project.task_count || 0}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {project.completed_task_count || 0}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">
            {(project.task_count || 0) - (project.completed_task_count || 0)}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Status</div>
          <div className="text-lg font-semibold capitalize">
            {project.status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Completion Message */}
      {project.progress === 100 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="font-semibold text-green-800">All tasks complete!</div>
          <div className="text-sm text-green-600">Ready to mark as completed?</div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/pages/ProjectDetail.tsx
git commit -m "feat: implement Overview tab with progress visualization"
```

---

### Task 16: Implement List Tab

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx` (ListTab component)

**Step 1: Replace ListTab placeholder**

In `frontend/src/pages/ProjectDetail.tsx`, replace the `ListTab` function (add after imports if needed):

```typescript
import TaskItem from '@/components/TaskItem';
import { taskApi } from '@/lib/api';
import { Task, TaskStatus, TaskPriority } from '@/types';
import { Plus } from 'lucide-react';

function ListTab({ projectId }: { projectId: number }) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Fetch project tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  // Group by status
  const groupedTasks = {
    pending: filteredTasks.filter((t) => t.status === TaskStatus.PENDING),
    in_progress: filteredTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
    completed: filteredTasks.filter((t) => t.status === TaskStatus.COMPLETED),
    delayed: filteredTasks.filter((t) => t.status === TaskStatus.DELAYED),
  };

  if (isLoading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="delayed">Delayed</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <button
          onClick={() => setShowAddTask(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Task Groups */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No tasks yet</p>
          <button
            onClick={() => setShowAddTask(true)}
            className="text-blue-600 hover:text-blue-700"
          >
            Add your first task
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([status, statusTasks]) => {
            if (statusTasks.length === 0) return null;
            return (
              <div key={status}>
                <h3 className="font-semibold text-lg mb-3 capitalize">
                  {status.replace('_', ' ')} ({statusTasks.length})
                </h3>
                <div className="space-y-2">
                  {statusTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal - placeholder for now */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <p>Add Task Modal - to be implemented</p>
            <button
              onClick={() => setShowAddTask(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/pages/ProjectDetail.tsx
git commit -m "feat: implement List tab with task filtering"
```

---

### Task 17: Implement Board Tab with Kanban

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx` (BoardTab component)

**Step 1: Replace BoardTab placeholder**

In `frontend/src/pages/ProjectDetail.tsx`, replace the `BoardTab` function:

```typescript
import KanbanBoard from '@/components/KanbanBoard';

function BoardTab({ projectId }: { projectId: number }) {
  // Fetch project tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500 mb-4">No tasks yet</p>
        <p className="text-sm text-gray-400">
          Add tasks to see them on the board
        </p>
      </div>
    );
  }

  return (
    <div>
      <KanbanBoard initialTasks={tasks} />
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/pages/ProjectDetail.tsx
git commit -m "feat: implement Board tab with Kanban drag-drop"
```

---

## Phase 6: Integration

### Task 18: Add Projects to Navigation

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Add Projects link to navigation**

Modify `frontend/src/components/Layout.tsx`, find the navigation links section and add:

```typescript
import { Folder } from 'lucide-react';

// Add to navigation items (around where other nav items are)
<Link
  to="/projects"
  className={cn(
    'flex items-center gap-2 px-3 py-2 rounded-lg',
    location.pathname.startsWith('/projects')
      ? 'bg-blue-50 text-blue-600'
      : 'text-gray-700 hover:bg-gray-100'
  )}
>
  <Folder className="w-5 h-5" />
  Projects
</Link>
```

**Step 2: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: add Projects to navigation"
```

---

### Task 19: Add Active Projects Widget to Dashboard

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Add projects query and widget**

Modify `frontend/src/pages/Dashboard.tsx`, add import:

```typescript
import { projectApi } from '@/lib/api';
import { ProjectStatus } from '@/types';
import { Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
```

**Step 2: Add query in component**

Inside the Dashboard component, add:

```typescript
// Fetch active projects
const { data: projects = [] } = useQuery({
  queryKey: ['projects'],
  queryFn: projectApi.getAll,
});

const activeProjects = projects.filter(
  (p) => p.status === ProjectStatus.IN_PROGRESS
).slice(0, 5);
```

**Step 3: Add widget to JSX**

Add after existing widgets:

```typescript
{/* Active Projects Widget */}
<div className="bg-white rounded-lg shadow p-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Folder className="w-5 h-5" />
      Active Projects
    </h2>
    <button
      onClick={() => navigate('/projects')}
      className="text-sm text-blue-600 hover:text-blue-700"
    >
      View All
    </button>
  </div>

  {activeProjects.length === 0 ? (
    <p className="text-gray-500 text-sm">No active projects</p>
  ) : (
    <div className="space-y-3">
      {activeProjects.map((project) => (
        <div
          key={project.id}
          onClick={() => navigate(`/projects/${project.id}`)}
          className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
        >
          <div className="font-medium mb-2">{project.name}</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">{project.progress}%</span>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

**Step 4: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

**Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: add Active Projects widget to Dashboard"
```

---

## Phase 7: Polish & Testing

### Task 20: Add Loading and Error States

**Files:**
- Modify: `frontend/src/pages/Projects.tsx`
- Modify: `frontend/src/pages/ProjectDetail.tsx`

**Step 1: Improve loading states in Projects page**

In `frontend/src/pages/Projects.tsx`, update loading section:

```typescript
{isLoading ? (
  <div className="text-center py-12">
    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
    <p className="text-gray-500">Loading projects...</p>
  </div>
) : filteredProjects.length === 0 ? (
```

**Step 2: Add error handling to mutations**

In both files, ensure mutations have error handlers with toast notifications (already added in previous tasks, verify they exist).

**Step 3: Commit**

```bash
git add frontend/src/pages/Projects.tsx frontend/src/pages/ProjectDetail.tsx
git commit -m "feat: improve loading and error states"
```

---

### Task 21: Manual Testing Checklist

**Files:**
- None (manual testing)

**Step 1: Start backend server**

```bash
cd backend
venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Keep running in background.

**Step 2: Start frontend dev server**

In new terminal:
```bash
cd frontend
npm run dev
```

**Step 3: Test project creation**

- Navigate to http://localhost:5173/projects
- Click "New Project"
- Create project with name "Test Project 1"
- Verify it appears in grid
- Click on project card
- Verify detail page loads

**Step 4: Test task creation**

- From project detail, go to List tab
- Click "Add Task" (note: modal is placeholder, may need to use existing task creation flow)
- Verify task appears
- Verify progress updates

**Step 5: Test Kanban board**

- Go to Board tab
- Drag task between columns
- Verify status updates
- Verify progress updates

**Step 6: Test project deletion**

- Click delete button
- Confirm deletion
- Verify redirect to projects list
- Verify project is gone

**Step 7: Test dashboard widget**

- Navigate to Dashboard
- Verify Active Projects widget shows in-progress projects
- Click "View All" link
- Verify navigation to projects page

**Step 8: Document any issues**

If any bugs found, create follow-up tasks.

---

### Task 22: Final Commit and Push

**Files:**
- All files

**Step 1: Check git status**

```bash
git status
```

Verify all files are committed.

**Step 2: Review commit history**

```bash
git log --oneline -20
```

Verify commits follow pattern: feat/chore/fix with descriptive messages.

**Step 3: Push to remote**

```bash
git push -u origin feature/project-management
```

Expected: Branch pushed successfully.

**Step 4: Final verification**

Verify all endpoints work:
```bash
curl http://localhost:8000/api/projects
```

Expected: Returns JSON array (empty or with projects).

---

## Implementation Complete!

**Summary:**

✅ Backend: Project model, schemas, routes, progress calculation
✅ Frontend: Projects list, project detail with 3 tabs, Kanban board
✅ Integration: Navigation, dashboard widget
✅ Reused: TaskItem, KanbanBoard components
✅ Testing: Manual testing checklist completed

**Next Steps:**

1. Consider adding task creation modal for projects
2. Add project editing (inline or modal)
3. Add task assignee field (future)
4. Add project templates (future)
5. Add project due dates (future)

**Total Implementation Time:** ~5-6 hours for experienced developer following this plan step-by-step.
