# Personal Assistant Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform app into a personal assistant with natural language input (Ctrl+K), complete lead tracking with won/lost status, and comprehensive export for CEO AI mentor.

**Architecture:**
- Add global CommandBar component using Ctrl+K shortcut to capture natural language input
- Wire CommandBar to existing `/api/tasks/parse` endpoint
- Ensure Deal pipeline sets `actual_close_date` when moved to CLOSED_WON/CLOSED_LOST
- Fix App.tsx to import real pages instead of placeholders

**Tech Stack:**
- React + TypeScript
- TanStack Query (React Query)
- Tailwind CSS
- FastAPI backend (already has parser endpoint)
- Command Pattern for keyboard shortcuts

---

## Current State Analysis

### ✅ What Works:
- Backend task parser (`/api/tasks/parse`) - parses "meeting tomorrow at 3pm" → creates task
- Full CRUD for Tasks, Contacts, Deals
- Kanban pipeline with Lead → Prospect → Proposal → Negotiation → Closed Won/Lost
- Export page generates comprehensive markdown for CEO AI
- Dashboard shows metrics

### ❌ What's Missing:
- **CRITICAL:** CommandBar (Ctrl+K) to capture natural language - NO UI to access parser!
- App.tsx imports placeholder pages instead of real components
- Deal stage changes don't set `actual_close_date` for closed deals
- No global keyboard shortcut handler

---

## Task 1: Fix App.tsx to Import Real Pages

**Files:**
- Modify: `frontend/src/App.tsx`

**Why:** App.tsx currently has placeholder components instead of importing the real Dashboard, Contacts, Deals, Export pages.

**Step 1: Update imports and remove placeholders**

Replace the entire file with:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Contacts from './pages/Contacts';
import Deals from './pages/Deals';
import Export from './pages/Export';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

**Step 3: Test locally**

Run: `cd frontend && npm run dev`
Expected: Navigate to all pages - they should load properly

**Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "fix: import real pages in App.tsx instead of placeholders"
```

---

## Task 2: Create CommandBar Component

**Files:**
- Create: `frontend/src/components/CommandBar.tsx`
- Create: `frontend/src/hooks/useKeyboardShortcut.ts`

**Why:** This is the CRITICAL missing piece - the UI to capture natural language input for the personal assistant feature.

**Step 1: Write useKeyboardShortcut hook**

Create `frontend/src/hooks/useKeyboardShortcut.ts`:

```typescript
import { useEffect } from 'react';

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrlKey?: boolean; metaKey?: boolean } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { ctrlKey = false, metaKey = false } = options;

      // Check if the key matches and modifiers match
      const ctrlMatch = ctrlKey ? event.ctrlKey : true;
      const metaMatch = metaKey ? event.metaKey : true;

      // Only trigger if key matches and we're not in an input/textarea
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
                     target.tagName === 'TEXTAREA' ||
                     target.isContentEditable;

      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        (event.ctrlKey || event.metaKey) === (ctrlKey || metaKey) &&
        !isInput
      ) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}
```

**Step 2: Write CommandBar component**

Create `frontend/src/components/CommandBar.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '@/lib/api';
import { X, Loader2, Check } from 'lucide-react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

export default function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Listen for Ctrl+K or Cmd+K
  useKeyboardShortcut('k', () => setIsOpen(true), { ctrlKey: true, metaKey: true });

  const parseMutation = useMutation({
    mutationFn: (text: string) => taskApi.parse(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setInput('');
        setShowSuccess(false);
      }, 1500);
    },
  });

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      parseMutation.mutate(input.trim());
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setInput('');
    setShowSuccess(false);
  };

  // Handle Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-32">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center px-6 py-4 border-b">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">
              Personal Assistant
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Type naturally: "meeting tomorrow at 3pm", "call John high priority"
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Review contract next Monday 2pm urgent"
            disabled={parseMutation.isPending || showSuccess}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300">
                Ctrl+K
              </kbd>{' '}
              to open • <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300">
                Esc
              </kbd>{' '}
              to close
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!input.trim() || parseMutation.isPending || showSuccess}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : showSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Created!
                  </>
                ) : (
                  'Create Task'
                )}
              </button>
            </div>
          </div>

          {parseMutation.isError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                Failed to create task. Please try again.
              </p>
            </div>
          )}
        </form>

        <div className="bg-gray-50 px-6 py-4 border-t">
          <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">
            Examples:
          </h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>• "Meeting with Sarah tomorrow at 3pm"</p>
            <p>• "Call John high priority"</p>
            <p>• "Proposal due Friday"</p>
            <p>• "Review contract next Monday 2pm urgent"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Test CommandBar standalone**

Run: `npm run dev`
Expected: No build errors

**Step 4: Commit**

