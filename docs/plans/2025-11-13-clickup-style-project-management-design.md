# ClickUp-Style Project Management System - Design Document

**Date:** November 13, 2025
**Status:** Design Approved
**Author:** Claude (Brainstorming Skill)

## Overview

A ClickUp-inspired project management module for tracking projects with task lists, progress indicators, and board/list views. Projects are containers for tasks with automatic progress calculation and drag-drop status management.

## Goals

- Create and manage projects with clean, modern UI
- Track project progress automatically based on task completion (0-100%)
- Provide multiple views: overview grid, list view, and Kanban board
- Leverage existing Task infrastructure and components
- Maintain separation between personal tasks and project tasks
- Responsive design for mobile and desktop

## Architecture Decision

**Chosen Approach:** Standalone Projects + Link Existing Tasks

**Rationale:**
- Reuses existing Task model, routes, and components (TaskItem, KanbanBoard)
- Clean separation: personal tasks (project_id=NULL) vs project tasks
- Minimal new code - extends what already works
- ClickUp works this way - projects are collections of tasks
- KanbanBoard component provides drag-drop for free

**Structure:**
```
Project (container)
  ↓
Task (existing model + project_id foreign key)
```

## Database Schema

### New Project Model

**File:** `backend/app/models/project.py`

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum
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

    # Progress tracking (0-100, calculated from task completion)
    progress = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', status={self.status})>"
```

**Key Design Choices:**
- Simple 3-status enum (todo, in_progress, completed) - expandable later
- `progress` denormalized for performance (recalculated on task updates)
- `cascade="all, delete-orphan"` - deleting project removes its tasks
- Minimal fields for MVP - can add due dates, budgets, etc. later

### Modified Task Model

**File:** `backend/app/models/task.py`

**Add these fields to existing Task class:**
```python
# Add to existing Task model
project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

# Add relationship
project = relationship("Project", back_populates="tasks")
```

**Key Design Choices:**
- `project_id` is optional (nullable=True) - supports personal tasks
- No other changes to Task model - keeps existing priority, status, due dates
- Reuses TaskPriority, TaskStatus enums

## API Endpoints

### Project Routes

**File:** `backend/app/routes/projects.py`

```
GET    /api/projects                    # List all projects
GET    /api/projects/{id}               # Get project with task counts
POST   /api/projects                    # Create new project
PUT    /api/projects/{id}               # Update project
DELETE /api/projects/{id}               # Delete project (cascades to tasks)
PATCH  /api/projects/{id}/status        # Update just status

# Project-task operations
GET    /api/projects/{id}/tasks         # Get all tasks for a project
POST   /api/projects/{id}/tasks         # Create task in project
```

**Response Format for GET /api/projects:**
```json
[
  {
    "id": 1,
    "name": "Website Redesign",
    "description": "Redesign company website",
    "status": "in_progress",
    "progress": 45,
    "created_at": "2025-11-13T10:00:00",
    "updated_at": "2025-11-13T12:00:00",
    "task_count": 20,
    "completed_task_count": 9
  }
]
```

### Modified Task Routes

**File:** `backend/app/routes/tasks.py`

```
# Add filtering to existing GET /api/tasks
GET    /api/tasks?project_id={id}       # Filter tasks by project
GET    /api/tasks?project_id=null       # Get personal tasks only
```

No other changes to task routes needed.

### Progress Calculation Logic

**Implementation:** Helper function called on task status changes

```python
def recalculate_project_progress(project_id: int, db: Session) -> int:
    """
    Recalculate project progress based on task completion.
    Returns progress percentage (0-100).
    """
    tasks = db.query(Task).filter(Task.project_id == project_id).all()

    if not tasks:
        return 0

    completed_count = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    progress = int((completed_count / len(tasks)) * 100)

    # Update project
    project = db.query(Project).filter(Project.id == project_id).first()
    project.progress = progress
    project.updated_at = datetime.utcnow()
    db.commit()

    return progress
```

**Trigger Points:**
- After creating task in project
- After updating task status
- After deleting task from project

**Integration in Task Update Route:**
```python
@router.put("/{task_id}")
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    # ... existing update logic ...

    # If task has project_id, recalculate progress
    if db_task.project_id:
        recalculate_project_progress(db_task.project_id, db)

    return db_task
