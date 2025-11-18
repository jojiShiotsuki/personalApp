# Social Media Content Calendar - Design Document

**Date**: 2025-11-18
**Status**: Approved
**Architecture**: Hybrid with Optional Integration

## Overview

A hierarchical content planning system for social media management with drill-down calendar interface: Year → Month → Week → Day → Content Details. The system enables complete pre-production planning so users know exactly what to shoot, what to say, and how to edit it - all organized by date.

## Design Decisions

### Architectural Approach
**Hybrid with Optional Integration**: The calendar functions as a standalone content planning tool with optional links to the existing Projects/Tasks system. This provides flexibility without forcing task creation for every content piece.

### Key Principles
1. **Content-First**: Calendar and content tracking is the primary interface
2. **Optional Integration**: Users can link content to projects/tasks when needed
3. **No Automatic Workflows**: Status changes are for tracking only, no notifications
4. **Single Content, Multiple Platforms**: One content item can target multiple platforms
5. **UI-Driven Hierarchy**: Year/Month/Week navigation is calculated from dates, not stored as separate entities

## Data Model

### SocialContent Model

**File**: `backend/app/models/social_content.py`

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
    content_date = Column(Date, nullable=False, index=True)  # The day this content is planned for

    # Required content fields
    content_type = Column(Enum(ContentType), nullable=False)
    status = Column(Enum(ContentStatus), default=ContentStatus.NOT_STARTED)

    # Script/Caption - main content
    script = Column(Text, nullable=True)  # Full script with hooks, body, CTA

    # Editing details
    editing_style = Column(Enum(EditingStyle), nullable=True)
    editing_notes = Column(Text, nullable=True)  # Custom editing requirements, references

    # Platform targeting (stored as JSON array: ["instagram", "tiktok", "facebook"])
    platforms = Column(JSON, nullable=True)  # ["instagram", "tiktok", "youtube", "facebook", "linkedin", "twitter"]

    # Optional metadata
    hashtags = Column(Text, nullable=True)  # Pre-planned hashtag sets
    music_audio = Column(String(255), nullable=True)  # Track name or audio reference
    thumbnail_reference = Column(String(500), nullable=True)  # Image URL or reference
    notes = Column(Text, nullable=True)  # Additional production notes

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

### Pydantic Schemas

**File**: `backend/app/schemas/social_content.py`

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
    year: int
    month: int
    total_content: int
    by_status: dict  # {status: count}
    by_type: dict    # {content_type: count}
```

## API Endpoints

**File**: `backend/app/routes/social_content.py`

### Standard CRUD Operations
```
GET    /api/social-content/              # List all content (with filters)
GET    /api/social-content/{id}          # Get single content item
POST   /api/social-content/              # Create new content
PUT    /api/social-content/{id}          # Update content
DELETE /api/social-content/{id}          # Delete content
```

### Calendar-Specific Endpoints
```
GET    /api/social-content/by-date/{year}/{month}           # Get month's content
GET    /api/social-content/by-date/{year}/{month}/{week}    # Get week's content (ISO week)
GET    /api/social-content/calendar-summary/{year}          # Year overview with counts per month
```

### Query Parameters
- `status`: Filter by status (comma-separated: `?status=scripted,filming`)
- `content_type`: Filter by type (comma-separated: `?content_type=reel,carousel`)
- `platform`: Filter by platform (`?platform=instagram`)
- `project_id`: Get content for specific project (`?project_id=5`)
- `start_date`, `end_date`: Date range filtering

### Response Examples

**Calendar Summary**:
```json
{
  "year": 2025,
  "months": [
    {
      "month": 1,
      "total_content": 15,
      "by_status": {
        "posted": 8,
        "scheduled": 3,
        "scripted": 4
      },
      "by_type": {
        "reel": 10,
        "carousel": 3,
        "story": 2
      }
    }
  ]
}
```

## Frontend Architecture

### New Page: SocialCalendar

**File**: `frontend/src/pages/SocialCalendar.tsx`

Main page component that manages navigation state and renders different view levels.

### Component Hierarchy

```
SocialCalendar (main page)
├── CalendarBreadcrumb           # Navigation: Year > Month > Week > Day
├── CalendarToolbar              # Search, filters, view toggle, export
├── YearView                     # 12 month grid with statistics
├── MonthView                    # 4-5 week cards with indicators
├── WeekView                     # 7 day cards with content previews
└── DayContentModal              # Full content editing form
    ├── ContentTypeSelector      # Dropdown for content type
    ├── ScriptEditor             # Rich text with sections
    ├── PlatformMultiSelect      # Checkbox group for platforms
    ├── EditingStyleSelector     # Dropdown + custom notes
    ├── StatusDropdown           # Content status
    ├── MetadataFields           # Hashtags, music, thumbnail
    └── OptionalProjectLink      # Link to existing project
