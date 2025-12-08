# AI Business Coach Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a proactive AI coaching system that observes user activity and provides business growth advice via toast notifications.

**Architecture:** Activity logging captures user actions in the backend. A CoachService analyzes data (reactive, time-based, pattern-based) and generates insights. Frontend polls for insights and displays them as toast notifications. Settings stored in localStorage for MVP.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, TanStack Query, Tailwind CSS

---

## Task 1: Create Activity Log Model

**Files:**
- Create: `backend/app/models/activity_log.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create the activity log model file**

```python
# backend/app/models/activity_log.py
from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime
from app.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=True)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<ActivityLog(id={self.id}, action='{self.action}', entity='{self.entity_type}')>"
```

**Step 2: Export model in __init__.py**

Add to `backend/app/models/__init__.py`:
```python
from app.models.activity_log import ActivityLog
```

**Step 3: Commit**

```bash
git add backend/app/models/activity_log.py backend/app/models/__init__.py
git commit -m "feat(coach): add ActivityLog model"
```

---

## Task 2: Create Coach Insight Model

**Files:**
- Create: `backend/app/models/coach_insight.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create the coach insight model file**

```python
# backend/app/models/coach_insight.py
from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Enum
from datetime import datetime
from app.database import Base
import enum


class InsightType(str, enum.Enum):
    ACTION = "action"
    TIME = "time"
    PATTERN = "pattern"


class InsightPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CoachInsight(Base):
    __tablename__ = "coach_insights"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(InsightType), nullable=False, index=True)
    priority = Column(Enum(InsightPriority), default=InsightPriority.MEDIUM)
    message = Column(String(500), nullable=False)
    suggested_action = Column(String(100), nullable=True)
    action_params = Column(JSON, nullable=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    seen = Column(Boolean, default=False, index=True)
    dismissed = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<CoachInsight(id={self.id}, type='{self.type}', priority='{self.priority}')>"
```

**Step 2: Export model in __init__.py**

Add to `backend/app/models/__init__.py`:
```python
from app.models.coach_insight import CoachInsight, InsightType, InsightPriority
```

**Step 3: Commit**

```bash
git add backend/app/models/coach_insight.py backend/app/models/__init__.py
git commit -m "feat(coach): add CoachInsight model"
```

---

## Task 3: Create Database Migration

**Files:**
- Create: `backend/alembic/versions/xxxx_add_coach_tables.py` (auto-generated)

**Step 1: Generate migration**

```bash
cd backend
venv/Scripts/alembic revision --autogenerate -m "add activity_logs and coach_insights tables"
```

**Step 2: Review the generated migration file**

Verify it creates both tables with correct columns.

**Step 3: Apply migration**

```bash
venv/Scripts/alembic upgrade head
```

**Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat(coach): add migration for activity_logs and coach_insights"
```

---

## Task 4: Create Coach Schemas

**Files:**
- Create: `backend/app/schemas/coach.py`

**Step 1: Create the schema file**

```python
# backend/app/schemas/coach.py
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class InsightType(str, Enum):
    ACTION = "action"
    TIME = "time"
    PATTERN = "pattern"


class InsightPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CoachInsightResponse(BaseModel):
    id: int
    type: InsightType
    priority: InsightPriority
    message: str
    suggested_action: Optional[str] = None
    action_params: Optional[dict[str, Any]] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    seen: bool
    dismissed: bool
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CheckInsightRequest(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class CoachSettingsRequest(BaseModel):
    coach_level: int  # 1, 2, or 3
    coach_enabled: bool = True
    stale_lead_days: int = 7
    stuck_deal_days: int = 14


class CoachSettingsResponse(BaseModel):
    coach_level: int
    coach_enabled: bool
    stale_lead_days: int
    stuck_deal_days: int
```

**Step 2: Commit**

```bash
git add backend/app/schemas/coach.py
git commit -m "feat(coach): add Pydantic schemas for coach API"
```

---

## Task 5: Create Activity Logging Service

**Files:**
- Create: `backend/app/services/activity_service.py`

**Step 1: Create the service file**

```python
# backend/app/services/activity_service.py
from sqlalchemy.orm import Session
from typing import Optional, Any
from datetime import datetime
from app.models.activity_log import ActivityLog


def log_activity(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None
) -> ActivityLog:
    """Log a user activity to the database."""
    activity = ActivityLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata=metadata or {},
        created_at=datetime.utcnow()
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def get_recent_activities(
    db: Session,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100
) -> list[ActivityLog]:
    """Get recent activity logs with optional filtering."""
    query = db.query(ActivityLog).order_by(ActivityLog.created_at.desc())

    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    if action:
        query = query.filter(ActivityLog.action == action)

    return query.limit(limit).all()


def get_activity_counts(
    db: Session,
    entity_type: str,
    days: int = 30
) -> dict[str, int]:
    """Get counts of activities by action type for an entity type."""
    from datetime import timedelta
    from sqlalchemy import func

    since = datetime.utcnow() - timedelta(days=days)

    results = (
        db.query(ActivityLog.action, func.count(ActivityLog.id))
        .filter(ActivityLog.entity_type == entity_type)
        .filter(ActivityLog.created_at >= since)
        .group_by(ActivityLog.action)
        .all()
    )

    return {action: count for action, count in results}
```

**Step 2: Commit**

```bash
git add backend/app/services/activity_service.py
git commit -m "feat(coach): add activity logging service"
```

---

## Task 6: Create Coach Service

**Files:**
- Create: `backend/app/services/coach_service.py`

**Step 1: Create the coach service file**

```python
# backend/app/services/coach_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Any
from datetime import datetime, timedelta
from app.models.coach_insight import CoachInsight, InsightType, InsightPriority
from app.models.crm import Deal, Contact
from app.models.task import Task, TaskStatus
from app.services.activity_service import log_activity


class CoachService:
    def __init__(self, db: Session, coach_level: int = 2):
        self.db = db
        self.coach_level = coach_level  # 1=minimal, 2=balanced, 3=active

    def check_action(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None
    ) -> Optional[CoachInsight]:
        """Check if an action should trigger a coach insight."""
        # Log the activity
        log_activity(self.db, action, entity_type, entity_id, metadata)

        # Generate insight based on action
        insight = self._generate_action_insight(action, entity_type, entity_id, metadata)

        if insight and self._should_show_insight(insight):
            self.db.add(insight)
            self.db.commit()
            self.db.refresh(insight)
            return insight

        return None

    def _generate_action_insight(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[int],
        metadata: Optional[dict[str, Any]]
    ) -> Optional[CoachInsight]:
        """Generate an insight based on the action performed."""
        metadata = metadata or {}

        # Deal closed won
        if action == "deal_closed" and metadata.get("won"):
            contact = self.db.query(Contact).filter(
                Contact.id == metadata.get("contact_id")
            ).first()
            contact_name = contact.name if contact else "the client"

            return CoachInsight(
                type=InsightType.ACTION,
                priority=InsightPriority.HIGH,
                message=f"Great close! This is the perfect moment to ask {contact_name} for a referral while they're happy.",
                suggested_action="create_task",
                action_params={
                    "title": f"Ask {contact_name} for referral",
                    "priority": "high"
                },
                entity_type=entity_type,
                entity_id=entity_id
            )

        # Task completed
        if action == "task_completed" and self.coach_level >= 2:
            # Find next high priority task
            next_task = self.db.query(Task).filter(
                Task.status == TaskStatus.PENDING,
                Task.priority.in_(["high", "urgent"])
            ).order_by(Task.due_date.asc().nullslast()).first()

            if next_task:
                return CoachInsight(
                    type=InsightType.ACTION,
                    priority=InsightPriority.MEDIUM,
                    message=f"Nice work! Next priority: {next_task.title}",
                    suggested_action="view_task",
                    action_params={"task_id": next_task.id},
                    entity_type="task",
                    entity_id=next_task.id
                )

        # Deal created
        if action == "deal_created" and self.coach_level >= 3:
            return CoachInsight(
                type=InsightType.ACTION,
                priority=InsightPriority.LOW,
                message="Tip: Deals with a follow-up task in the first 24 hours close 2x faster. Add a follow-up task?",
                suggested_action="create_task",
                action_params={
                    "title": "Follow up on new deal",
                    "priority": "high"
                },
                entity_type=entity_type,
                entity_id=entity_id
            )

        return None

    def get_time_based_insights(self, stale_lead_days: int = 7, stuck_deal_days: int = 14) -> list[CoachInsight]:
        """Generate time-based insights about stale leads, stuck deals, etc."""
        insights = []

        # Check for stale leads (contacts not contacted recently)
        if self.coach_level >= 1:
            stale_date = datetime.utcnow() - timedelta(days=stale_lead_days)
            stale_contacts = self.db.query(Contact).filter(
                Contact.status.in_(["LEAD", "PROSPECT"]),
                Contact.updated_at < stale_date
            ).limit(5).all()

            if stale_contacts:
                names = ", ".join([c.name for c in stale_contacts[:3]])
                remaining = len(stale_contacts) - 3
                suffix = f" and {remaining} more" if remaining > 0 else ""

                existing = self.db.query(CoachInsight).filter(
                    CoachInsight.suggested_action == "view_stale_leads",
                    CoachInsight.dismissed == False,
                    CoachInsight.created_at > datetime.utcnow() - timedelta(hours=24)
                ).first()

                if not existing:
                    insights.append(CoachInsight(
                        type=InsightType.TIME,
                        priority=InsightPriority.HIGH,
                        message=f"Warm leads going cold: {names}{suffix} haven't been contacted in {stale_lead_days}+ days.",
                        suggested_action="view_stale_leads",
                        action_params={"contact_ids": [c.id for c in stale_contacts]}
                    ))

        # Check for stuck deals
        if self.coach_level >= 1:
            stuck_date = datetime.utcnow() - timedelta(days=stuck_deal_days)
            stuck_deals = self.db.query(Deal).filter(
                Deal.stage.notin_(["Closed Won", "Closed Lost"]),
                Deal.updated_at < stuck_date
            ).limit(5).all()

            if stuck_deals:
                for deal in stuck_deals[:2]:
                    existing = self.db.query(CoachInsight).filter(
                        CoachInsight.entity_type == "deal",
                        CoachInsight.entity_id == deal.id,
                        CoachInsight.dismissed == False,
                        CoachInsight.created_at > datetime.utcnow() - timedelta(hours=24)
                    ).first()

                    if not existing:
                        days_stuck = (datetime.utcnow() - deal.updated_at).days
                        insights.append(CoachInsight(
                            type=InsightType.TIME,
                            priority=InsightPriority.MEDIUM,
                            message=f"Deal '{deal.title}' has been in {deal.stage} stage for {days_stuck} days. Time to move it forward?",
                            suggested_action="view_deal",
                            action_params={"deal_id": deal.id},
                            entity_type="deal",
                            entity_id=deal.id
                        ))

        # Overdue tasks
        if self.coach_level >= 2:
            overdue_count = self.db.query(func.count(Task.id)).filter(
                Task.status != TaskStatus.COMPLETED,
                Task.due_date < datetime.utcnow().date()
            ).scalar()

            if overdue_count and overdue_count > 0:
                existing = self.db.query(CoachInsight).filter(
                    CoachInsight.suggested_action == "view_overdue_tasks",
                    CoachInsight.dismissed == False,
                    CoachInsight.created_at > datetime.utcnow() - timedelta(hours=12)
                ).first()

                if not existing:
                    insights.append(CoachInsight(
                        type=InsightType.TIME,
                        priority=InsightPriority.HIGH,
                        message=f"You have {overdue_count} overdue task{'s' if overdue_count > 1 else ''}. Let's clear the backlog!",
                        suggested_action="view_overdue_tasks"
                    ))

        return insights

    def get_pattern_insights(self) -> list[CoachInsight]:
        """Generate pattern-based insights from historical data."""
        insights = []

        if self.coach_level < 3:
            return insights

        # This is a placeholder for more sophisticated pattern analysis
        # In a full implementation, you'd analyze:
        # - Best times for task completion
        # - Deal conversion patterns by source
        # - Response time correlations

        return insights

    def _should_show_insight(self, insight: CoachInsight) -> bool:
        """Check if insight meets the current coach level threshold."""
        level_thresholds = {
            1: [InsightPriority.HIGH],
            2: [InsightPriority.HIGH, InsightPriority.MEDIUM],
            3: [InsightPriority.HIGH, InsightPriority.MEDIUM, InsightPriority.LOW]
        }

        return insight.priority in level_thresholds.get(self.coach_level, [])

    def get_pending_insights(self, limit: int = 10) -> list[CoachInsight]:
        """Get pending (unseen, not dismissed) insights."""
        return self.db.query(CoachInsight).filter(
            CoachInsight.dismissed == False
        ).order_by(
            CoachInsight.priority.desc(),
            CoachInsight.created_at.desc()
        ).limit(limit).all()

    def mark_seen(self, insight_id: int) -> bool:
        """Mark an insight as seen."""
        insight = self.db.query(CoachInsight).filter(CoachInsight.id == insight_id).first()
        if insight:
            insight.seen = True
            self.db.commit()
            return True
        return False

    def dismiss_insight(self, insight_id: int) -> bool:
        """Dismiss an insight."""
        insight = self.db.query(CoachInsight).filter(CoachInsight.id == insight_id).first()
        if insight:
            insight.dismissed = True
            self.db.commit()
            return True
        return False
```

**Step 2: Commit**

```bash
git add backend/app/services/coach_service.py
git commit -m "feat(coach): add CoachService with action, time, and pattern insights"
```

---

## Task 7: Create Coach Routes

**Files:**
- Create: `backend/app/routes/coach.py`
- Modify: `backend/app/main.py`

**Step 1: Create the routes file**

```python
# backend/app/routes/coach.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.schemas.coach import (
    CoachInsightResponse,
    CheckInsightRequest,
)
from app.services.coach_service import CoachService

