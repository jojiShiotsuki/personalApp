# Personal Productivity Application Design
**Date:** 2025-11-06
**Status:** Approved for Implementation

## Overview

A local-first personal productivity application with two main components (Personal Assistant and CRM) plus a context export feature for integration with Claude as an external CEO mentor.

## Core Requirements

### 1. Personal Assistant Bot
- Task management system with date/time scheduling
- Natural language command bar interface for task creation
- Task status tracking: pending, in_progress, completed, delayed
- Priority levels: low, medium, high, urgent
- Smart filtering and sorting
- Visual indicators for overdue/due-soon tasks

### 2. CRM System
- Contact management (name, company, email, phone, status)
- Deal pipeline tracking with kanban board
- Stage-based workflow: lead → prospect → proposal → negotiation → closed won/lost
- Interaction history (meetings, emails, calls, notes)
- Revenue tracking and pipeline analytics
- Search and filter capabilities

### 3. Context Export Tab
- Generates comprehensive markdown report of all data
- Includes: tasks (pending, completed, overdue), CRM deals, interactions, metrics
- Copy-to-clipboard functionality
- Date range filtering
- Designed for copy-paste to Claude chat for strategic advice

## System Architecture

### Technology Stack

**Backend:**
- Python 3.11+
- FastAPI 0.104+ (async web framework)
- SQLAlchemy 2.0+ (ORM)
- Alembic (database migrations)
- Pydantic v2 (data validation)
- python-dateutil (natural language date parsing)
- SQLite (local database)

**Frontend:**
- React 18 + TypeScript
- Vite 5.x (build tool, dev server)
- React Router v6 (client-side routing)
- TanStack Query v5 (data fetching, caching)
- Zustand (lightweight state management)
- Tailwind CSS v3 (styling)
- shadcn/ui (component library)
- date-fns (date utilities)
- react-beautiful-dnd (drag-and-drop)

### Project Structure

```
/personalApp
  /backend
    /app
      /models          # SQLAlchemy database models
        __init__.py
        task.py
        crm.py
      /routes          # FastAPI route handlers
        __init__.py
        tasks.py
        crm.py
        export.py
      /services        # Business logic
        __init__.py
        task_parser.py  # Natural language parsing
        export_service.py
      /database        # Database setup
        __init__.py
        connection.py
    /alembic          # Database migrations
    main.py           # FastAPI app entry point
    requirements.txt

  /frontend
    /src
      /components     # Reusable React components
        /ui           # shadcn/ui components
      /pages          # Route pages
        Dashboard.tsx
        Tasks.tsx
        Contacts.tsx
        Deals.tsx
        Export.tsx
      /services       # API client functions
        api.ts
      /lib            # Utilities
        utils.ts
      /types          # TypeScript types
      App.tsx
      main.tsx
    index.html
    package.json
    vite.config.ts
    tailwind.config.js

  /database
    app.db            # SQLite database file

  /docs
    /plans            # Design documents
```

## Database Schema

### Tasks Table
```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    due_time TIME,
    priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, urgent
    status VARCHAR(20) DEFAULT 'pending',   -- pending, in_progress, completed, delayed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
```

### CRM_Contacts Table
```sql
CREATE TABLE crm_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    status VARCHAR(20) DEFAULT 'lead',  -- lead, prospect, client, inactive
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### CRM_Deals Table
```sql
CREATE TABLE crm_deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    value DECIMAL(12, 2),
    stage VARCHAR(20) DEFAULT 'lead',  -- lead, prospect, proposal, negotiation, closed_won, closed_lost
    probability INTEGER DEFAULT 50,     -- 0-100
    expected_close_date DATE,
    actual_close_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);
```

### CRM_Interactions Table
```sql
CREATE TABLE crm_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,  -- meeting, email, call, note
    subject VARCHAR(255),
    notes TEXT,
    interaction_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);
