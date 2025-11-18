# Social Media Content Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a hierarchical content planning system (Year → Month → Week → Day) for social media with script tracking, editing notes, and optional project integration.

**Architecture:** Hybrid approach with standalone content calendar that optionally links to existing Projects/Tasks. Backend uses SQLAlchemy model with FastAPI routes. Frontend uses React with hierarchical navigation (YearView → MonthView → WeekView → DayContentModal).

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React, TypeScript, TanStack Query, date-fns

---

## Phase 1: Database Model & Schema

### Task 1: Create SocialContent Model

**Files:**
- Create: `backend/app/models/social_content.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/database/connection.py:30-38`

**Step 1: Create the model file with enums and SocialContent class**

Create `backend/app/models/social_content.py`:

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class ContentType(str, enum.Enum):
    REEL = "reel"
    CAROUSEL = "carousel"
    SINGLE_POST = "single_post"
    STORY = "story"
    TIKTOK = "tiktok"
    YOUTUBE_SHORT = "youtube_short"
    YOUTUBE_VIDEO = "youtube_video"
    BLOG_POST = "blog_post"


class ContentStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    SCRIPTED = "scripted"
    FILMED = "filmed"
    EDITING = "editing"
    SCHEDULED = "scheduled"
    POSTED = "posted"


class EditingStyle(str, enum.Enum):
    FAST_PACED = "fast_paced"
    CINEMATIC = "cinematic"
    EDUCATIONAL = "educational"
    BEHIND_SCENES = "behind_scenes"
    TRENDING = "trending"
    TUTORIAL = "tutorial"
    INTERVIEW = "interview"
    CUSTOM = "custom"


class SocialContent(Base):
    __tablename__ = "social_content"

    # Primary fields
    id = Column(Integer, primary_key=True, index=True)
    content_date = Column(Date, nullable=False, index=True)

    # Required content fields
    content_type = Column(Enum(ContentType), nullable=False)
    status = Column(Enum(ContentStatus), default=ContentStatus.NOT_STARTED)

    # Script/Caption - main content
    script = Column(Text, nullable=True)

    # Editing details
    editing_style = Column(Enum(EditingStyle), nullable=True)
    editing_notes = Column(Text, nullable=True)

    # Platform targeting (stored as JSON array)
    platforms = Column(JSON, nullable=True)

    # Optional metadata
    hashtags = Column(Text, nullable=True)
    music_audio = Column(String(255), nullable=True)
    thumbnail_reference = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    # Optional integration with existing features
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", backref="social_content")

    def __repr__(self):
        return f"<SocialContent(id={self.id}, date={self.content_date}, type={self.content_type})>"
```

**Step 2: Import model in __init__.py**

Modify `backend/app/models/__init__.py`, add import:

```python
from app.models.social_content import SocialContent, ContentType, ContentStatus, EditingStyle
```

**Step 3: Import model in database connection for init_db**

Modify `backend/app/database/connection.py`, in the `init_db()` function after line 34, add:

```python
        from app.models.social_content import SocialContent
