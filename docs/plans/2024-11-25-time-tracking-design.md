# Time Tracking Feature Design

## Overview

A timer feature for freelancers to track billable time on tasks, projects, and deals. Supports live timer with pause/resume, manual time entry, hourly rates, and billing summaries.

## Design Decisions

- **Track time against**: Tasks, Projects, AND Deals (all three, with auto-linking)
- **UI placement**: Floating widget + contextual buttons on cards
- **Controls**: Start, Stop, Pause/Resume, Manual entry
- **Billing**: Hourly rates on deals/projects, see dollar amounts
- **Views**: Dedicated /time page + embedded on detail views

---

## Data Model

### TimeEntry Table

```sql
time_entries:
  - id: INTEGER PRIMARY KEY
  - description: TEXT
  - start_time: DATETIME
  - end_time: DATETIME (null if running)
  - duration_seconds: INTEGER (calculated on stop, allows manual override)
  - is_running: BOOLEAN DEFAULT FALSE
  - is_paused: BOOLEAN DEFAULT FALSE
  - paused_duration_seconds: INTEGER DEFAULT 0
  - task_id: INTEGER FK -> tasks (optional)
  - project_id: INTEGER FK -> projects (optional)
  - deal_id: INTEGER FK -> deals (optional)
  - hourly_rate: DECIMAL (copied from deal/project at creation, or manual)
  - created_at: DATETIME
  - updated_at: DATETIME
```

### Model Updates

- Add `hourly_rate: DECIMAL` to **Deal** model
- Add `hourly_rate: DECIMAL` to **Project** model

### Constraints

- Only ONE time entry can have `is_running = true` at a time
- At least one of task_id/project_id/deal_id should be set (or allow unlinked for "general" time)

---

## UI Components

### 1. Floating Timer Widget

**Position:** Bottom-left corner (AI chat is bottom-right)

**Collapsed state (no timer running):**
- Small circular button with clock icon
- Click to expand and start new timer

**Expanded state (timer running):**
```
┌─────────────────────────────────┐
│ ▶ 01:23:45                    ✕ │
│ "Fix login bug"                 │
│ Task: Fix auth flow             │
│ Deal: Acme Corp                 │
│ ─────────────────────────────── │
│ [⏸ Pause]  [■ Stop]            │
└─────────────────────────────────┘
```

**Widget behaviors:**
- Shows live ticking time (updates every second)
- Shows what it's linked to (task/project/deal names)
- **Pause** → timer pauses, button changes to "Resume"
- **Stop** → saves time entry, widget collapses, shows "Saved: 1h 23m" toast
- **X** → just collapses widget (timer keeps running in background)
- Click anywhere on collapsed widget when running → expands

**Visual states:**
- Running: Green pulse/glow
- Paused: Yellow/amber
- Nothing running: Neutral gray

### 2. Contextual Timer Buttons

**Where buttons appear:**
- Task cards/items (Tasks page, Kanban boards)
- Project cards (Projects page)
- Deal cards (Deals page, Kanban)

**Button design:**
- Small clock icon, appears on hover
- If timer running on THIS item → show stop button
- If timer running on DIFFERENT item → clock with warning tooltip

**Auto-linking logic:**
- Task → look up its project_id → look up project's deal_id
- Start timer with all three linked automatically
- Clicking timer on a task gives full billing chain

### 3. Time Page (/time)

**Layout - Three sections:**

**Summary Cards (top):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Today        │ │ This Week    │ │ This Month   │
│ 4h 32m       │ │ 23h 15m      │ │ 87h 42m      │
│ $340.00      │ │ $1,743.75    │ │ $6,577.50    │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Filters:**
- Date range picker (This week / This month / Custom)
- Filter by: Deal, Project, Task
- Billable/Non-billable toggle

**Time Entries List:**
```
┌─────────────────────────────────────────────────────────────┐
│ Today, Nov 25                                               │
├─────────────────────────────────────────────────────────────┤
│ 2:15 PM - 4:30 PM  │ Fix login bug        │ 2h 15m │ $168  │
│                    │ Acme Corp · Auth Fix │        │       │
├─────────────────────────────────────────────────────────────┤
│ 9:00 AM - 12:15 PM │ API integration      │ 3h 15m │ $243  │
│                    │ Beta Inc · Backend   │        │       │
└─────────────────────────────────────────────────────────────┘
```

**Actions:**
- Click to edit entry
- Delete entry
- "+ Add Manual Entry" button

### 4. Embedded Time Views

**On Deal/Project detail views:**
```
┌─────────────────────────────────────────┐
│ ⏱️ Time Tracked                         │
│ Total: 12h 30m · $937.50                │
│ ─────────────────────────────────────── │
│ • Fix login bug (2h 15m)                │
│ • API integration (3h 15m)              │
│ • ... 3 more entries                    │
│ [View All Time]                         │
└─────────────────────────────────────────┘
```

- Show max 3-5 recent entries
- Always show total hours + dollars
- "View All" → Time page pre-filtered

---

## Backend API

### Timer Control

```
POST   /api/time/start          - Start new timer
POST   /api/time/stop           - Stop running timer
POST   /api/time/pause          - Pause running timer
POST   /api/time/resume         - Resume paused timer
GET    /api/time/current        - Get current running timer
```

### Time Entries CRUD

```
GET    /api/time/entries        - List entries (with filters)
POST   /api/time/entries        - Create manual entry
GET    /api/time/entries/:id    - Get single entry
PUT    /api/time/entries/:id    - Update entry
DELETE /api/time/entries/:id    - Delete entry
```

### Summaries

```
GET    /api/time/summary              - Get totals (today/week/month)
GET    /api/time/summary/deal/:id     - Totals for a deal
GET    /api/time/summary/project/:id  - Totals for a project
```

### Request/Response Examples

**Start timer:**
```json
POST /api/time/start
{
  "description": "Working on login fix",
  "task_id": 42,
  "project_id": 5,
  "deal_id": 3,
  "hourly_rate": 75.00
}
```

**List entries filters:**
- `?start_date=2024-01-01&end_date=2024-01-31`
- `?deal_id=3` or `?project_id=5` or `?task_id=42`

---

## Frontend State Management

### TimerContext

```typescript
interface TimerState {
  currentEntry: TimeEntry | null;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
}

interface TimerContextType {
  state: TimerState;
  startTimer: (options: StartTimerOptions) => Promise<void>;
  stopTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
}
```

### Behavior

1. On app load → fetch `/api/time/current` to restore running timer
2. If timer running → start JS interval to tick every second
3. Timer widget subscribes to context
4. Contextual buttons call `startTimer()` with entity IDs
5. On stop → POST to API, invalidate queries, reset state

### React Query Integration

- `useQuery(['time', 'current'])` - current running timer
- `useQuery(['time', 'entries'], filters)` - time entries list
- `useQuery(['time', 'summary'])` - totals for dashboard
- Mutations for start/stop/pause with `invalidateQueries`

---

## Implementation Order

1. **Database**: TimeEntry model, add hourly_rate to Deal/Project
2. **Backend API**: Timer control + CRUD endpoints
3. **TimerContext**: Frontend state management
4. **Floating Widget**: Timer UI component
5. **Time Page**: /time route with list and summaries
6. **Contextual Buttons**: Add to task/project/deal cards
7. **Embedded Views**: Time summaries on detail pages