router = APIRouter(prefix="/api/coach", tags=["coach"])


@router.post("/check", response_model=Optional[CoachInsightResponse])
def check_for_insight(
    request: CheckInsightRequest,
    coach_level: int = 2,
    db: Session = Depends(get_db)
):
    """Check if an action should trigger a coach insight."""
    service = CoachService(db, coach_level)
    insight = service.check_action(
        action=request.action,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        metadata=request.metadata
    )
    return insight


@router.get("/insights", response_model=list[CoachInsightResponse])
def get_insights(
    coach_level: int = 2,
    stale_lead_days: int = 7,
    stuck_deal_days: int = 14,
    db: Session = Depends(get_db)
):
    """Get pending coach insights including time-based checks."""
    service = CoachService(db, coach_level)

    # Generate any new time-based insights
    time_insights = service.get_time_based_insights(stale_lead_days, stuck_deal_days)
    for insight in time_insights:
        db.add(insight)
    if time_insights:
        db.commit()

    # Return all pending insights
    return service.get_pending_insights()


@router.post("/insights/{insight_id}/seen")
def mark_insight_seen(insight_id: int, db: Session = Depends(get_db)):
    """Mark an insight as seen."""
    service = CoachService(db)
    success = service.mark_seen(insight_id)
    return {"success": success}