```

**Step 4: Create database migration**

Run:
```bash
cd backend
venv/Scripts/alembic revision --autogenerate -m "add social content table"
```

Expected: Migration file created in `backend/alembic/versions/`

**Step 5: Apply migration**

Run:
```bash
cd backend
venv/Scripts/alembic upgrade head
```

Expected: Table `social_content` created in database

**Step 6: Verify table creation**

Run Python to check:
```bash
cd backend
venv/Scripts/python -c "from app.database import engine; from sqlalchemy import inspect; print(inspect(engine).get_table_names())"
```

Expected: Output includes `social_content`

**Step 7: Commit**

```bash
git add backend/app/models/social_content.py backend/app/models/__init__.py backend/app/database/connection.py backend/alembic/versions/*social_content*.py
git commit -m "feat: add SocialContent model and database migration"
```

---

### Task 2: Create Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/social_content.py`
- Modify: `backend/app/schemas/__init__.py`

**Step 1: Create schema file**

Create `backend/app/schemas/social_content.py`:

```python
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
from app.models.social_content import ContentType, ContentStatus, EditingStyle


class SocialContentBase(BaseModel):
    content_date: date
    content_type: ContentType
    status: ContentStatus = ContentStatus.NOT_STARTED
    script: Optional[str] = None
    editing_style: Optional[EditingStyle] = None
    editing_notes: Optional[str] = None
    platforms: Optional[List[str]] = None
    hashtags: Optional[str] = None
    music_audio: Optional[str] = None
    thumbnail_reference: Optional[str] = None
    notes: Optional[str] = None
    project_id: Optional[int] = None


class SocialContentCreate(SocialContentBase):
    pass


class SocialContentUpdate(BaseModel):
    content_date: Optional[date] = None
    content_type: Optional[ContentType] = None
    status: Optional[ContentStatus] = None
    script: Optional[str] = None
    editing_style: Optional[EditingStyle] = None
    editing_notes: Optional[str] = None
    platforms: Optional[List[str]] = None
    hashtags: Optional[str] = None
    music_audio: Optional[str] = None
    thumbnail_reference: Optional[str] = None
    notes: Optional[str] = None
    project_id: Optional[int] = None


class SocialContent(SocialContentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarSummary(BaseModel):
    """Summary statistics for a month"""
    year: int
    month: int
    total_content: int
    by_status: dict  # {status: count}
    by_type: dict    # {content_type: count}


class MonthSummary(BaseModel):
    """Summary for year view showing all months"""
    month: int
    total_content: int
    by_status: dict
    by_type: dict
```

**Step 2: Import schemas in __init__.py**

Modify `backend/app/schemas/__init__.py`, add:

```python
from app.schemas.social_content import (
    SocialContent,
    SocialContentCreate,
    SocialContentUpdate,
    CalendarSummary,
    MonthSummary,
)
```

**Step 3: Commit**

```bash
git add backend/app/schemas/social_content.py backend/app/schemas/__init__.py
git commit -m "feat: add SocialContent Pydantic schemas"
```

---

## Phase 2: Backend API Endpoints

### Task 3: Create API Routes - Basic CRUD

**Files:**
- Create: `backend/app/routes/social_content.py`
- Modify: `backend/app/main.py:8`
- Modify: `backend/app/main.py:42`

**Step 1: Create routes file with basic CRUD endpoints**

Create `backend/app/routes/social_content.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.database import get_db
from app.models.social_content import SocialContent as SocialContentModel
from app.schemas.social_content import (
    SocialContent,
    SocialContentCreate,
    SocialContentUpdate,
)

router = APIRouter(prefix="/api/social-content", tags=["social-content"])


@router.get("/", response_model=List[SocialContent])
def list_content(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    content_type: Optional[str] = None,
    platform: Optional[str] = None,
    project_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """List all social content with optional filters"""
    query = db.query(SocialContentModel)

    # Apply filters
    if status:
        statuses = status.split(",")
        query = query.filter(SocialContentModel.status.in_(statuses))

    if content_type:
        types = content_type.split(",")
        query = query.filter(SocialContentModel.content_type.in_(types))

    if project_id:
        query = query.filter(SocialContentModel.project_id == project_id)

    if start_date:
        query = query.filter(SocialContentModel.content_date >= start_date)

    if end_date:
        query = query.filter(SocialContentModel.content_date <= end_date)

    # Platform filter requires JSON query
    if platform:
        query = query.filter(
            SocialContentModel.platforms.contains([platform])
        )

    query = query.order_by(SocialContentModel.content_date)
    return query.offset(skip).limit(limit).all()


@router.get("/{content_id}", response_model=SocialContent)
def get_content(content_id: int, db: Session = Depends(get_db)):
    """Get a single content item by ID"""
    content = db.query(SocialContentModel).filter(
        SocialContentModel.id == content_id
    ).first()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with id {content_id} not found",
        )

    return content


@router.post("/", response_model=SocialContent, status_code=status.HTTP_201_CREATED)
def create_content(
    content: SocialContentCreate,
    db: Session = Depends(get_db),
):
    """Create new social content item"""
    db_content = SocialContentModel(**content.model_dump())
    db.add(db_content)
    db.commit()
    db.refresh(db_content)
    return db_content


@router.put("/{content_id}", response_model=SocialContent)
def update_content(
    content_id: int,
    content: SocialContentUpdate,
    db: Session = Depends(get_db),
):
    """Update existing content item"""
    db_content = db.query(SocialContentModel).filter(
        SocialContentModel.id == content_id
    ).first()

    if not db_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with id {content_id} not found",
        )

    # Update only provided fields
    update_data = content.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_content, field, value)

    db.commit()
    db.refresh(db_content)
    return db_content


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(content_id: int, db: Session = Depends(get_db)):
    """Delete content item"""
    db_content = db.query(SocialContentModel).filter(
        SocialContentModel.id == content_id
    ).first()

    if not db_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with id {content_id} not found",
        )

    db.delete(db_content)
    db.commit()
    return None
```

**Step 2: Register router in main.py**

Modify `backend/app/main.py`, add import at line 8:

```python
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects, ai, social_content
```

Modify `backend/app/main.py`, add router registration after line 42:

```python
app.include_router(social_content.router)
```

**Step 3: Test API manually**

Start server:
```bash
cd backend
venv/Scripts/python -m uvicorn app.main:app --reload --port 8001
```

Test create endpoint:
```bash
curl -X POST http://localhost:8001/api/social-content/ -H "Content-Type: application/json" -d "{\"content_date\":\"2025-11-20\",\"content_type\":\"reel\",\"status\":\"not_started\"}"
```

Expected: JSON response with created content (id, timestamps, etc.)

Test list endpoint:
```bash
curl http://localhost:8001/api/social-content/
```

Expected: JSON array with the content item

**Step 4: Stop test server**

Press Ctrl+C to stop the test server

**Step 5: Commit**

```bash
git add backend/app/routes/social_content.py backend/app/main.py
git commit -m "feat: add social content CRUD API endpoints"
```

---

### Task 4: Add Calendar-Specific Endpoints

**Files:**
- Modify: `backend/app/routes/social_content.py`

**Step 1: Add helper function for ISO week calculation**

Add at top of `backend/app/routes/social_content.py` after imports:

```python
from datetime import datetime, timedelta
from collections import defaultdict


def get_iso_week_dates(year: int, week: int):
    """Get start and end date for an ISO week"""
    # January 4th is always in week 1
    jan4 = date(year, 1, 4)
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    target_monday = week1_monday + timedelta(weeks=week - 1)
    target_sunday = target_monday + timedelta(days=6)
    return target_monday, target_sunday
```

**Step 2: Add calendar endpoints**

Add at end of `backend/app/routes/social_content.py`:

```python
@router.get("/by-date/{year}/{month}", response_model=List[SocialContent])
def get_month_content(year: int, month: int, db: Session = Depends(get_db)):
    """Get all content for a specific month"""
    start_date = date(year, month, 1)

    # Calculate last day of month
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    content = db.query(SocialContentModel).filter(
        SocialContentModel.content_date >= start_date,
        SocialContentModel.content_date <= end_date,
    ).order_by(SocialContentModel.content_date).all()

    return content


@router.get("/by-date/{year}/{month}/{week}", response_model=List[SocialContent])
def get_week_content(year: int, month: int, week: int, db: Session = Depends(get_db)):
    """Get all content for a specific ISO week"""
    start_date, end_date = get_iso_week_dates(year, week)

    content = db.query(SocialContentModel).filter(
        SocialContentModel.content_date >= start_date,
        SocialContentModel.content_date <= end_date,
    ).order_by(SocialContentModel.content_date).all()

    return content


@router.get("/calendar-summary/{year}")
def get_year_summary(year: int, db: Session = Depends(get_db)):
    """Get summary statistics for all months in a year"""
    from app.schemas.social_content import MonthSummary

    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    all_content = db.query(SocialContentModel).filter(
        SocialContentModel.content_date >= start_date,
        SocialContentModel.content_date <= end_date,
    ).all()

    # Group by month
    months_data = defaultdict(lambda: {
        "total": 0,
        "by_status": defaultdict(int),
        "by_type": defaultdict(int),
    })

    for content in all_content:
        month = content.content_date.month
        months_data[month]["total"] += 1
        months_data[month]["by_status"][content.status.value] += 1
        months_data[month]["by_type"][content.content_type.value] += 1

    # Convert to list of MonthSummary
    result = []
    for month in range(1, 13):
        data = months_data.get(month, {
            "total": 0,
            "by_status": {},
            "by_type": {},
        })
        result.append(MonthSummary(
            month=month,
            total_content=data["total"],
            by_status=dict(data["by_status"]),
            by_type=dict(data["by_type"]),
        ))

    return {"year": year, "months": result}
```

**Step 3: Test calendar endpoints**

Start server:
```bash
cd backend
venv/Scripts/python -m uvicorn app.main:app --reload --port 8001
```

Test year summary:
```bash
curl http://localhost:8001/api/social-content/calendar-summary/2025
```

Expected: JSON with year and array of 12 months with stats

**Step 4: Stop test server**

Press Ctrl+C

**Step 5: Commit**

```bash
git add backend/app/routes/social_content.py
git commit -m "feat: add calendar-specific endpoints for social content"
```

---

## Phase 3: Frontend - Type Definitions & API Client

### Task 5: Add TypeScript Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add social content types**

Add at end of `frontend/src/types/index.ts`:

```typescript
// Social Content Types
export type ContentType =
  | 'reel'
  | 'carousel'
  | 'single_post'
  | 'story'
  | 'tiktok'
  | 'youtube_short'
  | 'youtube_video'
  | 'blog_post';

export type ContentStatus =
  | 'not_started'
  | 'scripted'
  | 'filmed'
  | 'editing'
  | 'scheduled'
  | 'posted';

export type EditingStyle =
  | 'fast_paced'
  | 'cinematic'
  | 'educational'
  | 'behind_scenes'
  | 'trending'
  | 'tutorial'
  | 'interview'
  | 'custom';

export interface SocialContent {
  id: number;
  content_date: string; // ISO date string
  content_type: ContentType;
  status: ContentStatus;
  script?: string;
  editing_style?: EditingStyle;
  editing_notes?: string;
  platforms?: string[]; // ['instagram', 'tiktok', etc.]
  hashtags?: string;
  music_audio?: string;
  thumbnail_reference?: string;
  notes?: string;
  project_id?: number;
  created_at: string;
  updated_at: string;
}

export interface SocialContentCreate {
  content_date: string;
  content_type: ContentType;
  status?: ContentStatus;
  script?: string;
  editing_style?: EditingStyle;
  editing_notes?: string;
  platforms?: string[];
  hashtags?: string;
  music_audio?: string;
  thumbnail_reference?: string;
  notes?: string;
  project_id?: number;
}

export interface SocialContentUpdate {
  content_date?: string;
  content_type?: ContentType;
  status?: ContentStatus;
  script?: string;
  editing_style?: EditingStyle;
  editing_notes?: string;
  platforms?: string[];
  hashtags?: string;
  music_audio?: string;
  thumbnail_reference?: string;
  notes?: string;
  project_id?: number;
}

export interface MonthSummary {
  month: number;
  total_content: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
}

export interface YearSummary {
  year: number;
  months: MonthSummary[];
}
```

**Step 2: Export enum objects for UI**

Add constants at end of file:

```typescript
// Enums for UI
export const ContentType = {
  REEL: 'reel' as const,
  CAROUSEL: 'carousel' as const,
  SINGLE_POST: 'single_post' as const,
  STORY: 'story' as const,
  TIKTOK: 'tiktok' as const,
  YOUTUBE_SHORT: 'youtube_short' as const,
  YOUTUBE_VIDEO: 'youtube_video' as const,
  BLOG_POST: 'blog_post' as const,
};

export const ContentStatus = {
  NOT_STARTED: 'not_started' as const,
  SCRIPTED: 'scripted' as const,
  FILMED: 'filmed' as const,
  EDITING: 'editing' as const,
  SCHEDULED: 'scheduled' as const,
  POSTED: 'posted' as const,
};

export const EditingStyle = {
  FAST_PACED: 'fast_paced' as const,
  CINEMATIC: 'cinematic' as const,
  EDUCATIONAL: 'educational' as const,
  BEHIND_SCENES: 'behind_scenes' as const,
  TRENDING: 'trending' as const,
  TUTORIAL: 'tutorial' as const,
  INTERVIEW: 'interview' as const,
  CUSTOM: 'custom' as const,
};
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add TypeScript types for social content"
```

---

### Task 6: Add API Client Functions

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add social content API functions**

Add at end of `frontend/src/lib/api.ts`:

```typescript
// Social Content API
export const socialContentApi = {
  list: (params?: {
    status?: string;
    content_type?: string;
    platform?: string;
    project_id?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.content_type) queryParams.append('content_type', params.content_type);
    if (params?.platform) queryParams.append('platform', params.platform);
    if (params?.project_id) queryParams.append('project_id', params.project_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const query = queryParams.toString();
    return apiRequest<SocialContent[]>(`/social-content/${query ? `?${query}` : ''}`);
  },

  get: (id: number) =>
    apiRequest<SocialContent>(`/social-content/${id}`),

  create: (data: SocialContentCreate) =>
    apiRequest<SocialContent>('/social-content/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: SocialContentUpdate) =>
    apiRequest<SocialContent>(`/social-content/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiRequest<void>(`/social-content/${id}`, {
      method: 'DELETE',
    }),

  getMonthContent: (year: number, month: number) =>
    apiRequest<SocialContent[]>(`/social-content/by-date/${year}/${month}`),

  getWeekContent: (year: number, month: number, week: number) =>
    apiRequest<SocialContent[]>(`/social-content/by-date/${year}/${month}/${week}`),

  getYearSummary: (year: number) =>
    apiRequest<YearSummary>(`/social-content/calendar-summary/${year}`),
};
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add social content API client functions"
```

---

## Phase 4: Frontend - Utility Functions

### Task 7: Create Date Utilities

**Files:**
- Create: `frontend/src/lib/dateUtils.ts`

**Step 1: Install date-fns**

Run:
```bash
cd frontend
npm install date-fns
```

Expected: Package installed

**Step 2: Create date utilities file**

Create `frontend/src/lib/dateUtils.ts`:

```typescript
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  getISOWeek,
  getYear,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
} from 'date-fns';

export interface Week {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  days: Date[];
}

/**
 * Get all weeks in a month with ISO week numbers
 */