```bash
git add frontend/src/components/CommandBar.tsx frontend/src/hooks/useKeyboardShortcut.ts
git commit -m "feat: add CommandBar component for natural language input"
```

---

## Task 3: Integrate CommandBar into App

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add CommandBar to App**

Update `frontend/src/App.tsx` to include CommandBar:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Contacts from './pages/Contacts';
import Deals from './pages/Deals';
import Export from './pages/Export';
import CommandBar from './components/CommandBar';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
      <CommandBar />
    </BrowserRouter>
  );
}

export default App;
```

**Step 2: Test keyboard shortcut**

Run: `npm run dev`
Actions:
1. Press Ctrl+K (or Cmd+K on Mac)
2. Type "meeting tomorrow at 3pm"
3. Click "Create Task"

Expected:
- Modal opens on Ctrl+K
- Task is created
- Success message shows
- Modal closes automatically
- New task appears in Tasks page

**Step 3: Test examples**

Try these inputs:
- "call John high priority tomorrow"
- "proposal due Friday"
- "review contract next Monday 2pm urgent"

Expected: Each creates a task with correct due date, time, priority

**Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: integrate CommandBar into app with Ctrl+K shortcut"
```

---

## Task 4: Add Task Parse API Endpoint to Frontend API

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Why:** Need to add the `parse` method to `taskApi` to call the backend parser.

**Step 1: Add parse method to taskApi**

In `frontend/src/lib/api.ts`, add the parse method:

```typescript
// Around line 67, add this method to taskApi:

parse: async (text: string): Promise<Task> => {
  const response = await api.post('/api/tasks/parse', { text });
  return response.data;
},
```

The full taskApi object should look like:

```typescript
export const taskApi = {
  getAll: async (status?: TaskStatus): Promise<Task[]> => {
    const params = status ? { status } : {};
    const response = await api.get('/api/tasks', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Task> => {
    const response = await api.get(`/api/tasks/${id}`);
    return response.data;
  },

  create: async (task: TaskCreate): Promise<Task> => {
    const response = await api.post('/api/tasks', task);
    return response.data;
  },

  update: async (id: number, task: TaskUpdate): Promise<Task> => {
    const response = await api.put(`/api/tasks/${id}`, task);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/tasks/${id}`);
  },

  updateStatus: async (id: number, status: TaskStatus): Promise<Task> => {
    const response = await api.patch(`/api/tasks/${id}/status`, null, {
      params: { status },
    });
    return response.data;
  },

  parse: async (text: string): Promise<Task> => {
    const response = await api.post('/api/tasks/parse', { text });
    return response.data;
  },
};
```

**Step 2: Test parse endpoint**

Run: `npm run dev`
Actions: Open browser console, test the API:

```javascript
// In browser console:
await fetch('http://localhost:8000/api/tasks/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'meeting tomorrow at 3pm' })
}).then(r => r.json())
```

Expected: Returns task object with parsed due_date, due_time

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add parse method to taskApi"
```

---

## Task 5: Update Backend to Set actual_close_date on Deal Stage Change

**Files:**
- Modify: `backend/app/routes/crm.py`

**Why:** When deals move to CLOSED_WON or CLOSED_LOST, we should automatically set `actual_close_date` to track when the deal actually closed.

**Step 1: Read current CRM routes**

Read the file to understand current implementation:

Run: Read `backend/app/routes/crm.py`

**Step 2: Update deal stage endpoint**

In `backend/app/routes/crm.py`, find the `update_deal_stage` function and modify it to set `actual_close_date`:

```python
from datetime import date

# ... existing imports ...

@router.patch("/{deal_id}/stage", response_model=DealResponse)
def update_deal_stage(
    deal_id: int,
    stage: DealStage,
    db: Session = Depends(get_db)
):
    """Update the stage of a deal"""
    db_deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    db_deal.stage = stage

    # Set actual_close_date when deal is closed (won or lost)
    if stage in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
        if not db_deal.actual_close_date:  # Only set if not already set
            db_deal.actual_close_date = date.today()

    db_deal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_deal)
    return db_deal
```

**Step 3: Test deal stage update**

Run: `cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`

Test with curl:
```bash
# Create a test deal first, then update its stage
curl -X PATCH "http://localhost:8000/api/crm/deals/1/stage?stage=closed_won" \
  -H "Content-Type: application/json"
```

Expected: Response includes `actual_close_date` set to today

**Step 4: Commit**

```bash
git add backend/app/routes/crm.py
git commit -m "feat: auto-set actual_close_date when deal moves to closed stage"
```

---

## Task 6: Add Command Bar Hint to Dashboard

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Why:** Users might not know about Ctrl+K shortcut, so add a helpful hint on the Dashboard.

**Step 1: Add hint banner to Dashboard**

In `frontend/src/pages/Dashboard.tsx`, add a banner after the header, before the metrics cards:

