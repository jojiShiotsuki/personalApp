# AI Business Coach - Design Document

## Overview

An intelligent coaching system that observes CRM activity and proactively surfaces business growth advice via toast notifications. The coach helps users get more clients and increase profitability by analyzing their data and providing timely, actionable recommendations.

## Core Concept

The coach analyzes three types of signals:

- **Actions** - What the user just did (completed task, won deal, added contact)
- **Time triggers** - What needs attention (stale leads, aging deals, overdue follow-ups)
- **Patterns** - Behavioral insights from history (best times, conversion patterns, profitable clients)

## User Experience

### Toast Notifications

As users work in the app, toast notifications slide in from the bottom-right corner with contextual advice:

```
┌─────────────────────────────────────────┐
│ 🎯 Coach                            ✕   │
│                                         │
│ Nice close! Deals from referrals have   │
│ your best margins. Ask Sarah for an     │
│ intro while she's happy.                │
│                                         │
│ [Ask for Referral]  [Dismiss]           │
└─────────────────────────────────────────┘
```

### Coaching Intensity Levels

Users control coaching intensity in Settings:

| Level | Name | Behavior |
|-------|------|----------|
| 1 | Minimal | Only critical business alerts |
| 2 | Balanced | Helpful nudges at key moments (default) |
| 3 | Active Coach | Proactive suggestions and observations |

---

## Backend Design

### Activity Tracking

#### Data Model

New `activity_logs` table captures user actions:

```python
class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True)
    action = Column(String)        # "task_completed", "deal_created", "deal_stage_changed"
    entity_type = Column(String)   # "task", "deal", "contact", "project"
    entity_id = Column(Integer)    # ID of the affected item
    metadata = Column(JSON)        # Additional context
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### Tracked Actions

| Action | Entity | Metadata |
|--------|--------|----------|
| `task_completed` | task | `{priority, had_due_date, days_to_complete}` |
| `task_created` | task | `{priority, has_due_date}` |
| `deal_created` | deal | `{value, stage, contact_id}` |
| `deal_stage_changed` | deal | `{old_stage, new_stage, days_in_stage}` |
| `deal_closed` | deal | `{won: bool, value, days_to_close}` |
| `contact_created` | contact | `{source, status}` |
| `time_logged` | time_entry | `{duration, project_id, is_billable}` |

Activity logging hooks into existing API routes automatically.

### Coach Engine

#### Insight Generation Modes

**1. Reactive (Action-triggered)**

When an action is logged, the coach immediately evaluates if advice is relevant:

```python
# User just closed a deal as won
if action == "deal_closed" and metadata["won"]:
    return Insight(
        type="action",
        message="Great close! This is the perfect moment to ask {contact} for a referral.",
        priority="high",
        suggested_action="create_task",
        action_params={"title": "Ask for referral", "contact_id": ...}
    )
```

**2. Periodic (Time-triggered)**

A background check runs on app load / periodically looking for:
- Deals stuck in a stage > X days
- Contacts not contacted in > Y days
- Overdue tasks piling up
- Morning briefing items

**3. Pattern Analysis**

Periodically aggregates activity logs to find patterns:
- Best day/time for completing tasks
- Average deal cycle length by source
- Which deal stages have the most drop-off
- Highest-value client characteristics

#### Insights Table

```python
class CoachInsight(Base):
    __tablename__ = "coach_insights"

    id = Column(Integer, primary_key=True)
    type = Column(String)          # "action", "time", "pattern"
    message = Column(String)
    priority = Column(String)      # "low", "medium", "high"
    suggested_action = Column(String, nullable=True)
    action_params = Column(JSON, nullable=True)
    seen = Column(Boolean, default=False)
    dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/coach/check` | POST | Check for insights after an action |
| `/api/coach/insights` | GET | Get pending insights |
| `/api/coach/dismiss/{id}` | POST | Mark insight as dismissed |
| `/api/coach/settings` | GET | Get coach settings |
| `/api/coach/settings` | PUT | Update coach settings |

---

## Frontend Design

### Coach Context Provider

A React context manages coach state globally:

```tsx
interface CoachContextType {
  insights: Insight[];
  currentToast: Insight | null;
  dismissInsight: (id: number) => void;
  coachLevel: 1 | 2 | 3;
  setCoachLevel: (level: 1 | 2 | 3) => void;
}