@router.post("/insights/{insight_id}/dismiss")
def dismiss_insight(insight_id: int, db: Session = Depends(get_db)):
    """Dismiss an insight."""
    service = CoachService(db)
    success = service.dismiss_insight(insight_id)
    return {"success": success}
```

**Step 2: Register the router in main.py**

Add to imports in `backend/app/main.py`:
```python
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects, ai, social_content, dashboard, time, outreach, coach
```

Add after other router includes:
```python
app.include_router(coach.router)
```

**Step 3: Commit**

```bash
git add backend/app/routes/coach.py backend/app/main.py
git commit -m "feat(coach): add coach API routes"
```

---

## Task 8: Add Activity Logging to Existing Routes

**Files:**
- Modify: `backend/app/routes/tasks.py`
- Modify: `backend/app/routes/crm.py`

**Step 1: Update tasks.py to log activities**

Add import at top of `backend/app/routes/tasks.py`:
```python
from app.services.activity_service import log_activity
```

In `create_task` function, after `db.refresh(db_task)` and before return:
```python
    # Log activity
    log_activity(db, "task_created", "task", db_task.id, {
        "priority": db_task.priority.value if db_task.priority else None,
        "has_due_date": db_task.due_date is not None
    })
```

In `update_task` function, after the status completion check, add:
```python
    # Log activity if task was completed
    if "status" in update_data and update_data["status"] == TaskStatus.COMPLETED:
        days_to_complete = None
        if db_task.created_at:
            days_to_complete = (datetime.utcnow() - db_task.created_at).days
        log_activity(db, "task_completed", "task", task_id, {
            "priority": db_task.priority.value if db_task.priority else None,
            "days_to_complete": days_to_complete
        })