```

## API Endpoints

### Tasks API
- `GET /api/tasks` - List all tasks (supports filtering by status, priority, date)
- `POST /api/tasks` - Create new task
- `POST /api/tasks/parse` - Parse natural language input and create task
- `GET /api/tasks/{id}` - Get task details
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `PATCH /api/tasks/{id}/status` - Update task status

### CRM Contacts API
- `GET /api/crm/contacts` - List all contacts (supports search/filter)
- `POST /api/crm/contacts` - Create contact
- `GET /api/crm/contacts/{id}` - Get contact with deals and interactions
- `PUT /api/crm/contacts/{id}` - Update contact
- `DELETE /api/crm/contacts/{id}` - Delete contact

### CRM Deals API
- `GET /api/crm/deals` - List all deals (supports filtering by stage)
- `POST /api/crm/deals` - Create deal
- `GET /api/crm/deals/{id}` - Get deal details
- `PUT /api/crm/deals/{id}` - Update deal
- `PATCH /api/crm/deals/{id}/stage` - Update deal stage (for drag-drop)
- `DELETE /api/crm/deals/{id}` - Delete deal

### CRM Interactions API
- `GET /api/crm/interactions` - List interactions (filter by contact, date range)
- `POST /api/crm/interactions` - Create interaction
- `GET /api/crm/interactions/{id}` - Get interaction
- `PUT /api/crm/interactions/{id}` - Update interaction
- `DELETE /api/crm/interactions/{id}` - Delete interaction

### Export API
- `GET /api/export/context` - Generate markdown context report (supports date range params)

## Feature Details

### Personal Assistant - Natural Language Parsing

**Command Examples:**
- "Meeting with Sarah tomorrow at 3pm"
- "Call John high priority"
- "Proposal due Friday"
- "Complete task 5"
- "Review contract next Monday 2pm urgent"

**Parsing Logic (Rule-based with regex):**
1. **Date extraction:**
   - Relative: "today", "tomorrow", "friday", "next week"
   - Absolute: "2024-01-15", "Jan 15"
   - Uses python-dateutil for flexibility

2. **Time extraction:**
   - Formats: "3pm", "15:00", "3:30pm"
   - Pattern: `\d{1,2}(:\d{2})?\s*(am|pm)?`

3. **Priority keywords:**
   - "urgent" → urgent
   - "high priority", "important" → high
   - "low priority" → low
   - Default → medium

4. **Action verbs:**
   - meeting, call, email, task, reminder, review, etc.
   - Extracted as part of title

5. **Status commands:**
   - "complete task X", "done X" → mark completed
   - "delay task X" → mark delayed

### Task Display Features
- **Filters:** Today, This Week, Overdue, All, Completed
- **Sorting:** Due date, Priority, Created date
- **Visual indicators:**
  - Overdue: Red badge
  - Due today: Yellow badge
  - Due soon (3 days): Blue badge
- **Quick actions:** Complete, Edit, Delete, Reschedule
- **Keyboard navigation:** Arrow keys, Enter to open, Space to complete

### CRM - Pipeline Kanban Board

**Columns:**
1. Lead
2. Prospect
3. Proposal
4. Negotiation
5. Closed Won
6. Closed Lost

**Deal Card Information:**
- Title
- Contact name (linked)
- Value (formatted currency)
- Probability %
- Expected close date
- Days in stage

**Drag-and-Drop:**
- Implemented with react-beautiful-dnd
- Smooth animations
- Optimistic updates (update UI immediately, rollback on error)
- API call to update stage on drop

**Pipeline Metrics:**
- Total pipeline value
- Deals per stage
- Win rate (closed_won / (closed_won + closed_lost))
- Average deal size
- Average time to close

### Context Export Format

```markdown
# Business Context Report - [Date Range]

## Task Summary
### Completed This Week (X tasks)
- [Task title] - Completed [date]
- [Task title] - Completed [date]

### Pending Tasks (X tasks)
- [High Priority] [Task title] - Due [date]
- [Medium Priority] [Task title] - Due [date]

### Overdue Tasks (X tasks)
- [Task title] - Due [date] - [Days overdue]

## CRM Overview
### Active Deals (Total Value: $X)
**Stage breakdown:**
- Lead: X deals ($Y)
- Prospect: X deals ($Y)
- Proposal: X deals ($Y)
- Negotiation: X deals ($Y)

**Top deals:**
- [Contact] - [Deal title] - Stage: [stage] - Value: $X - Close: [date]

### Recent Interactions (Last 7 days)
- [Date] - [Type] with [Contact]: [Subject]

### Pipeline Health
- Total active deals: X
- Closed won this month: X ($Y revenue)
- Closed lost this month: X
- Win rate: X%
- Average deal size: $X
- Average time to close: X days

