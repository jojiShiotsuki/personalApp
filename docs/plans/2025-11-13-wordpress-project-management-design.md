# WordPress Project Management System - Design Document

**Date:** November 13, 2025
**Status:** Design Approved
**Author:** Claude (Brainstorming Skill)

## Overview

A project management module to track WordPress website builds, including project details, task lists, progress tracking, and client information integration with the existing CRM system.

## Goals

- Track WordPress website projects from planning through launch
- Link projects to CRM contacts (clients) and optionally to deals (sales opportunities)
- Manage project-specific tasks organized by delivery phases
- Monitor progress automatically based on task completion
- Provide visibility into active projects and delivery status

## Architecture Decision

**Chosen Approach:** Separate Project entity with optional deal_id foreign key

**Rationale:**
- Clean separation between sales pipeline (Deals) and delivery work (Projects)
- Supports multiple scenarios: projects from deals, projects without deals, multiple projects per deal
- Scalable to other project types beyond WordPress
- Avoids bloating the Deal model with delivery-specific fields
- Follows existing pattern of linked entities (Contact → Deal → Interaction)

**Structure:**
```
Contact (client)
  ↓
Deal (optional sales opportunity)
  ↓
Project (WordPress website work)
  ↓
Task (delivery tasks, reused from existing Task model)
```

## Database Schema

### New Project Model