```

**Step 2: Update crm.py to log deal activities**

Add import at top of `backend/app/routes/crm.py`:
```python
from app.services.activity_service import log_activity
```

In the deal creation endpoint, after commit and before return:
```python
    # Log activity
    log_activity(db, "deal_created", "deal", db_deal.id, {
        "value": db_deal.value,
        "stage": db_deal.stage,
        "contact_id": db_deal.contact_id
    })
```

In the deal update endpoint, add stage change logging:
```python
    # Log activity if deal stage changed or closed
    if "stage" in update_data:
        new_stage = update_data["stage"]
        if new_stage in ["Closed Won", "Closed Lost"]:
            log_activity(db, "deal_closed", "deal", deal_id, {
                "won": new_stage == "Closed Won",
                "value": db_deal.value,
                "contact_id": db_deal.contact_id,
                "days_to_close": (datetime.utcnow() - db_deal.created_at).days if db_deal.created_at else None
            })
        else:
            log_activity(db, "deal_stage_changed", "deal", deal_id, {
                "old_stage": old_stage if 'old_stage' in locals() else None,
                "new_stage": new_stage
            })
```

**Step 3: Commit**

```bash
git add backend/app/routes/tasks.py backend/app/routes/crm.py
git commit -m "feat(coach): add activity logging to task and deal routes"
```

---

## Task 9: Add Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add coach-related types**

Add at end of `frontend/src/types/index.ts`:
```typescript
// Coach Types
export type InsightType = 'action' | 'time' | 'pattern';
export type InsightPriority = 'low' | 'medium' | 'high';

export interface CoachInsight {
  id: number;
  type: InsightType;
  priority: InsightPriority;
  message: string;
  suggested_action?: string;
  action_params?: Record<string, any>;
  entity_type?: string;
  entity_id?: number;
  seen: boolean;
  dismissed: boolean;
  created_at: string;
  expires_at?: string;
}

export interface CoachSettings {
  coach_level: 1 | 2 | 3;
  coach_enabled: boolean;
  stale_lead_days: number;
  stuck_deal_days: number;
}