```

## Frontend Architecture

### New Pages

#### 1. Projects Overview Page (`/projects`)

**File:** `frontend/src/pages/Projects.tsx`

**Features:**
- Grid layout of project cards (3 columns desktop, 2 tablet, 1 mobile)
- Each ProjectCard displays:
  - Project name (bold, 20px)
  - Description preview (truncated, gray text)
  - Status badge (colored: gray/blue/green)
  - Progress bar with percentage label
  - Task count: "X of Y tasks completed"
- "New Project" button (top-right, primary color)
- Search bar (filter by name/description)
- Click card → navigate to `/projects/{id}`

**Component Structure:**
```
Projects.tsx
├── SearchBar (filter projects)
├── NewProjectButton
├── ProjectGrid
│   └── ProjectCard (reuse DealCard styling patterns)
└── ProjectModal (create/edit form)
```

**ProjectCard Component:**
- White card with shadow
- Hover effect: elevate slightly
- Status badge positioning: top-right
- Progress bar at bottom
- Click handler navigates to detail page

#### 2. Project Detail Page (`/projects/{id}`)

**File:** `frontend/src/pages/ProjectDetail.tsx`

**Features:**
- Header section:
  - Project name (editable inline)
  - Description (editable inline)
  - Status selector (dropdown: todo/in_progress/completed)
  - Back button to projects list
  - Delete button (with confirmation)

- Tabbed interface:
  1. **Overview Tab** - Summary and stats
  2. **List Tab** - Traditional task list
  3. **Board Tab** - Kanban drag-drop view

**Overview Tab:**
- Large progress circle chart (center)
- Quick stats cards (grid):
  - Total tasks
  - Completed tasks
  - In progress tasks
  - Pending tasks
- Recent activity (last 5 task updates)
- "Add Task" button

**List Tab:**
- Filters:
  - Priority dropdown (All/High/Medium/Low/Urgent)
  - Status dropdown (All/Pending/In Progress/Completed/Delayed)
  - Sort by: Due Date / Priority / Status
- Task list using existing TaskItem component
- Group by status (collapsible sections)
- "Add Task" button
- Inline task editing

**Board Tab:**
- Three columns: To Do | In Progress | Completed
- Reuse existing KanbanBoard component
- Point to project tasks: `?project_id={id}`
- Drag-drop between columns updates status
- Smooth animations
- Add task button in each column

**Component Structure:**
```
ProjectDetail.tsx
├── ProjectHeader
│   ├── NameEditor (inline editing)
│   ├── DescriptionEditor
│   ├── StatusSelector
│   └── ActionButtons (delete)
├── Tabs (shadcn/ui Tabs component)
│   ├── OverviewTab
│   │   ├── ProgressChart (circular progress)
│   │   ├── StatsGrid
│   │   └── RecentActivity
│   ├── ListTab
│   │   ├── TaskFilters
│   │   ├── TaskList (grouped by status)
│   │   │   └── TaskItem (existing component - reuse as-is)
│   │   └── AddTaskButton
│   └── BoardTab
│       └── KanbanBoard (existing component - just filter by project_id)
└── TaskModal (existing - add project_id field)
```

### Modified Pages

#### Dashboard Page

**File:** `frontend/src/pages/Dashboard.tsx`

**Changes:**
- Add "Active Projects" widget below existing widgets
- Display:
  - Count of in-progress projects
  - List of 3-5 most recent active projects
  - Progress bars for each
  - "View All" link to `/projects`

#### Tasks Page

**File:** `frontend/src/pages/Tasks.tsx`

**Changes:**
- Add filter toggle: "Show project tasks"
- Default: OFF (shows only personal tasks where project_id IS NULL)
- When ON: shows all tasks including project tasks
- Project tasks display project name badge

### Modified Components

#### TaskItem

**File:** `frontend/src/components/TaskItem.tsx`

**Changes:**
- If task.project_id exists, show project badge
- Badge links to `/projects/{project_id}`
- Small gray badge next to task title

#### TaskModal

**File:** `frontend/src/components/TaskModal.tsx` (or create TaskForm)

**Changes:**
- Add optional "Project" dropdown field
- Only show when creating/editing from project context
- When set, task is linked to project

## Data Flow

### Creating a Project

```
1. User clicks "New Project" on /projects
2. ProjectModal opens
3. User fills form:
   - Name (required)
   - Description (optional)
4. Submit → POST /api/projects
5. Backend creates project with progress=0
6. Returns project object
7. Frontend navigates to /projects/{id} (Overview tab)
8. User can add tasks
```

### Adding Tasks to Project

```
1. From project detail page, click "Add Task"
2. TaskModal opens with project_id pre-filled (hidden)
3. User fills task details (title, priority, due date, etc.)
4. Submit → POST /api/projects/{id}/tasks
5. Backend creates task with project_id set
6. Recalculates project progress
7. Returns task + updated progress
8. Frontend invalidates project query
9. UI updates task list and progress bar
```

### Drag-Drop Status Change (Board View)

```
1. User drags task from "To Do" column to "In Progress"
2. KanbanBoard onDragEnd handler fires
3. Frontend: PUT /api/tasks/{id} with status="in_progress"
4. Backend:
   - Updates task.status
   - Calls recalculate_project_progress(project_id)
   - Returns updated task