```

### Component Details

#### YearView Component
**File**: `frontend/src/components/calendar/YearView.tsx`

- Display 12 months as cards in a 3x4 or 4x3 grid
- Each card shows:
  - Month name
  - Total content count
  - Status breakdown (visual indicators)
  - Click to navigate to MonthView

#### MonthView Component
**File**: `frontend/src/components/calendar/MonthView.tsx`

- Display 4-5 weeks as cards
- Calculate ISO weeks for the month
- Each card shows:
  - Week number and date range
  - Content count
  - Content type icons
  - Click to navigate to WeekView

#### WeekView Component
**File**: `frontend/src/components/calendar/WeekView.tsx`

- Display 7 days (Monday-Sunday) as cards
- Each day card shows:
  - Day of week and date
  - Content type icon if content exists
  - Brief preview (type + status)
  - Click to open DayContentModal

#### DayContentModal Component
**File**: `frontend/src/components/calendar/DayContentModal.tsx`

Full-screen or large modal with all content fields:
- Content type selector
- Script/caption editor with formatting
- Editing style dropdown + notes field
- Platform multi-select checkboxes
- Status dropdown
- Hashtags, music, thumbnail fields
- Notes textarea
- Optional project link dropdown
- Save/Cancel buttons

Reuses modal styling from existing app (blurred transparent background).

#### CalendarBreadcrumb Component
**File**: `frontend/src/components/calendar/CalendarBreadcrumb.tsx`

- Shows current navigation path: `2025 > January > Week 3 > Monday 20th`
- Each level is clickable to jump back
- Automatically updates based on current view state

#### CalendarToolbar Component
**File**: `frontend/src/components/calendar/CalendarToolbar.tsx`

Top toolbar with:
- Search input (searches script, hashtags, notes)
- Filter dropdowns (status, type, platform)
- View toggle: "Calendar View" vs "List View"
- "Export Schedule" button
- "Add Content" quick action

### State Management

**React Query Setup**:
```typescript
// Queries
const { data: yearSummary } = useQuery(['social-content', 'year', year])
const { data: monthContent } = useQuery(['social-content', 'month', year, month])
const { data: weekContent } = useQuery(['social-content', 'week', year, month, week])

// Mutations
const createContent = useMutation(socialContentApi.create)
const updateContent = useMutation(socialContentApi.update)
const deleteContent = useMutation(socialContentApi.delete)
```

**Local UI State**:
```typescript
const [viewLevel, setViewLevel] = useState<'year' | 'month' | 'week'>('year')
const [selectedDate, setSelectedDate] = useState({ year, month, week })
const [isModalOpen, setIsModalOpen] = useState(false)
const [selectedDay, setSelectedDay] = useState<Date | null>(null)
```

## Integration Points

### Project Integration

**In DayContentModal**:
- Optional "Link to Project" dropdown showing active projects
- When linked, content appears in ProjectDetail page

**In ProjectDetail Page** (`frontend/src/pages/ProjectDetail.tsx`):
- Add new tab: "Social Content"
- Shows all content items linked to this project
- Table view with date, type, status
- Click to open content in modal

### Optional Task Generation

**Feature**: "Create Production Tasks" button in DayContentModal

When clicked, auto-generate tasks linked to the project:
1. "Script: [Content Type] for [Date]" (due: content_date - 3 days)
2. "Film: [Content Type] for [Date]" (due: content_date - 2 days)
3. "Edit: [Content Type] for [Date]" (due: content_date - 1 day)

Tasks are created with:
- `project_id` from content item
- `description` includes link back to content
- Default priority based on content status

This is entirely optional - users can plan content without creating tasks.

## Additional Features

### Templates System

**Backend**:
- Add `SocialContentTemplate` model (optional, can be added later)
- Or store templates in browser localStorage initially

**Frontend**:
- "Save as Template" button in modal
- Templates dropdown: "Weekly Reel Format", "Educational Carousel"
- Template stores: content_type, editing_style, platforms, hashtags, default script structure

### Duplicate Content

**Feature**: Duplicate content to multiple dates

**UI Flow**:
1. In WeekView or DayContentModal, click "Duplicate" button
2. Date picker opens: select multiple dates
3. Creates copies of the content with new dates
4. Option to link all copies to same project

### Search & Filters

**CalendarToolbar Features**:
- **Search**: Full-text search in script, hashtags, notes
- **Status Filter**: Multi-select dropdown
- **Type Filter**: Multi-select dropdown
- **Platform Filter**: Single select or multi-select
- **Date Range**: Custom date picker for filtering
- **Clear All**: Reset all filters

### Export Features

**"Export Shooting Schedule" Button**:

Generates downloadable document (PDF/Markdown/Print view):
- Week-by-week breakdown
- Day-by-day content list
- Includes: Type, Script summary, Editing notes, Status
- Grouped by filming requirements if mentioned in notes

**Format Example**:
```
WEEK OF JANUARY 20-26, 2025