export interface CheckInsightRequest {
  action: string;
  entity_type: string;
  entity_id?: number;
  metadata?: Record<string, any>;
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(coach): add TypeScript types for coach feature"
```

---

## Task 10: Add Coach API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add coach API functions**

Add at end of `frontend/src/lib/api.ts`:
```typescript
// Coach API
export const coachApi = {
  checkAction: async (
    request: CheckInsightRequest,
    settings: CoachSettings
  ): Promise<CoachInsight | null> => {
    const params = new URLSearchParams({
      coach_level: settings.coach_level.toString(),
    });
    const response = await api.post(`/api/coach/check?${params}`, request);
    return response.data;
  },

  getInsights: async (settings: CoachSettings): Promise<CoachInsight[]> => {
    const params = new URLSearchParams({
      coach_level: settings.coach_level.toString(),
      stale_lead_days: settings.stale_lead_days.toString(),
      stuck_deal_days: settings.stuck_deal_days.toString(),
    });
    const response = await api.get(`/api/coach/insights?${params}`);
    return response.data;
  },

  markSeen: async (insightId: number): Promise<{ success: boolean }> => {
    const response = await api.post(`/api/coach/insights/${insightId}/seen`);
    return response.data;
  },

  dismissInsight: async (insightId: number): Promise<{ success: boolean }> => {
    const response = await api.post(`/api/coach/insights/${insightId}/dismiss`);
    return response.data;
  },
};
```

Add to imports at top:
```typescript
import type {
  // ... existing imports
  CoachInsight,
  CoachSettings,
  CheckInsightRequest,
} from '../types/index';
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(coach): add coach API client functions"
```

---

## Task 11: Create Coach Context Provider

**Files:**
- Create: `frontend/src/contexts/CoachContext.tsx`

**Step 1: Create the context file**

```typescript
// frontend/src/contexts/CoachContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coachApi } from '../lib/api';
import type { CoachInsight, CoachSettings, CheckInsightRequest } from '../types/index';

interface CoachContextType {
  insights: CoachInsight[];
  currentToast: CoachInsight | null;
  settings: CoachSettings;
  updateSettings: (settings: Partial<CoachSettings>) => void;
  dismissInsight: (id: number) => void;
  checkAction: (request: CheckInsightRequest) => Promise<void>;
  dismissCurrentToast: () => void;
}

const defaultSettings: CoachSettings = {
  coach_level: 2,
  coach_enabled: true,
  stale_lead_days: 7,
  stuck_deal_days: 14,
};

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<CoachSettings>(() => {
    const stored = localStorage.getItem('coachSettings');
    return stored ? JSON.parse(stored) : defaultSettings;
  });
  const [currentToast, setCurrentToast] = useState<CoachInsight | null>(null);
  const [toastQueue, setToastQueue] = useState<CoachInsight[]>([]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('coachSettings', JSON.stringify(settings));
  }, [settings]);

  // Fetch insights
  const { data: insights = [] } = useQuery({
    queryKey: ['coachInsights', settings],
    queryFn: () => coachApi.getInsights(settings),
    enabled: settings.coach_enabled,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: coachApi.dismissInsight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    },
  });

  // Show next toast from queue
  useEffect(() => {
    if (!currentToast && toastQueue.length > 0) {
      const [next, ...rest] = toastQueue;
      setCurrentToast(next);
      setToastQueue(rest);

      // Mark as seen
      coachApi.markSeen(next.id);
    }
  }, [currentToast, toastQueue]);

  // Queue new insights as toasts
  useEffect(() => {
    const unseenInsights = insights.filter(i => !i.seen && !i.dismissed);
    if (unseenInsights.length > 0) {
      setToastQueue(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const newInsights = unseenInsights.filter(i => !existingIds.has(i.id));
        return [...prev, ...newInsights];
      });
    }
  }, [insights]);

  // Auto-dismiss toast after delay
  useEffect(() => {
    if (currentToast) {
      const delay = settings.coach_level === 3 ? 15000 : settings.coach_level === 2 ? 10000 : 8000;
      const timer = setTimeout(() => {
        setCurrentToast(null);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [currentToast, settings.coach_level]);

  const updateSettings = useCallback((newSettings: Partial<CoachSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const dismissInsight = useCallback((id: number) => {
    dismissMutation.mutate(id);
    if (currentToast?.id === id) {
      setCurrentToast(null);
    }
  }, [dismissMutation, currentToast]);

  const dismissCurrentToast = useCallback(() => {
    if (currentToast) {
      dismissMutation.mutate(currentToast.id);
      setCurrentToast(null);
    }
  }, [currentToast, dismissMutation]);

  const checkAction = useCallback(async (request: CheckInsightRequest) => {
    if (!settings.coach_enabled) return;

    try {
      const insight = await coachApi.checkAction(request, settings);
      if (insight) {
        setToastQueue(prev => [...prev, insight]);
      }
    } catch (error) {
      console.error('Failed to check action for insights:', error);
    }
  }, [settings]);

  return (
    <CoachContext.Provider
      value={{
        insights,
        currentToast,
        settings,
        updateSettings,
        dismissInsight,
        checkAction,
        dismissCurrentToast,
      }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoach() {
  const context = useContext(CoachContext);
  if (context === undefined) {
    throw new Error('useCoach must be used within a CoachProvider');
  }
  return context;
}
```

**Step 2: Commit**

```bash
git add frontend/src/contexts/CoachContext.tsx
git commit -m "feat(coach): add CoachContext provider with toast queue"
```

---

## Task 12: Create Toast Component

**Files:**
- Create: `frontend/src/components/CoachToast.tsx`

**Step 1: Create the toast component**

```typescript
// frontend/src/components/CoachToast.tsx
import { X, Lightbulb, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react';
import { useCoach } from '../contexts/CoachContext';
import { cn } from '../lib/utils';
import type { CoachInsight } from '../types/index';

const typeIcons = {
  action: Lightbulb,
  time: AlertTriangle,
  pattern: TrendingUp,
};

const priorityColors = {
  high: 'border-l-red-500',
  medium: 'border-l-blue-500',
  low: 'border-l-gray-400',
};

export function CoachToast() {
  const { currentToast, dismissCurrentToast, dismissInsight } = useCoach();

  if (!currentToast) return null;

  const Icon = typeIcons[currentToast.type];

  const handleAction = () => {
    // Handle the suggested action
    if (currentToast.suggested_action === 'view_task' && currentToast.action_params?.task_id) {
      // Navigate to tasks page or open task
      window.location.href = '/tasks';
    } else if (currentToast.suggested_action === 'view_deal' && currentToast.action_params?.deal_id) {
      window.location.href = '/deals';
    } else if (currentToast.suggested_action === 'view_stale_leads') {
      window.location.href = '/contacts';
    } else if (currentToast.suggested_action === 'view_overdue_tasks') {
      window.location.href = '/tasks';
    } else if (currentToast.suggested_action === 'create_task') {
      // Could open a task creation modal - for now just go to tasks
      window.location.href = '/tasks';
    }
    dismissCurrentToast();
  };

  return (
    <div
      className={cn(
        'fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]',
        'animate-in slide-in-from-right-full duration-300'
      )}
    >
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-xl shadow-2xl',
          'border border-gray-200 dark:border-slate-700',
          'border-l-4',
          priorityColors[currentToast.priority]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-1.5 rounded-lg',
              currentToast.priority === 'high'
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : currentToast.priority === 'medium'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-gray-900 dark:text-white">
              Coach
            </span>
          </div>
          <button
            onClick={() => dismissInsight(currentToast.id)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
            {currentToast.message}
          </p>
        </div>

        {/* Actions */}
        {currentToast.suggested_action && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={handleAction}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg',
                'bg-blue-600 text-white hover:bg-blue-700',
                'transition-colors'
              )}
            >
              Take Action
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={dismissCurrentToast}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg',
                'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700',
                'transition-colors'
              )}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/CoachToast.tsx
git commit -m "feat(coach): add CoachToast component"
```

---

## Task 13: Create Settings Page

**Files:**
- Create: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create the Settings page**

```typescript
// frontend/src/pages/Settings.tsx
import { Settings as SettingsIcon, Brain, Bell, Clock } from 'lucide-react';
import { useCoach } from '../contexts/CoachContext';
import { cn } from '../lib/utils';

export default function Settings() {
  const { settings, updateSettings } = useCoach();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200/60 dark:border-slate-700/60 px-8 py-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Configure your app preferences
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6 bg-gray-50 dark:bg-slate-900">
        <div className="max-w-2xl space-y-6">
          {/* AI Coach Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Business Coach
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Get proactive advice to grow your business
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Enable Coach
                  </label>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Receive coaching tips and insights
                  </p>
                </div>
                <button
                  onClick={() => updateSettings({ coach_enabled: !settings.coach_enabled })}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.coach_enabled
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.coach_enabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {/* Coaching Intensity */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Coaching Intensity
                </label>
                <div className="flex items-center bg-gray-100 dark:bg-slate-700 p-1 rounded-xl">
                  {[
                    { level: 1, label: 'Minimal', desc: 'Only critical alerts' },
                    { level: 2, label: 'Balanced', desc: 'Helpful nudges at key moments' },
                    { level: 3, label: 'Active', desc: 'Proactive tips and observations' },
                  ].map(({ level, label }) => (
                    <button
                      key={level}
                      onClick={() => updateSettings({ coach_level: level as 1 | 2 | 3 })}
                      className={cn(
                        'flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all',
                        settings.coach_level === level
                          ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                  {settings.coach_level === 1 && 'Only critical alerts like deals going cold'}
                  {settings.coach_level === 2 && 'Helpful nudges at natural moments'}
                  {settings.coach_level === 3 && 'Proactive suggestions and pattern insights'}
                </p>
              </div>

              {/* Alert Thresholds */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Alert Thresholds
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">
                      Stale lead alert (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.stale_lead_days}
                      onChange={(e) => updateSettings({ stale_lead_days: parseInt(e.target.value) || 7 })}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg',
                        'bg-gray-50 dark:bg-slate-700',
                        'border border-gray-200 dark:border-slate-600',
                        'text-gray-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">
                      Stuck deal alert (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.stuck_deal_days}
                      onChange={(e) => updateSettings({ stuck_deal_days: parseInt(e.target.value) || 14 })}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg',
                        'bg-gray-50 dark:bg-slate-700',
                        'border border-gray-200 dark:border-slate-600',
                        'text-gray-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

Add import:
```typescript
import Settings from './pages/Settings';
```

Add route inside Routes:
```typescript
<Route path="/settings" element={<Settings />} />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/App.tsx
git commit -m "feat(coach): add Settings page with coach configuration"
```

---

## Task 14: Integrate Coach into Layout

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Add Settings to sidebar navigation**

In `frontend/src/components/Layout.tsx`, add Settings to the navigation array:
```typescript
import { Settings } from 'lucide-react';

// In the navigation array:
{ name: 'Settings', href: '/settings', icon: Settings },
```

**Step 2: Add CoachToast to Layout**

Import at top:
```typescript
import { CoachToast } from './CoachToast';
```

Add before closing `</div>` of the main layout wrapper:
```typescript
<CoachToast />
```

**Step 3: Wrap App with CoachProvider**

In `frontend/src/App.tsx`, import and wrap:
```typescript
import { CoachProvider } from './contexts/CoachContext';

// Wrap the app content:
<CoachProvider>
  {/* existing app content */}
</CoachProvider>
```

**Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/App.tsx
git commit -m "feat(coach): integrate CoachProvider and CoachToast into app"
```

---

## Task 15: Wire Up Coach Actions in Task Mutations

**Files:**
- Modify: `frontend/src/pages/Tasks.tsx`

**Step 1: Add coach integration to task completion**

Import useCoach:
```typescript
import { useCoach } from '../contexts/CoachContext';
```

Inside the component, get checkAction:
```typescript
const { checkAction } = useCoach();
```

In the task update mutation's onSuccess, add:
```typescript
// After successful task completion, notify coach
if (variables.task.status === 'completed') {
  checkAction({
    action: 'task_completed',
    entity_type: 'task',
    entity_id: variables.id,
    metadata: { priority: variables.task.priority }
  });
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Tasks.tsx
git commit -m "feat(coach): wire up task completion to coach"
```

---

## Task 16: Wire Up Coach Actions in Deal Mutations

**Files:**
- Modify: `frontend/src/pages/Deals.tsx`

**Step 1: Add coach integration to deal updates**

Import useCoach:
```typescript
import { useCoach } from '../contexts/CoachContext';
```

Inside the component:
```typescript
const { checkAction } = useCoach();
```

In the deal update mutation's onSuccess, add:
```typescript
// Notify coach about deal changes
if (variables.deal.stage === 'Closed Won') {
  checkAction({
    action: 'deal_closed',
    entity_type: 'deal',
    entity_id: variables.id,
    metadata: { won: true, value: variables.deal.value }
  });
} else if (variables.deal.stage === 'Closed Lost') {
  checkAction({
    action: 'deal_closed',
    entity_type: 'deal',
    entity_id: variables.id,
    metadata: { won: false }
  });
}
```

In the deal create mutation's onSuccess:
```typescript
checkAction({
  action: 'deal_created',
  entity_type: 'deal',
  entity_id: data.id,
  metadata: { value: data.value, stage: data.stage }
});
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Deals.tsx
git commit -m "feat(coach): wire up deal actions to coach"
```

---

## Task 17: Final Integration Test

**Step 1: Start backend in worktree**

```bash
cd C:/Apps/personalApp/.worktrees/feature/ai-business-coach/backend
venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8001
```

**Step 2: Start frontend in worktree**

```bash
cd C:/Apps/personalApp/.worktrees/feature/ai-business-coach/frontend
npm run dev -- --port 5174
```

**Step 3: Test the feature**

1. Navigate to Settings → verify coach settings UI works
2. Complete a task → verify toast appears
3. Create a deal → verify toast appears (at level 3)
4. Wait for time-based insights to appear

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(coach): complete AI Business Coach implementation"
```

---

## Summary

This implementation plan covers:
1. Backend models for activity logging and insights
2. Database migration
3. Coach service with action/time/pattern insight generation
4. API routes for coach functionality
5. Activity logging in existing task/deal routes
6. Frontend types and API client
7. React context for coach state management
8. Toast notification component
9. Settings page for coach configuration
10. Integration into Layout and existing pages

Total: 17 tasks with incremental commits for easy rollback if needed.