5. Frontend:
   - React Query invalidates ['tasks'] and ['projects', id]
   - UI updates both board and progress bar
6. Smooth animation completes
```

### Progress Updates

```
Trigger: Any task status change to/from COMPLETED

1. Task status changes (via drag-drop, checkbox, or edit)
2. Backend updates task
3. Backend calls recalculate_project_progress(project_id)
4. Calculation:
   - Count total tasks in project
   - Count completed tasks
   - Calculate percentage: (completed / total) * 100
   - Update project.progress
5. Frontend React Query invalidates project query
6. Progress bar animates to new value
7. If 100%, show celebration message
```

## TypeScript Types

**File:** `frontend/src/types/index.ts`

```typescript
export enum ProjectStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export type Project = {
  id: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  progress: number;  // 0-100
  created_at: string;
  updated_at: string;

  // Computed fields (from backend)
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

// Extend existing Task type (add these fields)
export type Task = {
  // ...all existing fields (id, title, description, priority, status, etc.)...
  project_id?: number;
  project?: Project;  // Populated relation (optional)
}

export type TaskCreate = {
  // ...all existing fields...
  project_id?: number;
}

export type TaskUpdate = {
  // ...all existing fields...
  project_id?: number;
}
```

**Note:** Minimal changes to existing Task types - just add optional project_id.

## API Client Methods

**File:** `frontend/src/lib/api.ts`

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

## Validation Rules

### Backend (Pydantic Schemas)

**File:** `backend/app/schemas/project.py`

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[ProjectStatus] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: ProjectStatus
    progress: int
    created_at: datetime
    updated_at: datetime
    task_count: Optional[int] = None
    completed_task_count: Optional[int] = None

    class Config:
        from_attributes = True
```

### Frontend (Form Validation)

- Project name: Required, 1-255 characters
- Description: Optional, max 2000 characters
- Status: Required, default "todo"
- Show error messages inline below fields
- Disable submit button until valid

## Error Handling & Edge Cases

### 1. Deleting Project

**Scenario:** User deletes project

**Solution:**
- Show confirmation modal: "Delete '{name}'? This will also delete X tasks."
- User confirms → DELETE /api/projects/{id}
- Backend cascade deletes all tasks (SQLAlchemy handles)
- Frontend: Navigate back to /projects, show toast "Project deleted"

### 2. Project with No Tasks

**Scenario:** New project has no tasks yet

**Solution:**
- Progress shows 0%
- Overview tab shows: "No tasks yet. Add your first task to get started."
- Board/List tabs show empty state with "Add Task" button
- Friendly illustration/icon for empty state

### 3. All Tasks Completed

**Scenario:** User completes last task in project

**Solution:**
- Progress updates to 100%
- Show celebration message: "All tasks complete! 🎉"
- Suggest: "Mark project as completed?" with button
- Button updates status to COMPLETED

### 4. Moving Task Between Projects

**Scenario:** User wants to move task from one project to another

**Solution:**
- Edit task, change project dropdown
- Save → PUT /api/tasks/{id} with new project_id
- Backend recalculates progress for BOTH old and new projects
- Frontend invalidates both project queries

### 5. Converting Personal Task to Project Task

**Scenario:** User wants to add existing personal task to project

**Solution:**
- From task detail/edit, show "Add to Project" dropdown
- Select project → updates project_id from NULL to project ID
- Task moves from personal list to project
- Project progress recalculates

### 6. Removing Task from Project

**Scenario:** User wants to convert project task to personal task

**Solution:**
- Edit task, select "None" in project dropdown
- Save → updates project_id to NULL
- Task becomes personal
- Project progress recalculates

### 7. Network Errors

**Scenario:** API call fails

**Solution:**
- Show error toast with message
- Keep form data intact for retry
- Retry button in toast
- Use React Query's error handling and retry logic

## UI/UX Design

### ClickUp-Inspired Styling

**Color Scheme:**
- Primary action: Blue (#3b82f6)
- Success/Completed: Green (#10b981)
- Warning/In Progress: Blue (#3b82f6)
- Neutral/Todo: Gray (#6b7280)
- Danger/Delete: Red (#ef4444)

**Project Card Design:**
- White background (#ffffff)
- Border: 1px solid #e5e7eb
- Border radius: 8px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Hover: Shadow increases to 0 4px 6px rgba(0,0,0,0.1)
- Padding: 20px
- Transition: all 0.2s ease

**Progress Bar:**
- Height: 8px
- Background: #e5e7eb
- Fill: Gradient based on progress
  - 0-33%: Red (#ef4444)
  - 34-66%: Yellow (#f59e0b)
  - 67-100%: Green (#10b981)
- Border radius: 4px
- Smooth animation on value change

**Status Badges:**
- Todo: bg-gray-100, text-gray-700, border-gray-300
- In Progress: bg-blue-100, text-blue-700, border-blue-300
- Completed: bg-green-100, text-green-700, border-green-300
- Padding: 4px 12px
- Border radius: 12px (pill shape)
- Font size: 12px
- Font weight: 500

**Board View (Kanban):**
- Column background: #f9fafb
- Column border: 1px solid #e5e7eb
- Column header: Bold, uppercase, small font
- Card spacing: 12px between cards
- Drag overlay: 50% opacity
- Drop zone highlight: Blue border, blue background tint

**Responsive Breakpoints:**
- Desktop: > 1024px (3 columns)
- Tablet: 768-1023px (2 columns)
- Mobile: < 768px (1 column, stack)

### Animations

- Card hover: transform scale(1.02), 200ms ease
- Progress bar fill: transition width 500ms ease
- Status badge change: fade out/in, 300ms
- Modal open/close: fade + scale, 200ms
- Drag-drop: smooth movement, 300ms ease

## Component Reuse

### Existing Components to Reuse

1. **TaskItem** (`frontend/src/components/TaskItem.tsx`)
   - Use as-is in List tab
   - Shows task with checkbox, priority, due date
   - Click to edit

2. **KanbanBoard** (`frontend/src/components/KanbanBoard.tsx`)
   - Use as-is in Board tab
   - Just filter by project_id
   - Already handles drag-drop

3. **TaskList** (`frontend/src/components/TaskList.tsx`)
   - Use in List tab for grouping

4. **DealCard** styling patterns
   - Adapt for ProjectCard
   - Similar layout: title, badge, progress, footer

5. **Layout** (`frontend/src/components/Layout.tsx`)
   - Add "Projects" to navigation

## Database Migration

**File:** `backend/alembic/versions/XXXX_add_projects_table.py`

**Migration Steps:**
```python
def upgrade():
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('todo', 'in_progress', 'completed', name='projectstatus'), nullable=False),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_projects_id'), 'projects', ['id'], unique=False)

    # Add project_id to tasks table
    op.add_column('tasks', sa.Column('project_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_tasks_project_id', 'tasks', 'projects', ['project_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_tasks_project_id'), 'tasks', ['project_id'], unique=False)

def downgrade():
    # Remove foreign key and column from tasks
    op.drop_constraint('fk_tasks_project_id', 'tasks', type_='foreignkey')
    op.drop_index(op.f('ix_tasks_project_id'), table_name='tasks')
    op.drop_column('tasks', 'project_id')

    # Drop projects table
    op.drop_index(op.f('ix_projects_id'), table_name='projects')
    op.drop_table('projects')
```

**Running Migration:**
```bash
cd backend
alembic revision --autogenerate -m "Add projects table"
alembic upgrade head
```

## Success Criteria

✅ Can create new project with name and description
✅ Can view all projects in grid layout
✅ Can edit project name, description, and status
✅ Can delete project (with confirmation)
✅ Can add tasks to project
✅ Progress auto-calculates from task completion (0-100%)
✅ Can view project in three tabs: Overview, List, Board
✅ Can drag tasks between status columns (Kanban board)
✅ Can filter/sort tasks by priority, status, due date
✅ Personal tasks remain separate (project_id = null)
✅ Dashboard shows active projects widget
✅ Responsive design works on mobile/tablet/desktop
✅ Clean ClickUp-inspired UI with smooth animations

## Out of Scope (MVP)

- User management and task assignees
- Project due dates and deadlines
- Task comments and attachments
- Task dependencies and subtasks
- Time tracking per task
- Project templates
- Custom fields
- Notifications/reminders
- Calendar view
- Timeline/Gantt chart
- File uploads
- Activity log/audit trail
- Search across all projects
- Tags/labels for projects
- Project archiving
- Bulk operations

These features can be added incrementally after the MVP is validated.

## Future Enhancements

1. **Assignees:** Add user management, assign tasks to team members
2. **Due Dates:** Add project deadlines, show overdue warnings
3. **Templates:** Save projects as templates for reuse
4. **Subtasks:** Nested task hierarchy
5. **Time Tracking:** Track hours per task, billable time
6. **Calendar View:** View tasks by due date in calendar
7. **Activity Log:** Track all changes to project and tasks
8. **Custom Fields:** Add custom metadata to projects/tasks
9. **Notifications:** Email/push notifications for updates
10. **Export:** Export project data to PDF, CSV
11. **Tags:** Add tags/labels for better organization
12. **Archive:** Soft-delete projects instead of hard delete

## Technical Considerations

### Performance

1. **Progress Calculation:**
   - Acceptable for MVP (< 100 tasks per project typical)
   - If projects grow large, move to background job
   - Consider caching if recalculation becomes slow

2. **Task Queries:**
   - Index on project_id for fast filtering
   - Limit page size to 50-100 tasks
   - Add pagination if needed

3. **Frontend Bundle:**
   - KanbanBoard is already in bundle
   - Minimal new code, shouldn't impact load time

### Scalability

1. **Database:**
   - SQLite fine for MVP (single user)
   - Consider PostgreSQL for multi-user
   - Add indexes on foreign keys

2. **Caching:**
   - React Query handles client-side caching
   - Consider Redis for backend caching later

### Security

1. **Authorization:**
   - MVP: Single user, no auth needed
   - Future: Add user ownership checks

2. **Validation:**
   - Backend validates all inputs
   - Frontend pre-validates for UX

3. **SQL Injection:**
   - SQLAlchemy ORM prevents injection
   - Use parameterized queries always

## Implementation Sequence

**Recommended build order (matches natural dependencies):**

### Phase 1: Backend Foundation (Day 1)
1. Create project model (`backend/app/models/project.py`)
2. Create project schemas (`backend/app/schemas/project.py`)
3. Generate database migration
4. Run migration
5. Verify database schema

### Phase 2: Backend API (Day 1-2)
1. Create project routes (`backend/app/routes/projects.py`)
2. Implement CRUD endpoints
3. Add progress calculation helper
4. Update task routes for project_id filtering
5. Register project router in main.py
6. Test endpoints with curl/Postman

### Phase 3: Frontend Types & API (Day 2)
1. Add TypeScript types to `frontend/src/types/index.ts`
2. Add projectApi methods to `frontend/src/lib/api.ts`
3. Test API client methods in console

### Phase 4: Projects List Page (Day 2-3)
1. Create `frontend/src/pages/Projects.tsx`
2. Create `frontend/src/components/ProjectCard.tsx`
3. Create `frontend/src/components/ProjectModal.tsx`
4. Implement grid layout
5. Add search/filter
6. Wire up create/delete actions

### Phase 5: Project Detail - Overview (Day 3)
1. Create `frontend/src/pages/ProjectDetail.tsx`
2. Implement header (name, status, actions)
3. Create Overview tab with stats
4. Add progress chart component
5. Wire up edit actions

### Phase 6: Project Detail - List & Board (Day 4)
1. Implement List tab
2. Reuse TaskItem component
3. Add task filters
4. Implement Board tab
5. Wire up existing KanbanBoard with project_id filter
6. Test drag-drop functionality

### Phase 7: Integration (Day 4-5)
1. Add Projects to navigation
2. Create Dashboard widget
3. Update Tasks page with filter
4. Add project badge to TaskItem

### Phase 8: Polish (Day 5)
1. Add loading states
2. Add empty states
3. Add error handling
4. Responsive design testing
5. Animation polish
6. Cross-browser testing

**Total Estimated Time:** 5 days for complete MVP

## Testing Strategy

### Backend Tests
- Test project CRUD operations
- Test progress calculation logic
- Test cascade delete
- Test task filtering by project_id

### Frontend Tests
- Test project creation flow
- Test drag-drop status changes
- Test progress updates
- Test responsive layouts

### Integration Tests
- Test full project lifecycle
- Test task movement between projects
- Test progress recalculation accuracy

### Manual Testing Checklist
- [ ] Create project with long name/description
- [ ] Create project with empty description
- [ ] Add 10+ tasks to project
- [ ] Complete tasks one by one, watch progress
- [ ] Drag task between columns
- [ ] Delete project with tasks
- [ ] Convert personal task to project task
- [ ] Test on mobile device
- [ ] Test with slow network (throttling)

## Conclusion

This design provides a complete ClickUp-style project management system by extending the existing Task infrastructure. By reusing proven components (KanbanBoard, TaskItem) and following established patterns, we minimize new code while delivering a powerful feature. The clean separation between personal and project tasks maintains flexibility, and the automatic progress tracking provides immediate value.

The phased implementation approach ensures we can deliver a working MVP quickly, then iterate based on usage patterns and feedback.