## Key Metrics
- Task completion rate: X%
- Tasks completed on time: X%
- Deals closed this month: X
- Revenue generated: $X
- Active contacts: X
- New contacts this month: X
```

## UI/UX Design

### Visual Design
- **Style:** Modern, clean, professional
- **Colors:**
  - Primary: Blue accent
  - Success: Green
  - Warning: Yellow
  - Danger: Red
  - Neutral grays for backgrounds
- **Typography:** Inter or similar sans-serif
- **Spacing:** Consistent 4px grid system (Tailwind default)
- **Theme:** Dark mode support (system preference detection)

### Navigation
- **Sidebar:** Fixed left navigation
  - Dashboard (home icon)
  - Tasks (checklist icon)
  - Contacts (users icon)
  - Deals (kanban icon)
  - Export (download icon)
- **Top bar:**
  - App title/logo
  - Global search/command bar trigger
  - User indicator (future: settings)

### Key UI Components

**Command Bar (Cmd+K):**
- Full-screen overlay with centered search box
- Auto-focus on open
- Real-time parsing preview
- Suggestions dropdown
- Recent commands history

**Task List:**
- Card-based layout
- Checkbox for quick complete
- Priority color bar on left edge
- Due date badges
- Expandable for description

**Deal Kanban:**
- Horizontal columns with scroll
- Card-based deals
- Column headers with count and total value
- Drag handles on cards
- Add deal button in each column

**Dashboard Widgets:**
- Grid layout (2-3 columns)
- Task summary widget (today, overdue, upcoming)
- CRM metrics widget (pipeline value, deals by stage)
- Recent activity widget (tasks + interactions)
- Quick actions (new task, new contact, new deal)

### Interactions

**Keyboard Shortcuts:**
- `Cmd/Ctrl + K` - Open command bar
- `Cmd/Ctrl + N` - New item (context-aware)
- `Escape` - Close modals/command bar
- Arrow keys - Navigate lists
- `Enter` - Open/edit selected item
- `Space` - Toggle checkbox/complete

**Toast Notifications:**
- Success: "Task created", "Deal updated"
- Error: "Failed to save", "Connection error"
- Position: Top-right
- Auto-dismiss after 3 seconds

**Loading States:**
- Skeleton loaders for data fetching
- Spinner for actions (save, delete)
- Optimistic updates where possible

**Empty States:**
- Friendly illustrations
- Helpful text: "No tasks yet. Use Cmd+K to create your first task!"
- Primary action button

## Development Phases

### Phase 1: Foundation (Days 1-2)
- [ ] Initialize project structure
- [ ] Set up FastAPI backend with basic config
- [ ] Set up React + Vite frontend
- [ ] Configure SQLAlchemy and create database models
- [ ] Set up Alembic for migrations
- [ ] Create initial migration
- [ ] Set up CORS and connect frontend to backend
- [ ] Install and configure Tailwind CSS + shadcn/ui

### Phase 2: Personal Assistant (Days 3-5)
- [ ] Implement Task model and CRUD API endpoints
- [ ] Build natural language parsing service
- [ ] Create task list UI component
- [ ] Build command bar component
- [ ] Implement task filtering and sorting
- [ ] Add task detail view and edit functionality
- [ ] Add visual indicators for due dates
- [ ] Test task creation via command bar

### Phase 3: CRM System (Days 6-9)
- [ ] Implement Contact, Deal, and Interaction models
- [ ] Build CRM API endpoints (CRUD for all entities)
- [ ] Create contacts list and detail views
- [ ] Build kanban board component with react-beautiful-dnd
- [ ] Implement drag-and-drop functionality
- [ ] Create interaction timeline component
- [ ] Build CRM dashboard widgets
- [ ] Add search and filter capabilities

### Phase 4: Integration & Polish (Days 10-12)
- [ ] Build context export service (backend)
- [ ] Create export page UI with markdown preview
- [ ] Implement copy-to-clipboard functionality
- [ ] Build unified dashboard with all widgets
- [ ] Add error handling and validation
- [ ] Implement toast notifications
- [ ] Add loading states and empty states
- [ ] Test complete user workflows
- [ ] Polish UI and fix bugs

## Development Setup

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**Backend runs on:** `http://localhost:8000`
**API docs:** `http://localhost:8000/docs`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

**Frontend runs on:** `http://localhost:5173`

## Success Criteria

### MVP Complete When:
1. ✅ Can create tasks via natural language command bar
2. ✅ Tasks display with proper filtering, sorting, status updates
3. ✅ Can manage contacts with full CRUD operations
4. ✅ Can create and track deals through pipeline stages
5. ✅ Kanban board allows drag-and-drop between stages
6. ✅ Can add interactions to contacts
7. ✅ Export tab generates comprehensive markdown report
8. ✅ Copy-to-clipboard works reliably
9. ✅ Dashboard shows unified view of tasks + CRM
10. ✅ UI is polished and responsive

### Quality Standards:
- No critical bugs in core workflows
- All API endpoints return appropriate status codes
- Error messages are user-friendly
- Loading states prevent confusion
- Data persists correctly in SQLite
- UI is responsive (works on desktop and tablet)

## Future Enhancements (Post-MVP)

- Browser push notifications for task reminders
- Email integration (sync interactions)
- Calendar integration
- Mobile responsive design
- Export to CSV/Excel
- Data backup and restore
- Multi-user support with authentication
- Real-time collaboration
- Optional LLM integration for smarter parsing
- Recurring tasks
- Task dependencies
- File attachments
- Custom fields and tags

## Technical Considerations

### Performance
- TanStack Query provides automatic caching and background refetching
- Optimistic updates for better perceived performance
- Lazy loading for large lists
- Debounced search inputs

### Security (Future)
- HTTPS in production
- Authentication with JWT tokens
- Input validation on backend (Pydantic)
- SQL injection prevention (SQLAlchemy ORM)
- XSS prevention (React escapes by default)

### Data Integrity
- Foreign key constraints in database
- Cascade deletes for related records
- Validation at both frontend and backend
- Transaction support for multi-step operations

### Error Handling
- Try-catch blocks around API calls
- User-friendly error messages
- Automatic retry for network failures (TanStack Query)
- Fallback UI for errors
- Console logging for debugging

## Conclusion

This design provides a solid foundation for a fast, functional, and fancy personal productivity application. The hybrid approach (rule-based parsing with option for future LLM enhancement) ensures immediate usability while leaving room for growth. The context export feature elegantly solves the CEO mentor requirement by leveraging Claude's existing capabilities rather than building a complex AI system.

The tech stack (FastAPI + React + Vite) prioritizes speed and developer experience, allowing rapid iteration and a polished final product. The modular architecture makes it easy to add features incrementally post-MVP.