export function getWeeksInMonth(year: number, month: number): Week[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const weeks = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 } // Monday
  );

  return weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return {
      weekNumber: getISOWeek(weekStart),
      startDate: weekStart,
      endDate: weekEnd,
      days,
    };
  });
}

/**
 * Get ISO week number for a date
 */
export function getWeekNumber(date: Date): number {
  return getISOWeek(date);
}

/**
 * Get week date range as formatted string
 */
export function getWeekDateRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
}

/**
 * Format date for API (YYYY-MM-DD)
 */
export function formatDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse API date string to Date
 */
export function parseApiDate(dateString: string): Date {
  return parseISO(dateString);
}

/**
 * Get month name
 */
export function getMonthName(month: number): string {
  return format(new Date(2000, month - 1), 'MMMM');
}

/**
 * Get day name
 */
export function getDayName(date: Date): string {
  return format(date, 'EEEE');
}

/**
 * Get short day name
 */
export function getShortDayName(date: Date): string {
  return format(date, 'EEE');
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate < today;
}
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/dateUtils.ts
git commit -m "feat: add date utility functions for calendar"
```

---

## Phase 5: Frontend - Calendar Components

### Task 8: Create YearView Component

**Files:**
- Create: `frontend/src/components/calendar/YearView.tsx`

**Step 1: Create calendar components directory**

Run:
```bash
mkdir -p frontend/src/components/calendar
```

**Step 2: Create YearView component**

Create `frontend/src/components/calendar/YearView.tsx`:

```typescript
import { getMonthName } from '@/lib/dateUtils';
import type { MonthSummary } from '@/types';

