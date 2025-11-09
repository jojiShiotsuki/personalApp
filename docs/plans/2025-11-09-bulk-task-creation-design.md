# Bulk Task Creation via Quick-Add Modal

**Date:** 2025-11-09
**Status:** Approved
**Author:** Claude (Brainstorming Session)

## Overview

Enable users to quickly add multiple tasks at once by pressing Ctrl+K, pasting a list of tasks (from Claude chat or anywhere), and creating them all in a single action. This dramatically speeds up bulk task entry compared to the current one-at-a-time modal flow.

## Problem Statement

Currently, users must:
1. Click "New Task" button
2. Fill out form fields
3. Submit
4. Repeat for each task

When importing tasks from external sources (Claude chat, meeting notes, etc.), this is tedious and time-consuming.

## Solution

### User Flow

1. User presses **Ctrl+K** (or Cmd+K on Mac) anywhere on the Tasks page
2. Quick-add modal appears with a large textarea
3. User pastes multi-line task list in any format:
   - Bulleted lists (-, *, •)
   - Numbered lists (1., 2., 3.)
   - Plain lines
   - Mixed formats
4. User presses **Cmd/Ctrl+Enter** or clicks "Create Tasks"
5. All tasks are parsed and created atomically
6. Success toast shows count: "Created 5 tasks successfully!"
7. Task list refreshes, modal closes

### Architecture

**Frontend Components:**
- `QuickAddModal.tsx` - New modal component
- `Tasks.tsx` - Modified to add keyboard listener and modal state

**Backend Endpoints:**
- `/api/tasks/parse-bulk` - New endpoint accepting array of task strings

**Reused Services:**
- `TaskParser` service - Existing natural language parser

## Technical Design

### Frontend: QuickAddModal Component

**Location:** `frontend/src/components/QuickAddModal.tsx`

**Interface:**
```typescript
interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}
```

**Features:**
- Dark backdrop overlay (bg-black/50)
- Centered card with large textarea
- Placeholder: "Paste your tasks here... (one per line)"
- Shows line count or character count
- Keyboard shortcuts:
  - `Escape` → Close modal
  - `Cmd/Ctrl+Enter` → Submit
- Loading state during API call
- Error handling with inline message

**State Management:**
```typescript
const [taskText, setTaskText] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Frontend: Tasks.tsx Modifications

**New State:**
```typescript
const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
```

**Keyboard Listener:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setIsQuickAddOpen(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Bulk Create Mutation:**
```typescript
const bulkCreateMutation = useMutation({
  mutationFn: (lines: string[]) => taskApi.parseBulk(lines),
  onSuccess: (tasks) => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    setIsQuickAddOpen(false);
    // Show success toast with count
  },
  onError: (error) => {
    // Show error message
  },
});
```

**API Client Method:**
```typescript
// In frontend/src/lib/api.ts
export const taskApi = {
  // ... existing methods

  parseBulk: async (lines: string[]): Promise<Task[]> => {
    const response = await api.post('/api/tasks/parse-bulk', { lines });
    return response.data;
  },
};
```

### Backend: Parse-Bulk Endpoint

**Location:** `backend/app/routes/task_parser.py`

**Endpoint Definition:**
```python
@router.post("/parse-bulk", response_model=List[TaskResponse])
def parse_and_create_bulk(
    request: TaskBulkParseRequest,
    db: Session = Depends(get_db)
):
    """
    Parse multiple task lines and create all tasks atomically.

    Handles mixed formats:
    - Bulleted lists (-, *, •)
    - Numbered lists (1., 2., 3.)
    - Plain lines

    Creates all tasks in single database transaction.
    """
    def clean_line(line: str) -> str:
        line = line.strip()
        # Remove bullet points
        line = re.sub(r'^[-*•]\s*', '', line)
        # Remove numbered list markers
        line = re.sub(r'^\d+\.\s*', '', line)
        return line.strip()

    tasks = []
    for line in request.lines:
        cleaned = clean_line(line)
        if cleaned:  # Skip empty lines
            parsed = TaskParser.parse(cleaned)
            db_task = Task(**parsed)
            tasks.append(db_task)

    if not tasks:
        raise HTTPException(
            status_code=400,
            detail="No valid tasks found in input"
        )

    # Add all to session (atomic transaction)
    db.add_all(tasks)
    db.commit()

    # Refresh all to get IDs and timestamps
    for task in tasks:
        db.refresh(task)

    return tasks
```

**New Schema:**
```python
# In backend/app/schemas/task.py
class TaskBulkParseRequest(BaseModel):
    lines: List[str]

    class Config:
        json_schema_extra = {
            "example": {
                "lines": [
                    "- Meeting tomorrow at 3pm",
                    "Call John high priority",
                    "Review proposal Friday"
                ]
            }
        }
```

### Line Parsing Logic

**Supported Formats:**
```
Input Example                   After Cleaning
---------------------------------------------------------
- Task one                  →   Task one
* Task two                  →   Task two
• Task three                →   Task three
1. Task four                →   Task four
2. Task five                →   Task five
Task six                    →   Task six (unchanged)
                            →   (skipped - empty)