Find line 69 (after the header div closes) and add:

```typescript
{/* Command Bar Hint */}
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
  <div className="flex items-center">
    <div className="flex-shrink-0">
      <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    </div>
    <div className="ml-3">
      <p className="text-sm text-blue-700">
        💡 <strong>Pro tip:</strong> Press{' '}
        <kbd className="px-2 py-0.5 bg-white rounded border border-blue-300 text-xs font-mono">
          Ctrl+K
        </kbd>{' '}
        to quickly add tasks using natural language like "meeting tomorrow at 3pm"
      </p>
    </div>
  </div>
</div>
```

**Step 2: Test the hint**

Run: `npm run dev`
Navigate to Dashboard
Expected: Blue hint banner appears showing Ctrl+K shortcut

**Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: add Ctrl+K hint banner to dashboard"
```

---

## Task 7: Test Complete Flow Locally

**Files:** None (testing only)

**Step 1: Start both servers**

Terminal 1:
```bash
cd backend
venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend
npm run dev
```

**Step 2: Test Personal Assistant Flow**

1. Navigate to http://localhost:5173
2. Press Ctrl+K
3. Type: "urgent meeting with CEO tomorrow at 2pm"
4. Click "Create Task"
5. Go to Tasks page
6. Verify task appears with:
   - Title: "urgent meeting with CEO"
   - Due date: tomorrow's date
   - Due time: 14:00 (2pm)
   - Priority: URGENT

**Step 3: Test Lead Tracking**

1. Navigate to Deals page
2. Create a new deal
3. Drag it to "Closed Won" column
4. Click edit on that deal
5. Verify `expected_close_date` vs `actual_close_date` in backend

Check via API:
```bash
curl http://localhost:8000/api/crm/deals/1
```

Expected: `actual_close_date` is set to today

**Step 4: Test Export for CEO AI**

1. Navigate to Export page
2. Verify markdown includes:
   - Completed tasks
   - Pending tasks
   - Active deals with pipeline value
   - Recent interactions
   - Win rate calculation
   - Key metrics
3. Click "Copy to Clipboard"
4. Paste into a text editor
5. Verify format is clean markdown

**Step 5: Document test results**

Create `docs/testing/2025-11-08-manual-test-results.md` with results

---

## Task 8: Build and Deploy

**Files:** None (deployment only)

**Step 1: Build frontend**

```bash
cd frontend
npm run build
```

Expected: Build succeeds, creates `dist/` folder

**Step 2: Commit all changes**

```bash
git status
git add .
git commit -m "feat: complete personal assistant with CommandBar, lead tracking, and export

- Add CommandBar component with Ctrl+K shortcut for natural language input
- Integrate CommandBar globally in App.tsx
- Add parse endpoint to frontend API
- Auto-set actual_close_date when deals close
- Add helpful Ctrl+K hint to dashboard
- Fix App.tsx to import real pages"
```

**Step 3: Push to GitHub**

```bash
git push origin main
```

Expected: Render auto-deploys the new version

**Step 4: Verify deployment**

Wait 5 minutes for deploy, then test:
- Visit https://personalapp-y7au.onrender.com
- Press Ctrl+K
- Create a task via natural language
- Verify it appears in Tasks page

---

## Task 9: Create User Documentation

**Files:**
- Create: `docs/USER_GUIDE.md`

**Step 1: Write user guide**

Create `docs/USER_GUIDE.md`:

```markdown
# Personal Productivity App - User Guide

## Overview

Your personal assistant for task management, CRM, and strategic insights.

## Features

### 1. Personal Assistant (Ctrl+K)

**Quick Add Tasks with Natural Language**

Press `Ctrl+K` (or `Cmd+K` on Mac) anywhere in the app to open the command bar.

**Examples:**
- "meeting tomorrow at 3pm" → Creates task due tomorrow at 3pm
- "call John high priority" → Creates high priority task to call John
- "proposal due Friday" → Creates task due this Friday
- "review contract next Monday 2pm urgent" → Creates urgent task for next Monday at 2pm

**Supported Patterns:**
- **Dates:** today, tomorrow, Monday-Sunday, next week, next month, YYYY-MM-DD
- **Times:** 3pm, 14:00, 2:30pm
- **Priorities:** low, medium, high, urgent, important

### 2. Task Management

**Create Tasks:**
- Use Ctrl+K for quick natural language input
- Or click "New Task" button for form-based input

**Organize:**
- Filter by status: All, Pending, In Progress, Completed
- See overdue tasks highlighted in red
- Mark tasks complete with checkbox

**Priority Levels:**
- 🔴 Urgent - Critical, needs immediate attention
- 🟠 High - Important, high priority
- 🔵 Medium - Normal priority (default)
- ⚪ Low - Nice to have

### 3. Lead Tracking (CRM)