interface YearViewProps {
  year: number;
  months: MonthSummary[];
  onMonthClick: (month: number) => void;
}

export default function YearView({ year, months, onMonthClick }: YearViewProps) {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">{year} Content Calendar</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {months.map((monthData) => (
          <button
            key={monthData.month}
            onClick={() => onMonthClick(monthData.month)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow text-left"
          >
            <h2 className="text-xl font-semibold mb-3">
              {getMonthName(monthData.month)}
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Total Content:
                </span>
                <span className="font-semibold">{monthData.total_content}</span>
              </div>

              {monthData.total_content > 0 && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">By Status:</p>
                    {Object.entries(monthData.by_status).map(([status, count]) => (
                      <div key={status} className="flex justify-between text-xs">
                        <span className="capitalize">{status.replace('_', ' ')}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">By Type:</p>
                    {Object.entries(monthData.by_type).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/calendar/YearView.tsx
git commit -m "feat: add YearView component for calendar"
```

---

### Task 9: Create MonthView Component

**Files:**
- Create: `frontend/src/components/calendar/MonthView.tsx`

**Step 1: Create MonthView component**

Create `frontend/src/components/calendar/MonthView.tsx`:

```typescript
import { getWeeksInMonth, getWeekDateRange } from '@/lib/dateUtils';
import type { SocialContent } from '@/types';
import { useMemo } from 'react';

interface MonthViewProps {
  year: number;
  month: number;
  content: SocialContent[];
  onWeekClick: (weekNumber: number) => void;
}

export default function MonthView({
  year,
  month,
  content,
  onWeekClick,
}: MonthViewProps) {
  const weeks = useMemo(() => getWeeksInMonth(year, month), [year, month]);

  // Group content by week
  const contentByWeek = useMemo(() => {
    const grouped: Record<number, SocialContent[]> = {};

    content.forEach((item) => {
      const itemDate = new Date(item.content_date);
      const weekNum = weeks.find((week) =>
        itemDate >= week.startDate && itemDate <= week.endDate
      )?.weekNumber;

      if (weekNum) {
        if (!grouped[weekNum]) grouped[weekNum] = [];
        grouped[weekNum].push(item);
      }
    });

    return grouped;
  }, [content, weeks]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">
        {new Date(year, month - 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {weeks.map((week) => {
          const weekContent = contentByWeek[week.weekNumber] || [];
          const statusCounts: Record<string, number> = {};
          const typeCounts: Record<string, number> = {};

          weekContent.forEach((item) => {
            statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
            typeCounts[item.content_type] = (typeCounts[item.content_type] || 0) + 1;
          });

          return (
            <button
              key={week.weekNumber}
              onClick={() => onWeekClick(week.weekNumber)}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">Week {week.weekNumber}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {getWeekDateRange(week.startDate, week.endDate)}
                  </p>
                </div>
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-semibold">
                  {weekContent.length}
                </span>
              </div>

              {weekContent.length > 0 && (
                <div className="space-y-1 text-xs">
                  <div>
                    {Object.entries(typeCounts).map(([type, count]) => (
                      <span
                        key={type}
                        className="inline-block mr-2 mb-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded"
                      >
                        {type.replace('_', ' ')}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/calendar/MonthView.tsx
git commit -m "feat: add MonthView component for calendar"
```

---

### Task 10: Create WeekView Component

**Files:**
- Create: `frontend/src/components/calendar/WeekView.tsx`

**Step 1: Create WeekView component**

Create `frontend/src/components/calendar/WeekView.tsx`:

```typescript
import { getDayName, formatDateForApi, isToday, isPast } from '@/lib/dateUtils';
import type { SocialContent } from '@/types';
import { useMemo } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  year: number;
  month: number;
  weekNumber: number;
  weekDays: Date[];
  content: SocialContent[];
  onDayClick: (date: Date) => void;
}

export default function WeekView({
  year,
  month,
  weekNumber,
  weekDays,
  content,
  onDayClick,
}: WeekViewProps) {
  // Group content by date
  const contentByDate = useMemo(() => {
    const grouped: Record<string, SocialContent[]> = {};

    content.forEach((item) => {
      if (!grouped[item.content_date]) {
        grouped[item.content_date] = [];
      }
      grouped[item.content_date].push(item);
    });

    return grouped;
  }, [content]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">
        Week {weekNumber} - {new Date(year, month - 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dateStr = formatDateForApi(day);
          const dayContent = contentByDate[dateStr] || [];
          const isTodayDate = isToday(day);
          const isPastDate = isPast(day);

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(day)}
              className={cn(
                "bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-lg transition-shadow text-left min-h-[180px] flex flex-col",
                isTodayDate && "border-blue-500 dark:border-blue-400 border-2",
                !isTodayDate && "border-gray-200 dark:border-gray-700",
                isPastDate && "opacity-75"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold">{getDayName(day)}</p>
                  <p className="text-2xl font-bold">{day.getDate()}</p>
                </div>
                {dayContent.length > 0 ? (
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-semibold">
                    {dayContent.length}
                  </span>
                ) : (
                  <Plus className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                {dayContent.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-xs"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span className="font-semibold capitalize">
                        {item.content_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 capitalize text-xs">
                      {item.status.replace('_', ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/calendar/WeekView.tsx
git commit -m "feat: add WeekView component for calendar"
```

---

### Task 11: Create DayContentModal Component

**Files:**
- Create: `frontend/src/components/calendar/DayContentModal.tsx`

**Step 1: Create DayContentModal component**

Create `frontend/src/components/calendar/DayContentModal.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { formatDateForApi } from '@/lib/dateUtils';
import type {
  SocialContent,
  SocialContentCreate,
  SocialContentUpdate,
  ContentType as ContentTypeEnum,
  ContentStatus as ContentStatusEnum,
  EditingStyle as EditingStyleEnum,
} from '@/types';
import { ContentType, ContentStatus, EditingStyle } from '@/types';

interface DayContentModalProps {
  isOpen: boolean;
  date: Date;
  existingContent?: SocialContent;
  onClose: () => void;
  onSave: (data: SocialContentCreate | SocialContentUpdate) => void;
}

const PLATFORM_OPTIONS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'LinkedIn',
  'Twitter',
];

export default function DayContentModal({
  isOpen,
  date,
  existingContent,
  onClose,
  onSave,
}: DayContentModalProps) {
  const [formData, setFormData] = useState({
    content_type: 'reel' as ContentTypeEnum,
    status: 'not_started' as ContentStatusEnum,
    script: '',
    editing_style: '' as EditingStyleEnum | '',
    editing_notes: '',
    platforms: [] as string[],
    hashtags: '',
    music_audio: '',
    thumbnail_reference: '',
    notes: '',
    project_id: undefined as number | undefined,
  });

  useEffect(() => {
    if (existingContent) {
      setFormData({
        content_type: existingContent.content_type,
        status: existingContent.status,
        script: existingContent.script || '',
        editing_style: existingContent.editing_style || '',
        editing_notes: existingContent.editing_notes || '',
        platforms: existingContent.platforms || [],
        hashtags: existingContent.hashtags || '',
        music_audio: existingContent.music_audio || '',
        thumbnail_reference: existingContent.thumbnail_reference || '',
        notes: existingContent.notes || '',
        project_id: existingContent.project_id,
      });
    }
  }, [existingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      content_date: formatDateForApi(date),
      ...formData,
      editing_style: formData.editing_style || undefined,
    };

    onSave(data);
    onClose();
  };

  const togglePlatform = (platform: string) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform.toLowerCase())
        ? prev.platforms.filter((p) => p !== platform.toLowerCase())
        : [...prev.platforms, platform.toLowerCase()],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {existingContent ? 'Edit' : 'Add'} Content for{' '}
            {date.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Content Type & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Content Type *
              </label>
              <select
                value={formData.content_type}
                onChange={(e) =>
                  setFormData({ ...formData, content_type: e.target.value as ContentTypeEnum })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              >
                {Object.values(ContentType).map((type) => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as ContentStatusEnum })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                {Object.values(ContentStatus).map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Script/Caption */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Script / Caption
            </label>
            <textarea
              value={formData.script}
              onChange={(e) =>
                setFormData({ ...formData, script: e.target.value })
              }
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Hook, body, CTA..."
            />
          </div>

          {/* Editing Style & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Editing Style
              </label>
              <select
                value={formData.editing_style}
                onChange={(e) =>
                  setFormData({ ...formData, editing_style: e.target.value as EditingStyleEnum })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="">Select style...</option>
                {Object.values(EditingStyle).map((style) => (
                  <option key={style} value={style}>
                    {style.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Editing Notes
            </label>
            <textarea
              value={formData.editing_notes}
              onChange={(e) =>
                setFormData({ ...formData, editing_notes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Specific editing requirements, reference links..."
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium mb-2">Platforms</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PLATFORM_OPTIONS.map((platform) => (
                <label
                  key={platform}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={formData.platforms.includes(platform.toLowerCase())}
                    onChange={() => togglePlatform(platform)}
                    className="rounded"
                  />
                  <span>{platform}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Metadata Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Hashtags</label>
              <input
                type="text"
                value={formData.hashtags}
                onChange={(e) =>
                  setFormData({ ...formData, hashtags: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="#marketing #socialmedia"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Music / Audio
              </label>
              <input
                type="text"
                value={formData.music_audio}
                onChange={(e) =>
                  setFormData({ ...formData, music_audio: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="Track name or audio reference"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Thumbnail Reference
            </label>
            <input
              type="text"
              value={formData.thumbnail_reference}
              onChange={(e) =>
                setFormData({ ...formData, thumbnail_reference: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Image URL or reference"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Production notes, location, props needed..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Content
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/calendar/DayContentModal.tsx
git commit -m "feat: add DayContentModal component for content editing"
```

---

### Task 12: Create CalendarBreadcrumb Component

**Files:**
- Create: `frontend/src/components/calendar/CalendarBreadcrumb.tsx`

**Step 1: Create CalendarBreadcrumb component**

Create `frontend/src/components/calendar/CalendarBreadcrumb.tsx`:

```typescript
import { ChevronRight } from 'lucide-react';
import { getMonthName } from '@/lib/dateUtils';

interface CalendarBreadcrumbProps {
  year: number;
  month?: number;
  weekNumber?: number;
  day?: Date;
  onYearClick: () => void;
  onMonthClick?: () => void;
  onWeekClick?: () => void;
}

export default function CalendarBreadcrumb({
  year,
  month,
  weekNumber,
  day,
  onYearClick,
  onMonthClick,
  onWeekClick,
}: CalendarBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-6">
      <button
        onClick={onYearClick}
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        {year}
      </button>

      {month && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={onMonthClick}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {getMonthName(month)}
          </button>
        </>
      )}

      {weekNumber && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={onWeekClick}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Week {weekNumber}
          </button>
        </>
      )}

      {day && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">
            {day.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </>
      )}
    </nav>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/calendar/CalendarBreadcrumb.tsx
git commit -m "feat: add CalendarBreadcrumb component for navigation"
```

---

## Phase 6: Main Calendar Page

### Task 13: Create SocialCalendar Page

**Files:**
- Create: `frontend/src/pages/SocialCalendar.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create SocialCalendar page**

Create `frontend/src/pages/SocialCalendar.tsx`:

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialContentApi } from '@/lib/api';
import type { SocialContentCreate, SocialContentUpdate } from '@/types';
import YearView from '@/components/calendar/YearView';
import MonthView from '@/components/calendar/MonthView';
import WeekView from '@/components/calendar/WeekView';
import DayContentModal from '@/components/calendar/DayContentModal';
import CalendarBreadcrumb from '@/components/calendar/CalendarBreadcrumb';
import { getWeeksInMonth } from '@/lib/dateUtils';

type ViewLevel = 'year' | 'month' | 'week';

export default function SocialCalendar() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [viewLevel, setViewLevel] = useState<ViewLevel>('year');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>();
  const [selectedWeek, setSelectedWeek] = useState<number>();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Queries
  const { data: yearSummary } = useQuery({
    queryKey: ['social-content', 'year', selectedYear],
    queryFn: () => socialContentApi.getYearSummary(selectedYear),
  });

  const { data: monthContent } = useQuery({
    queryKey: ['social-content', 'month', selectedYear, selectedMonth],
    queryFn: () => socialContentApi.getMonthContent(selectedYear, selectedMonth!),
    enabled: !!selectedMonth,
  });

  const { data: weekContent } = useQuery({
    queryKey: ['social-content', 'week', selectedYear, selectedMonth, selectedWeek],
    queryFn: () =>
      socialContentApi.getWeekContent(selectedYear, selectedMonth!, selectedWeek!),
    enabled: !!selectedMonth && !!selectedWeek,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: socialContentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SocialContentUpdate }) =>
      socialContentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
    },
  });

  // Navigation handlers
  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setViewLevel('month');
  };

  const handleWeekClick = (weekNumber: number) => {
    setSelectedWeek(weekNumber);
    setViewLevel('week');
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setIsModalOpen(true);
  };

  const handleBackToYear = () => {
    setViewLevel('year');
    setSelectedMonth(undefined);
    setSelectedWeek(undefined);
  };

  const handleBackToMonth = () => {
    setViewLevel('month');
    setSelectedWeek(undefined);
  };

  const handleBackToWeek = () => {
    setViewLevel('week');
  };

  // Modal handlers
  const handleSaveContent = (data: SocialContentCreate | SocialContentUpdate) => {
    // Check if we're editing existing content for this day
    const existingContent = weekContent?.find(
      (c) => c.content_date === (data as SocialContentCreate).content_date
    );

    if (existingContent) {
      updateMutation.mutate({ id: existingContent.id, data: data as SocialContentUpdate });
    } else {
      createMutation.mutate(data as SocialContentCreate);
    }
  };

  // Get week days for WeekView
  const weekDays =
    selectedMonth && selectedWeek
      ? getWeeksInMonth(selectedYear, selectedMonth).find(
          (w) => w.weekNumber === selectedWeek
        )?.days || []
      : [];

  // Find existing content for selected day
  const existingContentForDay = selectedDay
    ? weekContent?.find((c) => c.content_date === selectedDay.toISOString().split('T')[0])
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <CalendarBreadcrumb
            year={selectedYear}
            month={selectedMonth}
            weekNumber={selectedWeek}
            onYearClick={handleBackToYear}
            onMonthClick={handleBackToMonth}
            onWeekClick={handleBackToWeek}
          />
        </div>

        {/* Views */}
        {viewLevel === 'year' && yearSummary && (
          <YearView
            year={selectedYear}
            months={yearSummary.months}
            onMonthClick={handleMonthClick}
          />
        )}

        {viewLevel === 'month' && selectedMonth && monthContent && (
          <MonthView
            year={selectedYear}
            month={selectedMonth}
            content={monthContent}
            onWeekClick={handleWeekClick}
          />
        )}

        {viewLevel === 'week' &&
          selectedMonth &&
          selectedWeek &&
          weekContent && (
            <WeekView
              year={selectedYear}
              month={selectedMonth}
              weekNumber={selectedWeek}
              weekDays={weekDays}
              content={weekContent}
              onDayClick={handleDayClick}
            />
          )}

        {/* Day Content Modal */}
        {selectedDay && (
          <DayContentModal
            isOpen={isModalOpen}
            date={selectedDay}
            existingContent={existingContentForDay}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedDay(null);
            }}
            onSave={handleSaveContent}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add route in App.tsx**

Modify `frontend/src/App.tsx`, add import:

```typescript
import SocialCalendar from './pages/SocialCalendar';
```

Add route in the Routes component:

```typescript
<Route path="/social-calendar" element={<SocialCalendar />} />
```

**Step 3: Add navigation link in Layout**

Modify `frontend/src/components/Layout.tsx`, add link in navigation menu:

```typescript
<Link
  to="/social-calendar"
  className={cn(
    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
    location.pathname === '/social-calendar'
      ? 'bg-blue-600 text-white'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
  )}
>
  <Calendar className="w-5 h-5" />
  <span>Social Calendar</span>
</Link>
```

Import Calendar icon at top:

```typescript
import { Calendar } from 'lucide-react';
```

**Step 4: Test the page**

Start both servers and visit http://localhost:5173/social-calendar

Expected: Calendar page loads showing year view

**Step 5: Commit**

```bash
git add frontend/src/pages/SocialCalendar.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: add Social Calendar page with navigation"
```

---

## Phase 7: Testing & Verification

### Task 14: Manual End-to-End Test

**Step 1: Test complete user flow**

With both servers running:

1. Navigate to Social Calendar
2. Click a month (e.g., November 2025)
3. Click a week (e.g., Week 47)
4. Click a day (e.g., Monday 17th)
5. Fill in content form:
   - Content Type: Reel
   - Status: Scripted
   - Script: "Test hook, body, CTA"
   - Platforms: Instagram, TikTok
6. Save
7. Verify content appears in week view
8. Click the day again
9. Edit the content
10. Save
11. Navigate back through breadcrumb

Expected: All navigation works, content is created/updated/displayed correctly

**Step 2: Test API filters**

Visit http://localhost:8001/api/social-content/?status=scripted

Expected: Returns only scripted content

**Step 3: Document any bugs found**

Create file `docs/testing/social-calendar-bugs.md` if any issues found

**Step 4: Commit if no issues**

```bash
git add .
git commit -m "test: verify social calendar end-to-end functionality"
```

---

## Completion

### Summary

Phase 1 Complete! You now have:

1. ✅ Database model with migrations
2. ✅ Pydantic schemas
3. ✅ Full CRUD API endpoints
4. ✅ Calendar-specific endpoints (month, week, year summary)
5. ✅ TypeScript types
6. ✅ API client functions
7. ✅ Date utilities
8. ✅ All calendar components (YearView, MonthView, WeekView, DayContentModal, Breadcrumb)
9. ✅ Main SocialCalendar page with navigation
10. ✅ Integration into app navigation

### Next Phases (Not in this plan)

**Phase 2: Project Integration**
- Link content to projects
- Show content in ProjectDetail page
- Optional task generation

**Phase 3: Enhanced Features**
- Search and filters
- Templates system
- Duplicate content
- Export functionality
- List view toggle

---

## Reference

**Key Files Created:**
- `backend/app/models/social_content.py`
- `backend/app/schemas/social_content.py`
- `backend/app/routes/social_content.py`
- `frontend/src/lib/dateUtils.ts`
- `frontend/src/components/calendar/*`
- `frontend/src/pages/SocialCalendar.tsx`

**Commands:**
- Start backend: `cd backend && venv/Scripts/python -m uvicorn app.main:app --reload --port 8000`
- Start frontend: `cd frontend && npm run dev`
- Run migrations: `cd backend && venv/Scripts/alembic upgrade head`
- Create migration: `cd backend && venv/Scripts/alembic revision --autogenerate -m "message"`

**Testing:**
- Calendar URL: http://localhost:5173/social-calendar
- API docs: http://localhost:8000/docs