const CoachContext = createContext<CoachContextType>(...);
```

### Toast Behavior

1. **On action** - After mutations (create/update deal, complete task), frontend calls `/api/coach/check` with the action context
2. **On page load** - Fetches pending insights from `/api/coach/insights`
3. **Polling** - Optional light polling every few minutes for time-based alerts

### Toast Component Features

- Auto-dismisses after 10 seconds (configurable by level)
- Queue system: if multiple insights, shows one at a time
- Actions are optional - some toasts are just observations
- Placement: Bottom-right corner, above existing chat bubble

### Settings UI

Add "Coach" section to Settings:

```
┌─────────────────────────────────────────────────────┐
│ 🎯 AI Business Coach                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Coaching Intensity                                  │
│ ┌─────────┬──────────┬──────────────┐              │
│ │ Minimal │ Balanced │ Active Coach │              │
│ └─────────┴──────────┴──────────────┘              │
│                                                     │
│ • Minimal: Only critical alerts                     │
│ • Balanced: Helpful nudges at key moments           │
│ • Active Coach: Proactive tips and observations     │
│                                                     │
│ ─────────────────────────────────────────────────── │
│                                                     │
│ ☑ Show morning briefing                             │
│ ☑ Notify about stale leads (> 7 days)              │
│ ☑ Notify about stuck deals (> 14 days)             │
│ ☐ Show pattern insights (weekly)                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           FRONTEND                              │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │ User Action │───▶│ API Call    │───▶│ CoachContext     │    │
│  │ (complete   │    │ (mutation)  │    │ checks for new   │    │
│  │  task, etc) │    │             │    │ insights, shows  │    │
│  └─────────────┘    └─────────────┘    │ toast if any     │    │
│                                        └──────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                           BACKEND                               │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │ API Route   │───▶│ Log Activity│───▶│ CoachService     │    │
│  │ (tasks,     │    │ (activity   │    │ evaluates and    │    │
│  │  deals...)  │    │  _logs)     │    │ returns insight  │    │
│  └─────────────┘    └─────────────┘    └──────────────────┘    │
│                                                 │               │
│                     ┌───────────────────────────┘               │
│                     ▼                                           │
│  ┌──────────────────────────────────────┐                      │
│  │ Insights Table                        │                      │
│  │ (stores pending/dismissed insights)   │                      │
│  └──────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Settings Storage

For MVP (single-user), settings can be stored in localStorage or a simple `user_settings` table:

```python
class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True)
    coach_level = Column(Integer, default=2)  # 1, 2, or 3
    coach_enabled = Column(Boolean, default=True)
    stale_lead_days = Column(Integer, default=7)
    stuck_deal_days = Column(Integer, default=14)
    show_morning_briefing = Column(Boolean, default=True)
    show_pattern_insights = Column(Boolean, default=False)
```

---

## Example Insights by Trigger Type

### Action-Based
- Deal closed won → "Great close! Ask for a referral while they're happy."
- Task completed → "Nice momentum! Next priority: [next high-priority task]"
- New lead created → "Tip: Leads contacted within 24h convert 3x better."

### Time-Based
- Morning → "Good morning! 2 high-priority tasks today, 1 follow-up overdue."
- Stale lead detected → "3 leads haven't been contacted in 7+ days."
- Stuck deal detected → "Deal with Acme has been in Proposal for 3 weeks."

### Pattern-Based
- "You complete 40% more tasks on Tuesday mornings."
- "Referral leads close 2x faster than cold outreach."
- "Your average deal cycle is 23 days - Acme is at 45 days."
