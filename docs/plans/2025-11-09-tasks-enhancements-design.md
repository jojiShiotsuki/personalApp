# Tasks Page Enhancements Design

**Date:** 2025-11-09
**Status:** Approved
**Implementation Strategy:** Sequential Incremental Rollout

## Overview

This document describes a comprehensive enhancement plan for the task management system. The improvements are organized into four sequential features that build upon each other, allowing for incremental delivery and user feedback at each stage.

## Current State

The tasks page currently provides:
- Full CRUD operations for tasks
- Natural language task creation (Cmd+K)
- Status filtering (All, Pending, In Progress, Completed, Delayed)
- Priority levels with visual indicators
- Due date and time tracking
- Overdue detection
- Quick status toggle via checkbox
- Modal-based editing
- Dashboard integration with metrics

## Planned Enhancements

### Feature 1: Sorting & Search (Quick Win)
**Estimated Time:** 1-2 hours
**Complexity:** Low
**Value:** High

#### Architecture
Pure frontend enhancement with no backend changes. Leverages existing `/api/tasks` endpoint data with client-side filtering and sorting.

#### Components
1. **Toolbar Enhancement** - Add controls above task list:
   - Sort dropdown with options: Due Date, Priority, Created Date, Title
   - Search input with 300ms debounce

2. **State Management** - Add to `Tasks.tsx`:
   - `sortBy: string` - selected sort criterion
   - `searchQuery: string` - debounced search text

3. **Computed Data** - `useMemo` hook:
   - Filter by search (case-insensitive match on title/description)
   - Sort by selected criterion
   - Return processed array to TaskList

#### UI Pattern
```
[Search: 🔍____________] [Sort by: Due Date ▼] [Filter: All ▼]
```

#### Sorting Logic
- **Due Date:** null dates sorted last, then ascending by date
- **Priority:** urgent → high → medium → low
- **Created Date:** newest first (descending)
- **Title:** alphabetical A-Z

#### Error Handling
- Empty search results: Display "No tasks match '{query}'" message
- No network errors possible (client-side only)

#### Testing
- Verify search matches partial strings in title and description
- Confirm debounce prevents excessive re-renders
- Test each sort option with mixed data
- Ensure sort stability for equal values

---

### Feature 2: Categories/Tags System
**Estimated Time:** 4-6 hours
**Complexity:** Medium
**Value:** High

#### Architecture
Many-to-many relationship between tasks and tags using junction table pattern. Full backend/frontend integration required.

#### Database Schema
```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_tags (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);
```

#### Backend Components

**Models** (`backend/app/models/tag.py`):
```python
class Tag(Base):
    __tablename__ = "tags"
    id: int (PK)
    name: str (unique, max 100)
    color: str (max 50)
    created_at: datetime

class TaskTag(Base):
    __tablename__ = "task_tags"
    task_id: int (FK → tasks.id)
    tag_id: int (FK → tags.id)
```

**Task Model Update**:
- Add `tags` relationship with lazy loading
- Back-populate from Tag model

**Schemas** (`backend/app/schemas/tag.py`):
- `TagCreate`: name, color
- `TagUpdate`: Optional[name], Optional[color]
- `TagResponse`: id, name, color, created_at

**TaskResponse Schema Update**:
- Add `tags: List[TagResponse]` field

**Routes** (`backend/app/routes/tags.py`):
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create tag (validate unique name)
- `PUT /api/tags/{id}` - Update tag
- `DELETE /api/tags/{id}` - Delete tag (cascade removes task_tags)
- `POST /api/tasks/{id}/tags` - Add tag to task
- `DELETE /api/tasks/{id}/tags/{tag_id}` - Remove tag from task

#### Frontend Components

**Tag Management**:
- `TagManager.tsx` - Modal for creating/editing/deleting tags
- Color picker with 10 preset colors (blue, green, red, yellow, purple, orange, pink, teal, gray, brown)

**Task Integration**:
- Tag selector in task modal (multi-select with search)
- Tag badges on TaskItem cards (colored pills with `×` to remove)
- Tag filter in toolbar (multi-select dropdown, OR logic)

**UI Patterns**:
```
Task Card:
  Title: "Implement authentication"
  Tags: [🔵 Backend] [🟢 High Priority]
  Due: Tomorrow

Filter Toolbar:
  Tags: [Backend ×] [Frontend ×] [Clear all]
  Showing 5 tasks with ANY selected tags
```