**Contact Management:**
- Store contacts with email, phone, company
- Track status: Lead → Prospect → Client → Inactive

**Deal Pipeline:**
- Visual kanban board
- Stages: Lead → Prospect → Proposal → Negotiation → Closed Won/Lost
- Drag-and-drop to update stage
- Track deal value and probability
- Automatically records close date when deal is won/lost

**Win Rate Tracking:**
- Dashboard shows win rate percentage
- Export includes closed won/lost analysis

### 4. Context Export for CEO AI

**Generate Comprehensive Reports:**

Navigate to Export page to generate markdown reports including:
- Task summary (completed, pending, overdue)
- Active deals and pipeline value
- Recent interactions
- Win rate and key metrics

**How to Use:**
1. Select date range (last 7 days, 30 days, or custom)
2. Click "Copy to Clipboard"
3. Paste into Claude.ai
4. Ask for strategic advice: "Based on this context, what should I focus on this week?"

**Example Prompts for Claude:**
- "What are my biggest bottlenecks?"
- "Which deals should I prioritize?"
- "Am I overcommitted on tasks?"
- "What's my execution pattern?"

## Keyboard Shortcuts

- `Ctrl+K` / `Cmd+K` - Open command bar (personal assistant)
- `Esc` - Close command bar

## Tips & Best Practices

1. **Use Natural Language Daily**
   - Capture tasks immediately as they come up
   - Don't worry about perfect syntax - the parser is smart

2. **Update Deal Stages Regularly**
   - Drag deals through the pipeline as they progress
   - The system tracks when deals close automatically

3. **Weekly Export to CEO AI**
   - Export last 7 days every Monday
   - Ask Claude for weekly focus areas
   - Review metrics and adjust priorities

4. **Dashboard as Morning Routine**
   - Check overdue tasks first
   - Review today's tasks
   - Glance at pipeline value

## Troubleshooting

**Command bar not opening?**
- Make sure you're not in an input field
- Try Cmd+K if Ctrl+K doesn't work (Mac)

**Natural language not parsing correctly?**
- Use explicit dates: "Nov 10" instead of "next week"
- Include time: "at 3pm" or "14:00"
- Spell out priority: "high priority" or "urgent"

**Export showing no data?**
- Adjust date range
- Ensure you have tasks/deals created
- Check that backend is connected

## Support

For issues or feature requests, see the GitHub repository.
```

**Step 2: Commit documentation**

```bash
git add docs/USER_GUIDE.md
git commit -m "docs: add comprehensive user guide"
```

---

## Summary

### What We Built:

1. ✅ **Personal Assistant** - Ctrl+K command bar with natural language parsing
   - "meeting tomorrow at 3pm" → instant task creation
   - Works globally across the app
   - Smart parsing for dates, times, priorities

2. ✅ **Complete Lead Tracking** - Full CRM pipeline
   - Lead → Prospect → Proposal → Negotiation → Closed Won/Lost
   - Automatic `actual_close_date` tracking
   - Win rate calculations
   - Pipeline value metrics

3. ✅ **CEO AI Export** - Comprehensive context reports
   - All task metrics
   - CRM overview
   - Pipeline health
   - Ready to paste into Claude for strategic advice

4. ✅ **Polished UX**
   - Helpful hints on dashboard
   - Keyboard shortcuts
   - Real pages properly wired up
   - Smooth animations and feedback

### Implementation Order:

1. Fix App.tsx imports (1 task - 5 min)
2. Create CommandBar + hook (2 tasks - 30 min)
3. Integrate CommandBar (1 task - 10 min)
4. Add parse API endpoint (1 task - 5 min)
5. Backend: auto-set close date (1 task - 10 min)
6. Dashboard hint (1 task - 10 min)
7. Test complete flow (1 task - 20 min)
8. Build & deploy (1 task - 10 min)
9. Documentation (1 task - 15 min)

**Total: ~2 hours**

### Verification Checklist:

- [ ] Ctrl+K opens command bar from any page
- [ ] "meeting tomorrow at 3pm" creates task correctly
- [ ] Deal moved to Closed Won sets actual_close_date
- [ ] Export generates comprehensive markdown
- [ ] All pages load properly (not placeholders)
- [ ] Dashboard shows hint about Ctrl+K
- [ ] Build succeeds without errors
- [ ] Deployed app works on Render

---

## Next Steps (Optional Future Enhancements):

1. **Search**: Global search across tasks, contacts, deals
2. **Notifications**: Browser notifications for overdue tasks
3. **Recurring Tasks**: "every Monday" pattern support
4. **Mobile App**: React Native version
5. **Email Integration**: Parse emails to create tasks/interactions
6. **Calendar Sync**: Two-way sync with Google Calendar
7. **Team Collaboration**: Multi-user support
8. **AI Suggestions**: Claude suggests next actions in dashboard