```

**Regex Patterns:**
- `^[-*•]\s*` - Matches bullet points with optional whitespace
- `^\d+\.\s*` - Matches numbered lists (1., 2., etc.) with optional whitespace

**TaskParser Integration:**
After cleaning list markers, each line is passed to the existing `TaskParser.parse()` which handles:
- Natural language date parsing ("tomorrow", "Friday", "next Monday")
- Time extraction ("3pm", "2:30pm")
- Priority keywords ("urgent", "high priority", "low")
- Status defaults to PENDING

## Error Handling

### Backend Errors

**No Valid Tasks:**
```python
HTTP 400: "No valid tasks found in input"
```

**Database Error:**
```python
HTTP 500: Generic error message
# Log full details server-side
```

**Validation Error:**
```python
HTTP 422: Pydantic validation details
```

### Frontend Error Display

**Empty Input:**
- Show inline error: "Please enter at least one task"
- Don't make API call

**API Error:**
- Display error message in modal
- Keep textarea content intact
- Allow user to fix and retry
- Don't close modal

**Network Error:**
- Show generic message: "Failed to create tasks. Please try again."
- Log full error for debugging

## User Feedback

### Success State

**Toast Notification:**
```
✓ Created 5 tasks successfully!
```

**Behavior:**
- Task list automatically refreshes (via React Query invalidation)
- Modal closes
- Textarea clears for next use
- User sees new tasks appear in list

### Loading State

**Button:**
- Disabled while submitting
- Text changes: "Create Tasks" → "Creating tasks..."
- Show spinner icon

**Textarea:**
- Disabled during submission
- Cursor shows loading state

### Error State

**Display:**
- Error message appears below textarea
- Red text with error icon
- Specific message when possible
- Generic fallback for unknown errors

**Behavior:**
- Modal stays open
- Textarea content preserved
- Submit button re-enabled
- User can edit and retry

## Implementation Checklist

### Backend
- [ ] Add `TaskBulkParseRequest` schema to `backend/app/schemas/task.py`
- [ ] Implement `/parse-bulk` endpoint in `backend/app/routes/task_parser.py`
- [ ] Add line cleaning logic with regex patterns
- [ ] Implement atomic transaction for bulk insert
- [ ] Add error handling for empty input
- [ ] Test with various list formats

### Frontend
- [ ] Create `QuickAddModal.tsx` component
- [ ] Add keyboard listener (Ctrl+K) to `Tasks.tsx`
- [ ] Add quick-add modal state management
- [ ] Implement `parseBulk` API method in `api.ts`
- [ ] Add bulk create mutation with React Query
- [ ] Implement success/error toast notifications
- [ ] Add loading states and disabled states
- [ ] Test keyboard shortcuts (Escape, Ctrl+Enter)
- [ ] Test with empty input, single task, multiple tasks
- [ ] Test error recovery flow

### Integration
- [ ] Test end-to-end flow from keyboard shortcut to task creation
- [ ] Verify task list refresh after creation
- [ ] Test with mixed list formats (bullets, numbers, plain)
- [ ] Verify natural language parsing still works (dates, times, priority)
- [ ] Test transaction rollback on error
- [ ] Verify no duplicate tasks on retry

## Future Enhancements

**Phase 2 Possibilities:**
- Show preview of parsed tasks before creation
- Allow editing individual tasks in preview
- Smart detection of task metadata (auto-assign due dates based on context)
- Template support ("meeting" → auto-adds default time)
- Keyboard shortcut customization in settings

**Not in Scope:**
- Editing existing tasks in bulk
- Task import from files (CSV, JSON)
- Recurring task creation
- Task templates or presets

## Success Metrics

- Time to add 10 tasks: <30 seconds (vs. ~5 minutes with manual entry)
- Error rate: <5% of bulk operations
- User adoption: Track Ctrl+K usage vs. traditional "New Task" button
- Most common formats: Track which list formats users paste

## Dependencies

- Existing `TaskParser` service
- Existing task creation flow and database schema
- React Query for state management
- Lucide icons for UI elements

## Risks and Mitigation

**Risk:** Users paste non-task content
**Mitigation:** Parser is lenient, creates reasonable defaults. Show preview in future iteration.

**Risk:** Very large pastes (1000+ lines)
**Mitigation:** Add line limit (e.g., 100 tasks max) with clear error message.

**Risk:** Ctrl+K conflicts with browser/OS shortcuts
**Mitigation:** Event.preventDefault() handles most cases. Can make shortcut configurable if needed.

**Risk:** Database transaction timeout on large batches
**Mitigation:** SQLAlchemy handles bulk inserts efficiently. 100 tasks should be <100ms.

## Conclusion

This feature transforms task entry from a tedious multi-click process into a single keyboard shortcut and paste. By leveraging the existing TaskParser service and implementing a clean batch endpoint, we maintain code quality while delivering significant UX improvements. The atomic transaction guarantees data consistency, and the thoughtful error handling ensures users can recover from mistakes without losing their work.