#### Data Flow
1. User creates tag → `POST /api/tags` → stored in DB
2. User assigns tag in task modal → `POST /api/tasks/{id}/tags` → junction record created
3. `GET /api/tasks` returns tasks with populated tags array
4. Frontend filters locally by selected tags (OR logic)

#### Validation
- Tag name must be unique (case-insensitive)
- Tag name length: 1-100 characters
- Color must be from predefined palette
- Cannot delete tag if in use (soft delete or warn user)

#### Testing
- Create tags with duplicate names (expect error)
- Assign multiple tags to single task
- Filter by multiple tags (verify OR logic)
- Delete tag and verify cascade to task_tags
- Edit tag color and verify updates on all tasks

---

### Feature 3: Calendar View
**Estimated Time:** 6-8 hours
**Complexity:** Medium-High
**Value:** Medium-High

#### Architecture
Add view mode toggle to switch between list and calendar views. Calendar is read-only initially (drag-and-drop rescheduling comes later).

#### Library Selection
**Choice:** `react-big-calendar`
- Well-maintained, active development
- Good TypeScript support
- Handles month/week/day views
- Lighter than FullCalendar
- MIT license

**Alternative Considered:** `@fullcalendar/react` - Rejected due to heavier bundle size and premium features not needed

#### Components

**View Toggle** (in toolbar):
```
[📋 List] [📅 Calendar] (mutually exclusive buttons)
```

**CalendarView Component** (`frontend/src/components/CalendarView.tsx`):
- Wraps react-big-calendar
- Maps tasks to calendar events
- Handles event clicks
- Renders unscheduled tasks in sidebar

**Event Transformation**:
```typescript
const events = tasks
  .filter(task => task.due_date)
  .map(task => ({
    id: task.id,
    title: task.title,
    start: new Date(`${task.due_date}T${task.due_time || '00:00'}`),
    end: new Date(`${task.due_date}T${task.due_time || '23:59'}`),
    resource: task // full task object for modal
  }));
```

#### Event Rendering

**Color Coding** (by priority):
- Urgent: `#ef4444` (red)
- High: `#f97316` (orange)
- Medium: `#3b82f6` (blue)
- Low: `#6b7280` (gray)

**Event Display**:
- Event title shows task title
- Status icon prefix: ✓ completed, ⏸ delayed, • pending/in-progress
- Strikethrough for completed tasks

#### Calendar Features
- **Default View:** Month
- **Additional Views:** Week, Day (optional)
- **Navigation:** Prev/Next month arrows, Today button
- **Interactions:** Click event → opens task edit modal
- **Unscheduled Sidebar:** Shows tasks without due_date

#### Responsive Design
- **Desktop:** Full calendar with all views
- **Mobile:** Switch to agenda/list view for better usability
- **Tablet:** Month view only, compact event display

#### Data Flow
1. User toggles to calendar view → state change
2. `useMemo` transforms `tasks → events`
3. react-big-calendar renders events on grid
4. User clicks event → `onEditTask(event.resource)` opens modal
5. Task updated in modal → React Query invalidates cache → calendar re-renders

#### Accessibility
- Keyboard navigation for date selection
- ARIA labels for event types
- Screen reader announcements for date changes
- Focus management when switching views

#### Testing
- Verify all tasks with due_date appear on calendar
- Click events and confirm correct task opens
- Navigate months and verify data loads
- Test edge cases: tasks at midnight, all-day tasks
- Responsive behavior on mobile breakpoints

---

### Feature 4: Subtasks/Checklists
**Estimated Time:** 8-10 hours
**Complexity:** High
**Value:** Very High

#### Architecture
Self-referential foreign key relationship allowing hierarchical task structure. UI limits display to 2 levels (parent → children) for simplicity, though database supports unlimited nesting.

#### Database Schema
```sql
ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0;

CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
```

**Field Descriptions**:
- `parent_task_id`: FK to parent task (null for root tasks)
- `position`: Integer for ordering subtasks within a parent (0-indexed)

#### Backend Components