Monday, Jan 20
- Reel: Product Tutorial #3
  Script: Hook - "3 mistakes you're making..."
  Editing: Fast-paced with text overlays
  Status: Scripted

Tuesday, Jan 21
- Carousel: Weekly Tips Roundup
  Script: 5 slides, see full script...
  Editing: Minimalist, brand colors
  Status: Not Started
```

## Navigation Flow

### User Journey

1. **Landing**: User opens Social Calendar page → sees YearView (12 months)
2. **Month Selection**: Clicks "February" → navigates to MonthView showing weeks
3. **Week Selection**: Clicks "Week 8 (Feb 17-23)" → navigates to WeekView showing 7 days
4. **Day Selection**: Clicks "Wednesday 19th" → DayContentModal opens
5. **Content Creation/Edit**: Fills in content details → Saves
6. **Navigation Back**: Uses breadcrumb to jump back to any level

### Alternative Flow: Quick Add

1. User clicks "Add Content" in toolbar
2. Date picker opens
3. Selects date → DayContentModal opens directly
4. Creates content → returns to current view

### List View Toggle

Clicking "List View" in toolbar shows all content in a filterable table:
- Columns: Date, Type, Status, Platforms, Script Preview
- Sortable by any column
- Click row to open in modal
- Better for bulk editing or searching

## Technical Considerations

### Date Calculations

**ISO Week Calculation**:
- Use `date-fns` library for consistent week calculations
- Weeks start on Monday (ISO standard)
- Week 1 is the week with January 4th

**Utilities**:
```typescript
// frontend/src/lib/dateUtils.ts
export function getWeeksInMonth(year: number, month: number): Week[]
export function getISOWeek(date: Date): number
export function getWeekDateRange(year: number, week: number): [Date, Date]
```

### Performance Considerations

**Backend**:
- Index on `content_date` for fast date range queries
- Index on `project_id` for project filtering
- Consider caching calendar summaries for frequently accessed months

**Frontend**:
- Lazy load month/week data only when navigating to that view
- Use React Query's cache to avoid refetching
- Virtual scrolling if list view has hundreds of items

### Database Migration

Since this is a new feature, we'll need a migration to create the `social_content` table:

**File**: `backend/alembic/versions/XXXXX_add_social_content.py`

Standard Alembic migration creating the table with all columns and indexes.

## Future Enhancements (Out of Scope for V1)

1. **Content Templates**: Persistent server-side templates (currently using localStorage)
2. **Recurring Content**: Weekly series, daily posts (similar to recurring tasks)
3. **AI Script Generator**: Integration with existing AI assistant to generate scripts
4. **Media Upload**: Direct image/video thumbnail upload vs. references
5. **Analytics Integration**: Pull posted content performance metrics
6. **Multi-User**: Collaboration features, assignments, approvals
7. **Calendar Sync**: Export to Google Calendar, iCal
8. **Notification System**: Reminders for upcoming content deadlines

## Testing Strategy

### Backend Tests
- Model validation tests
- API endpoint tests (CRUD operations)
- Date filtering tests (edge cases: leap years, ISO weeks)
- Project integration tests

### Frontend Tests
- Component rendering tests
- Navigation flow tests
- Date calculation utility tests
- Modal interaction tests

### Integration Tests
- End-to-end: Create content → Link to project → View in project detail
- Calendar navigation: Year → Month → Week → Day flow
- Filter and search functionality

## Success Criteria

1. ✅ User can navigate Year → Month → Week → Day hierarchically
2. ✅ User can create/edit/delete content with all specified fields
3. ✅ Content can optionally link to projects
4. ✅ Search and filter by status, type, platform work correctly
5. ✅ Export shooting schedule generates usable output
6. ✅ UI is consistent with existing app styling
7. ✅ No performance issues with 365 days of content data

## Implementation Priority

### Phase 1: Core Calendar (MVP)
1. Database model and migrations
2. API endpoints (CRUD + by-date queries)
3. Frontend: YearView, MonthView, WeekView, DayContentModal
4. Basic navigation and content creation

### Phase 2: Integration
1. Project linking
2. ProjectDetail content tab
3. Optional task generation

### Phase 3: Enhanced Features
1. Search and filters
2. Templates and duplication
3. Export functionality
4. List view toggle

## Conclusion

This design provides a flexible, hierarchical content planning system that integrates naturally with the existing app while remaining usable as a standalone tool. The hybrid approach allows users to track content simply or connect it deeply with their project workflow as needed.