**File:** `backend/app/models/project.py`

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id"), nullable=False)
    deal_id = Column(Integer, ForeignKey("crm_deals.id"), nullable=True)

    # Basic info
    name = Column(String(255), nullable=False)  # "Acme Corp Website"
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.PLANNING)

    # WordPress-specific metadata
    domain = Column(String(255), nullable=True)
    hosting_provider = Column(String(100), nullable=True)
    wp_version = Column(String(20), nullable=True)
    theme = Column(String(100), nullable=True)

    # Dates
    start_date = Column(Date, nullable=True)
    target_launch_date = Column(Date, nullable=True)
    actual_launch_date = Column(Date, nullable=True)

    # Progress (calculated from tasks)
    progress = Column(Integer, default=0)  # 0-100

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contact = relationship("Contact", backref="projects")
    deal = relationship("Deal", backref="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', status={self.status})>"
```

**Key Design Choices:**
- `deal_id` is optional (nullable=True) - supports projects without sales pipeline
- `progress` is denormalized for performance - recalculated when tasks update
- `cascade="all, delete-orphan"` - deleting project removes its tasks
- Relationships use `backref` for bidirectional access

### Modified Task Model

**File:** `backend/app/models/task.py`

**Add these fields to existing Task model:**
```python
# Add to Task class
project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
phase = Column(String(50), nullable=True)  # "Planning", "Design", "Development", etc.

# Add relationship
project = relationship("Project", back_populates="tasks")
```

**Key Design Choices:**
- `project_id` is optional (nullable=True) - tasks can be personal or project-linked
- `phase` allows grouping by WordPress delivery stages
- Reuses existing Task infrastructure (TaskPriority, TaskStatus, due dates, etc.)

## API Endpoints

### Project Routes

**File:** `backend/app/routes/projects.py`

```
GET    /api/projects                    # List all projects (filter by status, contact)
GET    /api/projects/{id}               # Get project details + task count/progress
POST   /api/projects                    # Create new project
PUT    /api/projects/{id}               # Update project
DELETE /api/projects/{id}               # Delete project (cascades to tasks)

# Project-specific operations
GET    /api/projects/{id}/tasks         # Get all tasks for a project
POST   /api/projects/{id}/tasks         # Create task linked to project
PUT    /api/projects/{id}/progress      # Recalculate progress from tasks
GET    /api/projects/{id}/timeline      # Get project timeline (tasks by phase)

# Integration endpoints
GET    /api/contacts/{id}/projects      # Get all projects for a contact
GET    /api/deals/{id}/project          # Get project linked to a deal
```

### Modified Task Routes

**File:** `backend/app/routes/tasks.py`

```
# Existing task endpoints stay the same, add filtering:
GET    /api/tasks?project_id={id}       # Filter tasks by project
GET    /api/tasks?project_id=null       # Get personal tasks only
```

### Progress Calculation Logic

**Triggered on:** Task status change to COMPLETED

**Algorithm:**
```python
def recalculate_project_progress(project_id: int, db: Session):
    total = db.query(Task).filter(Task.project_id == project_id).count()
    if total == 0:
        return 0

    completed = db.query(Task).filter(
        Task.project_id == project_id,
        Task.status == TaskStatus.COMPLETED
    ).count()

    progress = int((completed / total) * 100)

    project = db.query(Project).filter(Project.id == project_id).first()
    project.progress = progress
    db.commit()

    return progress
```

**Integration:** Call this function in task update endpoint when status changes.

## Frontend Architecture

### New Pages

#### 1. Projects Page (`/projects`)

**File:** `frontend/src/pages/Projects.tsx`

**Features:**
- Grid/card view of all projects
- Each ProjectCard shows:
  - Project name
  - Client name (linked)
  - Status badge (color-coded)
  - Progress bar (0-100%)
  - Task count (X/Y completed)
  - Target launch date
- Filters:
  - Status dropdown (All, Planning, In Progress, Review, Completed, On Hold)
  - Search by project name or client
- "New Project" button (opens ProjectModal)
- Click card → navigate to `/projects/{id}`

**Component Structure:**
```
Projects.tsx
├── ProjectFilters (status, search)
├── ProjectGrid
│   └── ProjectCard (reuse styling from DealCard)
└── ProjectModal (create/edit)
```

#### 2. Project Detail Page (`/projects/{id}`)

**File:** `frontend/src/pages/ProjectDetail.tsx`

**Features:**
- Header with project name, client link, status selector
- Tabs: Overview | Tasks | Timeline | Notes

**Overview Tab:**
- Project metadata form (domain, hosting, WP version, theme)
- Date fields (start, target launch, actual launch)
- Progress circle chart
- Quick stats cards:
  - Total tasks
  - Completed tasks
  - Overdue tasks
  - Days until launch

**Tasks Tab:**
- Group tasks by phase (collapsible sections):
  - Planning
  - Design
  - Development
  - Testing
  - Deployment
- Reuse existing TaskItem component
- "Add Task" button
- "Create WordPress Checklist" button (bulk creates standard tasks)

**Timeline Tab:**
- Visual timeline showing:
  - Project start/launch dates
  - Tasks plotted by due_date
  - Phase milestones
  - Overdue indicators

**Notes Tab:**
- Simple textarea for project notes
- Auto-save on blur

**Component Structure:**
```
ProjectDetail.tsx
├── ProjectHeader (name, client, status)
├── Tabs
│   ├── OverviewTab
│   │   ├── ProjectMetadataForm
│   │   ├── ProgressChart
│   │   └── QuickStats
│   ├── TasksTab
│   │   ├── TasksByPhase
│   │   │   └── TaskItem (existing component)
│   │   ├── AddTaskButton
│   │   └── CreateChecklistButton
│   ├── TimelineTab
│   │   └── ProjectTimeline
│   └── NotesTab
│       └── NotesEditor
└── TaskModal (existing, add project_id field)
```

### Modified Pages

#### Contacts Page

**File:** `frontend/src/pages/Contacts.tsx`

**Changes:**
- Add "Projects" tab to contact detail view
- Show list of contact's projects
- Click project → navigate to project detail

#### Dashboard Page

**File:** `frontend/src/pages/Dashboard.tsx`

**Changes:**
- Add "Active Projects" widget
- Show count of in_progress projects
- List 5 most recent active projects with progress bars
- "View All" link to Projects page

## Data Flow

### Creating a New Project

```
1. User clicks "New Project" button on /projects
2. ProjectModal opens
3. User fills form:
   - Select client (dropdown from contacts API)
   - Optional: Link to deal (dropdown filtered by client)
   - Enter: name, domain, hosting, WP version, theme, target launch date
4. Form submits: POST /api/projects
5. Backend creates project, returns project object
6. Frontend navigates to /projects/{id}
7. User can now add tasks or use "Create WordPress Checklist"
```

### WordPress Checklist Template

**Implementation:** Hardcoded array in frontend (MVP)

**File:** `frontend/src/data/wordpressChecklist.ts`

```typescript
export const wordpressChecklist = [
  { phase: "Planning", title: "Gather client requirements" },
  { phase: "Planning", title: "Create sitemap" },
  { phase: "Planning", title: "Create wireframes" },
  { phase: "Design", title: "Design homepage mockup" },
  { phase: "Design", title: "Design internal pages" },
  { phase: "Design", title: "Get design approval" },
  { phase: "Development", title: "Set up WordPress and theme" },
  { phase: "Development", title: "Install and configure plugins" },
  { phase: "Development", title: "Build pages and content" },
  { phase: "Development", title: "Implement custom features" },
  { phase: "Testing", title: "Browser compatibility testing" },
  { phase: "Testing", title: "Mobile responsiveness testing" },
  { phase: "Testing", title: "Performance optimization" },
  { phase: "Deployment", title: "Configure DNS and SSL" },
  { phase: "Deployment", title: "Go live" },
  { phase: "Deployment", title: "Client training" }
];
```

**Usage:**
When user clicks "Create WordPress Checklist":
1. Frontend iterates through array
2. For each item, POST /api/projects/{id}/tasks with project_id and phase
3. Backend creates tasks linked to project
4. Frontend refreshes task list
5. Progress automatically calculates as 0% (0/16 tasks complete)

### Progress Auto-Update

**Flow:**
1. User marks task as COMPLETED in UI
2. Frontend: PUT /api/tasks/{id} with status="completed"
3. Backend: Updates task, calls `recalculate_project_progress(project_id)`
4. Backend: Returns updated task
5. Frontend: React Query invalidates `['projects', project_id]` query
6. UI automatically updates progress bar across all views

## TypeScript Types

**File:** `frontend/src/types/index.ts`

```typescript
export enum ProjectStatus {
  PLANNING = "planning",
  IN_PROGRESS = "in_progress",
  REVIEW = "review",
  COMPLETED = "completed",
  ON_HOLD = "on_hold",
}

export type Project = {
  id: number;
  contact_id: number;
  deal_id?: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  domain?: string;
  hosting_provider?: string;
  wp_version?: string;
  theme?: string;
  start_date?: string;
  target_launch_date?: string;
  actual_launch_date?: string;
  progress: number;
  created_at: string;
  updated_at: string;

  // Populated relations
  contact?: Contact;
  deal?: Deal;
  task_count?: number;
  completed_task_count?: number;
}

export type ProjectCreate = {
  contact_id: number;
  deal_id?: number;
  name: string;
  description?: string;
  domain?: string;
  hosting_provider?: string;
  wp_version?: string;
  theme?: string;
  target_launch_date?: string;
}

export type ProjectUpdate = {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  domain?: string;
  hosting_provider?: string;
  wp_version?: string;
  theme?: string;
  start_date?: string;
  target_launch_date?: string;
  actual_launch_date?: string;
}

// Extend existing Task type
export type Task = {
  // ...existing fields...
  project_id?: number;
  phase?: string;
}

export type TaskCreate = {
  // ...existing fields...
  project_id?: number;
  phase?: string;
}
```

## Validation Rules

### Backend (Pydantic Schemas)

```python
class ProjectCreate(BaseModel):
    contact_id: int
    deal_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    domain: Optional[str] = Field(None, max_length=255)
    hosting_provider: Optional[str] = Field(None, max_length=100)
    wp_version: Optional[str] = Field(None, max_length=20)
    theme: Optional[str] = Field(None, max_length=100)
    target_launch_date: Optional[date] = None

    @validator('contact_id')
    def contact_must_exist(cls, v, values, **kwargs):
        # Check in route handler that contact exists
        return v

    @validator('deal_id')
    def deal_must_belong_to_contact(cls, v, values, **kwargs):
        # Check in route handler that deal.contact_id == contact_id
        return v
```

### Frontend (Form Validation)

- Project name: Required, max 255 characters
- Client: Required, must select from dropdown
- Deal: Optional, filtered by selected client
- Domain: Optional, basic format check (contains '.')
- Dates: Optional, target_launch_date should be future

## Error Handling & Edge Cases

### 1. Deleting a Contact with Projects

**Scenario:** User tries to delete contact that has active projects

**Solution:**
- Backend: Check for linked projects before delete
- If active projects exist, return 400 error: "Cannot delete contact with active projects. Archive or reassign projects first."
- Frontend: Show error message, offer link to contact's projects

### 2. Deleting a Project

**Scenario:** User deletes project

**Solution:**
- SQLAlchemy cascade handles task deletion automatically
- Frontend: Show confirmation modal: "Delete project '{name}'? This will also delete X associated tasks."
- Backend: Returns 204 No Content on success

### 3. Project with No Tasks

**Scenario:** New project with no tasks yet

**Solution:**
- Progress shows 0%
- Tasks tab shows empty state: "No tasks yet. Add tasks or create WordPress checklist."
- Timeline tab shows: "Add tasks with due dates to see timeline"

### 4. All Tasks Completed

**Scenario:** Project reaches 100% completion

**Solution:**
- Progress shows 100%
- Show badge: "All tasks complete! Ready to launch"
- If actual_launch_date not set, prompt: "Mark project as launched?"

### 5. Moving Deal to closed_lost

**Scenario:** User moves deal to closed_lost, but project exists

**Solution:**
- Check if deal has linked project(s)
- If yes, show warning modal (similar to existing follow-up warning):
  - "This deal has an active project: {project.name}"
  - Options: "Continue anyway" | "Cancel"
- Don't block the action, just warn

### 6. Deleting a Deal with Project

**Scenario:** User deletes deal that has linked project

**Solution:**
- Project.deal_id is optional (nullable)
- Set project.deal_id = NULL (don't cascade delete)
- Project continues to exist, linked to contact only

## Component Reuse

### Existing Components to Reuse

1. **TaskItem** (`frontend/src/components/TaskItem.tsx`)
   - Used in project tasks tab
   - No changes needed, already handles all task fields

2. **TaskModal** (`frontend/src/components/TaskModal.tsx`)
   - Used for creating/editing project tasks
   - Add: project_id and phase fields (hidden, set automatically)

3. **DealCard** styling patterns
   - Reuse for ProjectCard layout
   - Similar card structure: title, status badge, progress, metadata

4. **Existing task filtering logic**
   - Adapt for filtering tasks by project_id and phase

## Database Migration

**Migration Name:** `add_projects_table.py`

**Steps:**
1. Create `projects` table
2. Add `project_id` and `phase` columns to `tasks` table
3. Add foreign key constraint: `tasks.project_id → projects.id`

**Rollback Plan:**
- Drop foreign key constraint
- Drop `project_id` and `phase` columns from `tasks`
- Drop `projects` table

## Success Criteria

✅ Can create a new website project and link to a client
✅ Can optionally link project to a deal
✅ Can add/manage tasks specific to that project
✅ Can group tasks by phase (Planning, Design, Development, Testing, Deployment)
✅ Can create standard WordPress checklist with one click
✅ Progress automatically updates from 0% to 100% based on task completion
✅ Can view all projects and filter by status
✅ Can see project details, metadata, and timeline
✅ Can view client's projects from contact page
✅ Dashboard shows active projects count
✅ Deleting project cascades to its tasks
✅ Personal tasks (project_id=NULL) remain separate from project tasks

## Out of Scope (for MVP)

- Time tracking/billing integration
- File uploads/media gallery
- Client portal access
- Automated email notifications
- Multi-user collaboration/assignments
- Custom task templates (beyond WordPress checklist)
- Gantt chart view
- Budget tracking
- Resource allocation

## Future Enhancements

1. **Task Templates:** Store reusable checklists in database
2. **Project Types:** Add project_type field (website, maintenance, redesign)
3. **Client Notifications:** Email client when project reaches milestones
4. **File Attachments:** Link design mockups, content docs to projects
5. **Time Tracking:** Track hours per task for billing
6. **Recurring Projects:** Template system for repeat builds
7. **Collaboration:** Assign tasks to team members
8. **Advanced Timeline:** Gantt chart with dependencies

## Technical Debt & Considerations

1. **Progress Calculation Performance**
   - Current: Recalculates on every task update
   - Acceptable for MVP (< 100 tasks per project)
   - Future: Consider background job if projects grow large

2. **WordPress Checklist Hardcoded**
   - Current: JavaScript array in frontend
   - Future: Move to database as TaskTemplate model
   - Allows customization per user/client

3. **No Soft Deletes**
   - Current: Hard delete projects and tasks
   - Future: Add `deleted_at` column for soft deletes
   - Allows recovery and audit trail

4. **No Activity Log**
   - Current: Only created_at/updated_at timestamps
   - Future: Add project activity log (task completed, status changed, etc.)
   - Useful for client reporting

## Implementation Sequence

Recommended build order:

1. **Backend Foundation**
   - Database migration (Project model, Task modifications)
   - Project model, schemas, routes
   - Task routes modifications (add project_id filtering)
   - Progress calculation logic

2. **Backend Integration**
   - Contact projects endpoint
   - Deal project endpoint
   - Validation logic

3. **Frontend Foundation**
   - TypeScript types
   - API client methods
   - Projects page (list view)
   - ProjectCard component

4. **Frontend Core Features**
   - Project detail page (Overview tab)
   - Tasks tab (reuse TaskItem)
   - ProjectModal (create/edit)
   - WordPress checklist integration

5. **Frontend Integration**
   - Contact projects tab
   - Dashboard active projects widget
   - Deal warning for closed_lost

6. **Polish**
   - Timeline tab
   - Notes tab
   - Error handling
   - Loading states
   - Empty states

## Conclusion

This design provides a complete WordPress project management system that integrates seamlessly with the existing CRM. By reusing the Task model and existing components, we minimize new code while delivering full project tracking functionality. The optional deal_id allows flexibility for various workflows, and the phase-based task organization maps directly to WordPress delivery processes.