**Task Model Update** (`backend/app/models/task.py`):
```python
class Task(Base):
    # ... existing fields ...
    parent_task_id: Optional[int] = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    position: int = Column(Integer, default=0)

    # Relationships
    subtasks = relationship("Task",
                           backref=backref('parent', remote_side=[id]),
                           cascade="all, delete-orphan",
                           order_by="Task.position")
```

**Schema Updates**:
- `TaskCreate`: add optional `parent_task_id`, `position`
- `TaskUpdate`: add optional `parent_task_id`, `position`
- `TaskResponse`: add `subtasks: List[TaskResponse]` (recursive), `parent_task_id`, `position`

**Routes**:
- `GET /api/tasks?include_subtasks=true` - returns nested structure
- `POST /api/tasks` - accepts `parent_task_id` to create subtask
- `PATCH /api/tasks/{id}/reorder` - bulk update subtask positions
- Validation: prevent circular dependencies

**Circular Dependency Check**:
```python
def validate_parent(task_id: int, parent_id: int, db: Session) -> bool:
    """Ensure parent_id is not task_id or in task's subtask tree"""
    if task_id == parent_id:
        return False

    # Check if parent_id is a descendant of task_id
    current = db.query(Task).get(parent_id)
    while current:
        if current.id == task_id:
            return False
        current = current.parent
    return True
```

#### Frontend Components

**TaskItem Enhancement**:
- Show subtasks in expandable/collapsible section
- Indent subtasks by 20px to indicate hierarchy
- Progress bar showing completion ratio (e.g., "3/5 completed")

**Task Modal Enhancement**:
- "Subtasks" section below description
- "Add Subtask" button
- Subtask list with inline edit/delete
- Drag handles for reordering subtasks

**Subtask Component**:
```tsx
<SubtaskItem>
  <Checkbox />
  <Input inline editable />
  <DeleteButton />
  <DragHandle />
</SubtaskItem>
```

#### UI Patterns

**Parent Task Card**:
```
✓ Launch Authentication Feature
Progress: ████████░░ 75% (3/4 completed)
▼ Subtasks:
    ✓ Design database schema
    ✓ Implement API endpoints
    ✓ Write unit tests
    ☐ Update documentation
Due: Tomorrow
```

**Collapsed Parent**:
```
☐ Launch Authentication Feature [3/4]
Due: Tomorrow
```

#### Completion Logic

**Marking Parent Complete**:
- Prompt: "Mark all subtasks as complete too?"
- If yes: set all subtasks.status = completed, completed_at = now
- If no: only mark parent complete

**Auto-Complete Parent**:
- When last incomplete subtask is checked → auto-mark parent complete
- Show toast: "All subtasks complete! Marked parent as done."

**Uncompleting Parent**:
- Prompt: "Unmark all subtasks too?"
- If yes: set all subtasks.status = pending, completed_at = null
- If no: only unmark parent

#### Priority Inheritance
- Subtasks default to parent's priority when created
- User can override individually
- Changing parent priority prompts: "Update all subtask priorities too?"

#### Constraints & Validation
- **Max Nesting in UI:** 2 levels (parent → child, no grandchildren displayed)
- **Database:** Unlimited nesting supported (for future flexibility)
- **Circular Dependencies:** Validated on backend, prevent A→B→A
- **Orphan Prevention:** CASCADE delete removes subtasks when parent deleted

#### Data Flow
1. User clicks "Add Subtask" in parent task modal
2. POST /api/tasks with parent_task_id
3. Backend validates no circular dependency
4. Subtask created with position = max(siblings.position) + 1
5. GET /api/tasks?include_subtasks=true fetches nested structure
6. Frontend renders parent with expandable subtasks list

#### Drag-and-Drop Reordering
1. User drags subtask to new position in list
2. Frontend computes new positions for affected subtasks
3. PATCH /api/tasks/reorder with array of {id, position}
4. Backend updates positions in transaction
5. React Query invalidates and refetches

#### Testing
- Create parent task with 5 subtasks
- Complete all subtasks → verify parent auto-completes
- Delete parent → verify subtasks cascade delete
- Attempt circular dependency (expect validation error)
- Reorder subtasks and verify positions persist
- Test completion logic prompts
- Verify progress bar accuracy
- Test max nesting enforcement (try creating grandchild, expect restriction)

---

## Implementation Sequence

### Phase 1: Sorting & Search (Week 1)
- Implement toolbar with controls
- Add client-side filtering/sorting
- Test all combinations
- Deploy and gather feedback

### Phase 2: Tags System (Week 2)
- Create database migration
- Implement backend models, schemas, routes
- Build tag management UI
- Integrate tags into task cards and filters
- Test and deploy

### Phase 3: Calendar View (Week 3)
- Install react-big-calendar
- Implement CalendarView component
- Add view toggle
- Style events with priority colors
- Test responsive behavior
- Deploy

### Phase 4: Subtasks (Week 4)
- Create database migration
- Implement backend validation and routes
- Update task modal with subtasks section
- Implement completion logic
- Add drag-and-drop reordering
- Comprehensive testing
- Deploy

## Success Criteria

### Feature 1: Sorting & Search
- [ ] Users can sort tasks by 4 different criteria
- [ ] Search filters tasks in real-time with <300ms debounce
- [ ] Empty search shows helpful message
- [ ] Sort persists when switching filters

### Feature 2: Tags System
- [ ] Users can create, edit, delete tags
- [ ] Tags appear on task cards as colored badges
- [ ] Filtering by tags shows correct results
- [ ] Tag color picker has 10 preset options
- [ ] Cannot create duplicate tag names

### Feature 3: Calendar View
- [ ] Calendar displays all tasks with due dates
- [ ] Clicking event opens task edit modal
- [ ] Events are color-coded by priority
- [ ] Unscheduled tasks appear in sidebar
- [ ] Mobile view switches to agenda format

### Feature 4: Subtasks
- [ ] Users can add unlimited subtasks to any task
- [ ] Progress bar shows accurate completion ratio
- [ ] Completing all subtasks auto-completes parent
- [ ] Deleting parent cascades to subtasks
- [ ] Cannot create circular dependencies
- [ ] Subtasks can be reordered via drag-and-drop

## Technical Considerations

### Performance
- **Sorting/Search:** Client-side operations, no performance impact expected
- **Tags:** Additional JOIN in queries, minimal impact (< 100 tasks)
- **Calendar:** May need virtualization for > 500 tasks
- **Subtasks:** Recursive queries, limit nesting depth to prevent N+1

### Database Migrations
- Use Alembic for all schema changes
- Test migrations on copy of production data
- Plan rollback strategy for each migration
- Document migration dependencies

### Backwards Compatibility
- All new fields are nullable or have defaults
- Existing tasks work without tags/subtasks
- Calendar view is additive (list view still default)
- Sorting/search don't affect API contract

### Error Handling
- Tag creation: handle duplicate names gracefully
- Subtask validation: clear error messages for circular dependencies
- Calendar: handle tasks with invalid dates
- Network errors: show retry option, maintain optimistic updates

## Future Enhancements (Not in Scope)

- Recurring tasks (daily, weekly, monthly patterns)
- Time tracking per task
- Task templates for common workflows
- Bulk operations (select multiple, bulk status change)
- Task dependencies (block/wait relationships)
- Drag-and-drop in calendar view (reschedule tasks)
- Gantt chart view
- Task comments/notes thread
- File attachments
- Task history/audit log

## Appendix

### Color Palette for Tags
```
blue: #3b82f6
green: #10b981
red: #ef4444
yellow: #f59e0b
purple: #8b5cf6
orange: #f97316
pink: #ec4899
teal: #14b8a6
gray: #6b7280
brown: #92400e
```

### Sort Comparison Functions
```typescript
const sortFunctions = {
  dueDate: (a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  },
  priority: (a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  },
  createdDate: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  title: (a, b) => a.title.localeCompare(b.title)
};
```

### API Response Examples

**Task with Tags**:
```json
{
  "id": 1,
  "title": "Implement OAuth",
  "status": "in_progress",
  "priority": "high",
  "tags": [
    {"id": 1, "name": "Backend", "color": "blue"},
    {"id": 3, "name": "Security", "color": "red"}
  ]
}
```

**Task with Subtasks**:
```json
{
  "id": 1,
  "title": "Launch Feature",
  "parent_task_id": null,
  "subtasks": [
    {
      "id": 2,
      "title": "Design schema",
      "parent_task_id": 1,
      "position": 0,
      "status": "completed"
    },
    {
      "id": 3,
      "title": "Write tests",
      "parent_task_id": 1,
      "position": 1,
      "status": "pending"
    }
  ]
}
```
