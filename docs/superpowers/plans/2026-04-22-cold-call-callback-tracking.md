# Cold-Call Callback Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user capture "call me back at X time" during cold calls, surface callbacks on each prospect card with urgency-tiered coloring, and add a "Callbacks Due" stat that filters the kanban to prospects that need action today.

**Architecture:** Two new nullable columns (`callback_at`, `callback_notes`) on `call_prospects`. The modal gains a Callback section (datetime picker + four quick-preset buttons + optional notes + Clear). The card gains a relative-time pill (`Due in 45m`, `Today 3:00 PM`, `Overdue`). The existing stats bar gains a 5th stat (`Callbacks Due`) that doubles as a kanban filter when clicked — filtered view sorts cards ascending by `callback_at`. Callback is orthogonal to status; it never moves the card between columns.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), React 18 + TypeScript + TanStack Query + TailwindCSS (frontend). No new runtime deps. Existing `date-fns` handles formatting.

**Spec:** `docs/superpowers/specs/2026-04-22-cold-call-callback-tracking-design.md`

**Current alembic head:** `scr_label_2026_04_21` (confirmed via `venv/Scripts/alembic.exe heads`).

---

## Testing Strategy

This repo does not have a frontend unit-test runner installed (only `@playwright/test` for e2e, and no backend pytest setup either per the existing tree). Introducing one is out of scope.

**Verification method per task:**

- **Backend model/schema changes** — verified by booting the backend locally after the migration and confirming `GET /cold-calls/` returns the new fields on a row with a `callback_at` set.
- **Frontend pure utilities** (`callbackFormat.ts`) — verified by a quick REPL-style ad-hoc script in the browser console during dev, plus TypeScript compile (`npm run build` invokes `tsc -b`).
- **UI changes** — verified by manual test in the browser with dark mode on, per the CLAUDE.md dark-mode verification checklist, and Playwright MCP smoke if it's already wired.
- **Migration** — verified with `alembic upgrade head` then `alembic downgrade -1` then `alembic upgrade head` round-trip.

Every task ends with a verification command and expected outcome. TDD-style failing-first does not apply cleanly without a unit runner; instead, "run the app and confirm the field is present / the pill renders / the filter filters" is the acceptance gate.

---

## File Structure

**Create (4):**
- `backend/alembic/versions/cb_tracking_2026_04_22_add_callback_fields_to_call_prospects.py`
- `frontend/src/lib/callbackFormat.ts`
- `frontend/src/hooks/useCurrentMinute.ts`
- *(no new component files — callback pill is a small inline component inside `ColdCallsTab.tsx`)*

**Modify (6):**
- `backend/app/models/call_prospect.py` — add 2 columns + index
- `backend/app/schemas/call_prospect.py` — add fields to `CallProspectBase`, `CallProspectUpdate`
- `frontend/src/types/index.ts` — add fields to 3 interfaces
- `frontend/src/lib/outreachStyles.ts` — add `orange` to `StatAccent`
- `frontend/src/components/outreach/HubStatsBar.tsx` — make grid-cols length-aware so 5 stats fit
- `frontend/src/components/outreach/CallProspectDetailModal.tsx` — Callback section
- `frontend/src/components/outreach/ColdCallsTab.tsx` — pill on card, 5th stat, filter state + logic

No files exceed 800 lines after changes (`ColdCallsTab.tsx` stays under 1200, within project norms).

---

## Task 1: Add callback columns to the CallProspect model

**Files:**
- Modify: `backend/app/models/call_prospect.py` (lines 11-14 imports, line 54 after `script_label`, line 77 index block)

- [ ] **Step 1: Add the two columns and a lookup index**

In `backend/app/models/call_prospect.py`, the imports at line 13 already cover what we need (`DateTime`, `Index`, `String`, `Text`). Add the two columns immediately after the `script_label` column (currently line 54). Replace the block:

```python
    # Free-text tag for A/B testing phone scripts. NULL = no label.
    script_label = Column(String(50), nullable=True)
    status = Column(
```

with:

```python
    # Free-text tag for A/B testing phone scripts. NULL = no label.
    script_label = Column(String(50), nullable=True)
    # Scheduled callback time captured when the prospect says "call me back at X".
    # Stored in UTC; frontend converts to browser local for display + input.
    # NULL = no callback scheduled. Orthogonal to `status` — setting this does
    # not move the prospect between kanban columns.
    callback_at = Column(DateTime, nullable=True, index=True)
    # Optional short context for the callback (e.g. "owner back from holiday").
    callback_notes = Column(String(255), nullable=True)
    status = Column(
```

The `index=True` on `callback_at` creates an implicit index used by the "Callbacks Due" stat and filter.

- [ ] **Step 2: Verify model imports and structure**

Run from `backend/`:

```bash
venv/Scripts/python.exe -c "from app.models.call_prospect import CallProspect; print([c.name for c in CallProspect.__table__.columns])"
```

Expected: a list that includes `callback_at` and `callback_notes` alongside the existing columns.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/call_prospect.py
git commit -m "feat(cold-calls): add callback_at and callback_notes to CallProspect model"
```

---

## Task 2: Write hand-scrubbed Alembic migration

**Files:**
- Create: `backend/alembic/versions/cb_tracking_2026_04_22_add_callback_fields_to_call_prospects.py`

Per the existing `feedback_alembic-autogenerate-drift.md` memory, do NOT run `--autogenerate`. Write the migration by hand, adding only the two columns and the index.

- [ ] **Step 1: Create the migration file with exact contents**

Write `backend/alembic/versions/cb_tracking_2026_04_22_add_callback_fields_to_call_prospects.py`:

```python
"""add callback fields to call_prospects

Adds callback_at (nullable DateTime) and callback_notes (nullable String(255))
for the Cold Calls callback-tracking feature. Includes an index on callback_at
to keep the "Callbacks Due" count + kanban filter cheap.

Revision ID: cb_tracking_2026_04_22
Revises: scr_label_2026_04_21
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'cb_tracking_2026_04_22'
down_revision = 'scr_label_2026_04_21'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'call_prospects',
        sa.Column('callback_at', sa.DateTime(), nullable=True),
    )
    op.add_column(
        'call_prospects',
        sa.Column('callback_notes', sa.String(length=255), nullable=True),
    )
    op.create_index(
        'ix_call_prospects_callback_at',
        'call_prospects',
        ['callback_at'],
        unique=False,
    )


def downgrade() -> None:
    with op.batch_alter_table('call_prospects', schema=None) as batch_op:
        batch_op.drop_index('ix_call_prospects_callback_at')
        batch_op.drop_column('callback_notes')
        batch_op.drop_column('callback_at')
```

- [ ] **Step 2: Apply the migration**

From `backend/`:

```bash
venv/Scripts/alembic.exe upgrade head
```

Expected: `INFO [alembic.runtime.migration] Running upgrade scr_label_2026_04_21 -> cb_tracking_2026_04_22, add callback fields to call_prospects` and no errors.

- [ ] **Step 3: Verify round-trip**

```bash
venv/Scripts/alembic.exe downgrade -1
venv/Scripts/alembic.exe upgrade head
```

Expected: downgrade logs `cb_tracking_2026_04_22 -> scr_label_2026_04_21` with no error, upgrade re-applies cleanly.

- [ ] **Step 4: Confirm column presence in DB**

```bash
venv/Scripts/python.exe -c "from sqlalchemy import inspect; from app.database import engine; i = inspect(engine); print([c['name'] for c in i.get_columns('call_prospects')])"
```

Expected: output includes both `callback_at` and `callback_notes`.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/cb_tracking_2026_04_22_add_callback_fields_to_call_prospects.py
git commit -m "feat(cold-calls): migration for callback_at and callback_notes columns"
```

---

## Task 3: Add callback fields to Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/call_prospect.py` (lines 18-40 `CallProspectBase`, lines 47-70 `CallProspectUpdate`)

The `CallProspectResponse` (line 73) inherits from `CallProspectBase`, so adding fields to the base exposes them on GET responses automatically.

- [ ] **Step 1: Add fields to `CallProspectBase`**

At the end of the `CallProspectBase` class body (after `current_step: int = 1` on line 40), add:

```python
    callback_at: Optional[datetime] = None
    callback_notes: Optional[str] = Field(None, max_length=255)
```

- [ ] **Step 2: Add fields to `CallProspectUpdate`**

At the end of `CallProspectUpdate` (after `current_step: Optional[int] = Field(None, ge=1)` on line 70), add:

```python
    callback_at: Optional[datetime] = None
    callback_notes: Optional[str] = Field(None, max_length=255)
```

- [ ] **Step 3: Restart the backend and verify schema roundtrip**

Start the backend:

```bash
venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Then in another shell, run:

```bash
curl -s http://localhost:8000/cold-calls/ | head -c 2000
```

Expected: each prospect object in the JSON array contains `"callback_at": null` and `"callback_notes": null` (assuming no rows have been updated yet).

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/call_prospect.py
git commit -m "feat(cold-calls): expose callback fields in CallProspect schemas"
```

---

## Task 4: Add callback fields to frontend types

**Files:**
- Modify: `frontend/src/types/index.ts` (lines 1659-1735)

- [ ] **Step 1: Add fields to `CallProspect`**

Within the `CallProspect` interface, after the `script_label?: string | null;` line (around line 1680), add:

```typescript
  callback_at: string | null;
  callback_notes: string | null;
```

- [ ] **Step 2: Add fields to `CallProspectCreate`**

Within `CallProspectCreate`, after the `current_step?: number;` line (around line 1709), add:

```typescript
  callback_at?: string | null;
  callback_notes?: string | null;
```

- [ ] **Step 3: Add fields to `CallProspectUpdate`**

Within `CallProspectUpdate`, after the `current_step?: number;` line (around line 1734), add:

```typescript
  callback_at?: string | null;
  callback_notes?: string | null;
```

- [ ] **Step 4: Verify type-check passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds, no TS errors. (Build runs `tsc -b` then `vite build`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(cold-calls): add callback fields to CallProspect types"
```

---

## Task 5: Add `useCurrentMinute` hook

**Files:**
- Create: `frontend/src/hooks/useCurrentMinute.ts`

- [ ] **Step 1: Create the hook**

Write `frontend/src/hooks/useCurrentMinute.ts`:

```typescript
import { useEffect, useState } from 'react';

/**
 * Returns a Date pinned to the current wall-clock minute. Re-renders the
 * consumer once per minute so components that format relative times
 * ("Due in 5m", "Overdue") stay fresh without a full page refresh.
 *
 * The tick schedules itself to fire at the next minute boundary so callers
 * flip tiers at the same second across the app (e.g. all "In 1m" pills
 * become "Overdue" simultaneously).
 */
export function useCurrentMinute(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const msUntilNextMinute =
      60_000 - (Date.now() % 60_000);

    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return now;
}
```

- [ ] **Step 2: Verify type-check passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds. (The hook is not yet consumed, but must compile.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useCurrentMinute.ts
git commit -m "feat(cold-calls): add useCurrentMinute hook for live-ticking relative times"
```

---

## Task 6: Add `callbackFormat` util

**Files:**
- Create: `frontend/src/lib/callbackFormat.ts`

- [ ] **Step 1: Create the util**

Write `frontend/src/lib/callbackFormat.ts`:

```typescript
import { format, isSameDay, differenceInCalendarDays } from 'date-fns';

/**
 * Urgency tier for a scheduled callback. Drives the pill color in the card
 * and the sort order in the "Callbacks Due" filter (overdue first).
 */
export type CallbackTier =
  | 'overdue'
  | 'soon'       // <= 60 min away
  | 'today'      // later today, > 60 min away
  | 'tomorrow'
  | 'thisweek'   // within 7 days
  | 'future';    // > 7 days

export function callbackTier(at: Date, now: Date): CallbackTier {
  const diffMs = at.getTime() - now.getTime();
  if (diffMs < 0) return 'overdue';
  if (diffMs <= 60 * 60 * 1000) return 'soon';
  if (isSameDay(at, now)) return 'today';
  const days = differenceInCalendarDays(at, now);
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'thisweek';
  return 'future';
}

/**
 * Smart relative label for a callback pill.
 *
 * overdue  → "Overdue · 9:45 AM"
 * soon     → "Due in 45m"
 * today    → "Today 3:00 PM"
 * tomorrow → "Tomorrow 10:00 AM"
 * thisweek → "Wed 3:00 PM"
 * future   → "Apr 30 3:00 PM"
 */
export function formatCallbackLabel(at: Date, now: Date): string {
  const tier = callbackTier(at, now);
  const timeStr = format(at, 'h:mm a');

  switch (tier) {
    case 'overdue':
      return `Overdue · ${timeStr}`;
    case 'soon': {
      const minutes = Math.max(
        1,
        Math.round((at.getTime() - now.getTime()) / 60000),
      );
      return `Due in ${minutes}m`;
    }
    case 'today':
      return `Today ${timeStr}`;
    case 'tomorrow':
      return `Tomorrow ${timeStr}`;
    case 'thisweek':
      return `${format(at, 'EEE')} ${timeStr}`;
    case 'future':
      return `${format(at, 'MMM d')} ${timeStr}`;
  }
}

/**
 * True when a scheduled callback should count toward "Callbacks Due" —
 * i.e. at or before the end of today in the browser's local timezone.
 * Used by the stats bar count AND the filter predicate so they stay in sync.
 */
export function isDueByEndOfToday(at: Date, now: Date): boolean {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return at.getTime() <= endOfToday.getTime();
}

/**
 * Quick-preset values for the modal callback picker. All preset helpers
 * return a Date in local time.
 */
export function presetInOneHour(now: Date): Date {
  return roundUpTo5Min(new Date(now.getTime() + 60 * 60 * 1000));
}

export function presetInTwoHours(now: Date): Date {
  return roundUpTo5Min(new Date(now.getTime() + 120 * 60 * 1000));
}

export function presetTomorrowTenAm(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function presetNextMondayTenAm(now: Date): Date {
  const d = new Date(now);
  // getDay(): 0=Sun..6=Sat. Days until next Monday — always at least 1 day
  // ahead even if today is Monday.
  const daysAhead = ((1 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + daysAhead);
  d.setHours(10, 0, 0, 0);
  return d;
}

function roundUpTo5Min(d: Date): Date {
  const rounded = new Date(d);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 5;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (5 - remainder));
  }
  rounded.setSeconds(0, 0);
  return rounded;
}

/**
 * `<input type="datetime-local">` needs a string in `YYYY-MM-DDTHH:mm`
 * representing local time. Returns empty string for null.
 */
export function toLocalInputValue(at: Date | null): string {
  if (!at) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}`
  );
}

/**
 * Parse a `<input type="datetime-local">` value back into a Date (local).
 * Returns null for empty/invalid input.
 */
export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

- [ ] **Step 2: Sanity-check via REPL**

Open the frontend dev server (`npm run dev` from `frontend/`), visit any page, then run in the browser console:

```javascript
const { formatCallbackLabel, callbackTier } = await import('/src/lib/callbackFormat.ts');
const now = new Date();
const in30 = new Date(now.getTime() + 30 * 60 * 1000);
const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
const past = new Date(now.getTime() - 15 * 60 * 1000);
console.log(formatCallbackLabel(in30, now), '|', callbackTier(in30, now));
console.log(formatCallbackLabel(in2h, now), '|', callbackTier(in2h, now));
console.log(formatCallbackLabel(past, now), '|', callbackTier(past, now));
```

Expected output (approximate):
```
Due in 30m | soon
Today <formatted-time> | today
Overdue · <formatted-time> | overdue
```

- [ ] **Step 3: Verify type-check passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/callbackFormat.ts
git commit -m "feat(cold-calls): add callback format + preset utilities"
```

---

## Task 7: Add Callback section to prospect detail modal

**Files:**
- Modify: `frontend/src/components/outreach/CallProspectDetailModal.tsx`

- [ ] **Step 1: Extend imports**

Replace the existing lucide-react import block (lines 4-13) with:

```typescript
import {
  X,
  Clock,
  Trash2,
  Facebook,
  Globe,
  MapPin,
  ExternalLink,
  PhoneCall,
} from 'lucide-react';
```

Right below the existing `@/` imports (after line 17), add:

```typescript
import {
  fromLocalInputValue,
  presetInOneHour,
  presetInTwoHours,
  presetNextMondayTenAm,
  presetTomorrowTenAm,
  toLocalInputValue,
} from '@/lib/callbackFormat';
```

- [ ] **Step 2: Extend form state and reset effect**

In the component body, after the existing `const [scriptLabel, setScriptLabel] = useState(prospect.script_label ?? '');` (line 63), add:

```typescript
  const [callbackInput, setCallbackInput] = useState<string>(() =>
    toLocalInputValue(prospect.callback_at ? new Date(prospect.callback_at) : null),
  );
  const [callbackNotes, setCallbackNotes] = useState(prospect.callback_notes ?? '');
```

In the reset `useEffect` (lines 69-74), extend the deps and body. Replace the entire effect with:

```typescript
  useEffect(() => {
    setNotes(prospect.notes ?? '');
    setStatus(prospect.status);
    setScriptLabel(prospect.script_label ?? '');
    setCallbackInput(
      toLocalInputValue(prospect.callback_at ? new Date(prospect.callback_at) : null),
    );
    setCallbackNotes(prospect.callback_notes ?? '');
    setDescExpanded(false);
  }, [
    prospect.id,
    prospect.notes,
    prospect.status,
    prospect.script_label,
    prospect.callback_at,
    prospect.callback_notes,
  ]);
```

- [ ] **Step 3: Wire callback fields into the save mutation**

Replace the existing `updateMutation` block (lines 86-102) with:

```typescript
  const updateMutation = useMutation({
    mutationFn: () => {
      const callbackDate = fromLocalInputValue(callbackInput);
      return coldCallsApi.update(prospect.id, {
        notes: notes.trim() ? notes : null,
        status,
        script_label: scriptLabel.trim() || null,
        callback_at: callbackDate ? callbackDate.toISOString() : null,
        callback_notes: callbackNotes.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      toast.success('Prospect saved');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save prospect');
    },
  });
```

- [ ] **Step 4: Add preset + clear handlers**

Right before the `handleSubmit` definition (around line 131), add:

```typescript
  const applyPreset = (preset: (now: Date) => Date) => {
    setCallbackInput(toLocalInputValue(preset(new Date())));
  };

  const clearCallback = () => {
    setCallbackInput('');
    setCallbackNotes('');
  };
```

- [ ] **Step 5: Render the Callback section in the form**

Inside the `<form>`, between the Script Label block and the Notes block (after line 330, i.e. after the closing `</div>` of the Script Label field), insert:

```tsx
            {/* Callback — datetime picker + quick presets + optional note */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Callback
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={callbackInput}
                  onChange={(e) => setCallbackInput(e.target.value)}
                  className={cn(inputClasses, 'flex-1')}
                />
                {callbackInput && (
                  <button
                    type="button"
                    onClick={clearCallback}
                    className="px-3 py-2 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: 'In 1h', fn: presetInOneHour },
                  { label: 'In 2h', fn: presetInTwoHours },
                  { label: 'Tomorrow 10am', fn: presetTomorrowTenAm },
                  { label: 'Next Mon 10am', fn: presetNextMondayTenAm },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.fn)}
                    className="px-2.5 py-1 text-[11px] font-medium text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50 rounded-lg transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
                maxLength={255}
                placeholder="Callback note (optional) — e.g. owner back from holiday"
                className={cn(inputClasses, 'mt-2')}
              />
            </div>
```

(The `PhoneCall` icon import from Step 1 is for the card pill in Task 9; keep the import ready even though this task doesn't render it.)

- [ ] **Step 6: Manual verification**

Start backend + frontend locally. Open Cold Calls tab, click any prospect. Verify:

1. Callback section renders between "Script Label" and "Notes".
2. Clicking "In 1h" fills the datetime picker with a time ~1 hour from now, rounded to 5 min.
3. Typing in the picker updates local state without errors.
4. Clicking Save persists — reopen the same prospect, callback time is preserved.
5. Clicking "Clear" blanks both fields. Save → both are `null` in the DB (confirm with `curl http://localhost:8000/cold-calls/<id>`).
6. Dark mode check: no white backgrounds; picker, presets, notes input all match surrounding fields.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/outreach/CallProspectDetailModal.tsx
git commit -m "feat(cold-calls): add Callback section to prospect detail modal"
```

---

## Task 8: Add `orange` accent + make stats bar accept variable stat counts

**Files:**
- Modify: `frontend/src/lib/outreachStyles.ts` (lines 86-105)
- Modify: `frontend/src/components/outreach/HubStatsBar.tsx` (lines 28-29)

The existing `HubStatsBar` uses a hard-coded `grid-cols-4`. Cold Calls needs 5 columns.

- [ ] **Step 1: Extend `StatAccent` with `orange`**

In `frontend/src/lib/outreachStyles.ts`, replace the `StatAccent` type (lines 86-94):

```typescript
export type StatAccent =
  | 'blue'
  | 'amber'
  | 'orange'
  | 'green'
  | 'emerald'
  | 'red'
  | 'rose'
  | 'purple'
  | 'stone';
```

And the `statCardAccents` map (lines 96-105):

```typescript
export const statCardAccents: Record<StatAccent, string> = {
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  orange: 'text-orange-400',
  green: 'text-green-400',
  emerald: 'text-emerald-400',
  red: 'text-red-400',
  rose: 'text-rose-400',
  purple: 'text-purple-400',
  stone: 'text-stone-500',
};
```

Orange is a documented Outreach Hub exception (per MASTER.md §13 + CLAUDE.md) — the rationale is the same here: it must read as distinct from `amber` when the two sit next to each other in the stats bar (Attempted is amber, Callbacks Due is orange).

- [ ] **Step 2: Make `HubStatsBar` grid length-aware**

In `frontend/src/components/outreach/HubStatsBar.tsx`, replace the `return` body (line 28 onward). New full file contents:

```tsx
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  statCardClasses,
  statCardLabelClasses,
  statCardValueClasses,
  statCardAccents,
  type StatAccent,
} from '@/lib/outreachStyles';

export interface HubStat {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent: StatAccent;
  active?: boolean;
  onClick?: () => void;
}

interface HubStatsBarProps {
  stats: HubStat[];
}

// Tailwind JIT can't compile dynamic class names like `grid-cols-${n}` —
// enumerate the handful of sizes Outreach Hub actually uses.
const GRID_COLS: Record<number, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

/**
 * Canonical stats bar used across Outreach Hub tabs. Accepts 3-6 cards;
 * card count determines grid width. Cards can be interactive when `onClick`
 * is set — an `active` boolean applies a ring accent to signal "filter on".
 */
export default function HubStatsBar({ stats }: HubStatsBarProps) {
  const gridClass = GRID_COLS[stats.length] ?? 'grid-cols-4';
  return (
    <div className={cn('grid gap-4', gridClass)}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        const accentClass = statCardAccents[stat.accent];
        const isButton = Boolean(stat.onClick);
        const className = cn(
          statCardClasses,
          isButton && 'cursor-pointer hover:bg-stone-800/60 transition-colors',
          stat.active && 'ring-2 ring-[--exec-accent]/40',
        );
        const content = (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-4 h-4', accentClass)} />
              <span className={statCardLabelClasses}>{stat.label}</span>
            </div>
            <p className={cn(statCardValueClasses, accentClass)}>{stat.value}</p>
          </>
        );
        if (isButton) {
          return (
            <button
              key={stat.label}
              type="button"
              onClick={stat.onClick}
              className={cn(className, 'text-left')}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={stat.label} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify non-Cold-Calls tabs still render correctly**

Start the frontend dev server. Visit the Outreach Hub and click through WarmLeads, LinkedInCampaigns, MultiTouchCampaigns tabs. Each still uses 4 stats — layout should be unchanged. Dark mode check: the stats row looks identical to before for these tabs.

- [ ] **Step 4: Verify type-check passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/outreachStyles.ts frontend/src/components/outreach/HubStatsBar.tsx
git commit -m "feat(outreach): support variable stat count + clickable stats in HubStatsBar"
```

---

## Task 9: Render callback pill on prospect card

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Extend imports**

Update the lucide-react import block (lines 10-30) to add `PhoneCall`:

```typescript
import {
  Upload,
  Plus,
  Circle,
  PhoneOutgoing,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Linkedin,
  Globe,
  MessageCircle,
  Heart,
  Reply,
  Video,
  Pencil,
  Trash2,
  Tag,
  X,
  Check,
} from 'lucide-react';
```

After the existing `@/lib/...` imports (around line 53), add:

```typescript
import {
  callbackTier,
  formatCallbackLabel,
  isDueByEndOfToday,
} from '@/lib/callbackFormat';
import { useCurrentMinute } from '@/hooks/useCurrentMinute';
```

- [ ] **Step 2: Add pill color tokens (module-scope constant)**

Right below `CHANNEL_COUNT_BADGE` (around line 117), add:

```typescript
const CALLBACK_PILL_TOKENS: Record<
  ReturnType<typeof callbackTier>,
  string
> = {
  overdue:
    'bg-red-500/20 text-red-400 animate-pulse',
  soon: 'bg-orange-500/20 text-orange-400',
  today: 'bg-amber-500/20 text-amber-400',
  tomorrow: 'bg-blue-500/20 text-blue-400',
  thisweek: 'bg-stone-500/20 text-stone-300',
  future: 'bg-stone-500/20 text-stone-300',
};
```

- [ ] **Step 3: Add the `CallbackPill` subcomponent**

Right above the `interface CallProspectCardProps` (around line 170), insert:

```typescript
interface CallbackPillProps {
  callbackAt: string;
  now: Date;
}

function CallbackPill({ callbackAt, now }: CallbackPillProps) {
  const at = new Date(callbackAt);
  const tier = callbackTier(at, now);
  const tokens = CALLBACK_PILL_TOKENS[tier];
  const label = formatCallbackLabel(at, now);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md mb-1',
        tokens,
      )}
      title={at.toLocaleString()}
    >
      <PhoneCall className="w-3 h-3" />
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Wire the pill into `CallProspectCard`**

Extend the `CallProspectCardProps` interface (lines 170-177) to accept `now`:

```typescript
interface CallProspectCardProps {
  prospect: CallProspect;
  index: number;
  onClick: (prospect: CallProspect) => void;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  hasAnySelection: boolean;
  now: Date;
}
```

Update the destructure in the function signature (line 179):

```typescript
function CallProspectCard({ prospect, index, onClick, isSelected, onToggleSelect, hasAnySelection, now }: CallProspectCardProps) {
```

Inside the card JSX, insert the pill immediately **after the phone number button** and **before the `dedupedAdditional` block**. The phone button closes around line 287 with its `</button>`. Right after that `</button>` insert:

```tsx
            {prospect.callback_at && (
              <div className="mb-1">
                <CallbackPill callbackAt={prospect.callback_at} now={now} />
              </div>
            )}
```

- [ ] **Step 5: Pass `now` through `Column` and `StepColumn`**

Extend `ColumnProps` (lines 476-482) to include `now: Date;`:

```typescript
interface ColumnProps {
  column: ColumnConfig;
  prospects: CallProspect[];
  onCardClick: (prospect: CallProspect) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  now: Date;
}
```

Update the `Column` function signature (line 484):

```typescript
function Column({ column, prospects, onCardClick, selectedIds, onToggleSelect, now }: ColumnProps) {
```

Pass `now` to each rendered `CallProspectCard` inside `Column` (around line 524):

```tsx
              <CallProspectCard
                key={prospect.id}
                prospect={prospect}
                index={index}
                onClick={onCardClick}
                isSelected={selectedIds.has(prospect.id)}
                onToggleSelect={onToggleSelect}
                hasAnySelection={selectedIds.size > 0}
                now={now}
              />
```

Repeat the same three changes for `StepColumnProps` (lines 379-385), the `StepColumn` destructure (line 387), and the `<CallProspectCard>` render inside `StepColumn` (around line 453). Each map call site gets a `now={now}` prop.

- [ ] **Step 6: Feed `now` from the page-level component**

In the top of `ColdCallsTab` (right below the existing `queryClient` declaration on line 548), call the hook:

```typescript
  const now = useCurrentMinute();
```

At the render sites for `Column` and `StepColumn` (lines 870-890), add `now={now}` to each component invocation:

```tsx
              {isStepView
                ? stepColumns.map((step) => (
                    <StepColumn
                      key={step.step_number}
                      step={step}
                      prospects={prospectsByStep[step.step_number] ?? []}
                      onCardClick={setSelectedProspect}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      now={now}
                    />
                  ))
                : COLUMNS.map((col) => (
                    <Column
                      key={col.status}
                      column={col}
                      prospects={prospectsByStatus[col.status]}
                      onCardClick={setSelectedProspect}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      now={now}
                    />
                  ))}
```

- [ ] **Step 7: Type-check + manual verification**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

Manual check (dev server): open a prospect, set Callback to:
- 30 min from now → Save → card shows orange `Due in 30m` pill (pulses? no — only overdue pulses).
- 15 min ago → Save → card shows red pulsing `Overdue · H:MM AM` pill.
- Next Monday 10am → Save → card shows muted stone `Mon 10:00 AM` pill.
- Clear + Save → pill disappears from card.

Dark mode check: all pill variants readable; no white backgrounds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): render callback pill on prospect cards"
```

---

## Task 10: Add "Callbacks Due" stat + kanban filter

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Add filter state**

In `ColdCallsTab` (below the existing `useState` for `isLabelPopoverOpen`, around line 558), add:

```typescript
  const [callbackFilterActive, setCallbackFilterActive] = useState(false);
```

- [ ] **Step 2: Update `isDueByEndOfToday` consumption**

`isDueByEndOfToday` is already imported (Task 9 step 1). Compute the due count and filtered prospect set via memos.

After the existing `prospectsByStatus` memo (around line 757), add:

```typescript
  const dueCount = useMemo(() => {
    let count = 0;
    for (const p of prospects) {
      if (p.callback_at && isDueByEndOfToday(new Date(p.callback_at), now)) {
        count += 1;
      }
    }
    return count;
  }, [prospects, now]);
```

- [ ] **Step 3: Apply filter + sort to the existing bucketing memos**

Replace the existing `prospectsByStatus` memo (lines 744-757) with:

```typescript
  const visibleProspects = useMemo(() => {
    if (!callbackFilterActive) return prospects;
    return prospects.filter(
      (p) => p.callback_at && isDueByEndOfToday(new Date(p.callback_at), now),
    );
  }, [prospects, callbackFilterActive, now]);

  const sortByCallbackAsc = (a: CallProspect, b: CallProspect): number => {
    // Only called in filtered view, where both have callback_at.
    const av = a.callback_at ? new Date(a.callback_at).getTime() : Infinity;
    const bv = b.callback_at ? new Date(b.callback_at).getTime() : Infinity;
    return av - bv;
  };

  const prospectsByStatus = useMemo(() => {
    const map: Record<CallStatus, CallProspect[]> = {
      [CallStatus.NEW]: [],
      [CallStatus.ATTEMPTED]: [],
      [CallStatus.CONNECTED]: [],
      [CallStatus.DEAD]: [],
    };
    for (const p of visibleProspects) {
      if (map[p.status]) {
        map[p.status].push(p);
      }
    }
    if (callbackFilterActive) {
      for (const s of Object.keys(map) as CallStatus[]) {
        map[s].sort(sortByCallbackAsc);
      }
    }
    return map;
  }, [visibleProspects, callbackFilterActive]);
```

Replace the existing `prospectsByStep` memo (lines 767-781) with:

```typescript
  const prospectsByStep = useMemo(() => {
    const map: Record<number, CallProspect[]> = {};
    for (const s of stepColumns) map[s.step_number] = [];
    if (stepColumns.length === 0) return map;
    for (const p of visibleProspects) {
      const step = p.current_step ?? 1;
      if (map[step] !== undefined) {
        map[step].push(p);
      } else {
        // Out-of-range step: bucket into the first column rather than dropping.
        map[stepColumns[0].step_number].push(p);
      }
    }
    if (callbackFilterActive) {
      for (const k of Object.keys(map)) {
        map[Number(k)].sort(sortByCallbackAsc);
      }
    }
    return map;
  }, [visibleProspects, stepColumns, callbackFilterActive]);
```

- [ ] **Step 4: Add the "Callbacks Due" stat with click toggle**

Replace the existing `stats: HubStat[]` definition (lines 783-808) with:

```typescript
  const stats: HubStat[] = [
    {
      icon: Circle,
      label: 'New',
      value: prospectsByStatus[CallStatus.NEW].length,
      accent: 'blue',
    },
    {
      icon: PhoneOutgoing,
      label: 'Attempted',
      value: prospectsByStatus[CallStatus.ATTEMPTED].length,
      accent: 'amber',
    },
    {
      icon: CheckCircle2,
      label: 'Connected',
      value: prospectsByStatus[CallStatus.CONNECTED].length,
      accent: 'emerald',
    },
    {
      icon: XCircle,
      label: 'Dead',
      value: prospectsByStatus[CallStatus.DEAD].length,
      accent: 'rose',
    },
    {
      icon: PhoneCall,
      label: 'Callbacks Due',
      value: dueCount,
      accent: 'orange',
      active: callbackFilterActive,
      onClick: () => setCallbackFilterActive((v) => !v),
    },
  ];
```

Note: when the filter is active, the per-column Status counts (`New`, `Attempted`, etc.) reflect the **filtered** subset — this is intentional, because the kanban itself is filtered, so the counts should match the visible state.

- [ ] **Step 5: Manual verification**

With the dev server running:

1. Create one prospect with callback 30 min ago, one 2 hours ahead, one tomorrow.
2. Stats bar shows `Callbacks Due: 2` (overdue + later-today, tomorrow excluded).
3. Click the stat → kanban filters to 2 cards total, each card pill visible, overdue one first (ascending sort).
4. All four status columns still render, even if some are empty.
5. The "Callbacks Due" card shows a ring accent while active.
6. Click again → filter clears, all prospects visible again.
7. Bulk-select (checkbox) still works while filter is active.
8. Dark mode check: filter on/off states both look correct.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): add Callbacks Due stat + kanban filter"
```

---

## Task 11: Final end-to-end smoke test

- [ ] **Step 1: Full-flow sanity run**

Backend + frontend dev servers running.

1. Open Cold Calls tab, pick any prospect, click → detail modal opens.
2. Click `Tomorrow 10am` preset → datetime picker populates.
3. Type "owner back" into callback note.
4. Click Save → toast "Prospect saved", modal closes.
5. Card now shows `Tomorrow 10:00 AM` blue pill under the phone number.
6. Reopen the prospect — callback fields round-trip correctly.
7. Edit callback to be 15 min from now → Save → pill flips to `Due in 15m` orange.
8. Wait ~16 min (or manually adjust system clock for testing), reload — pill flips to overdue red + pulse.
9. Stats bar `Callbacks Due` increments.
10. Click the stat → kanban filters. Click again → unfilters.
11. In the detail modal, Clear → Save → pill disappears from card.
12. Dark mode check across all of the above.

- [ ] **Step 2: Type-check + build**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Backend round-trip check**

```bash
curl -s http://localhost:8000/cold-calls/ | python -m json.tool | head -80
```

Expected: each prospect object exposes `callback_at` and `callback_notes`, with values reflecting recent edits.

- [ ] **Step 4: Final commit (if any touch-ups were needed)**

If any fixes came out of the smoke test, commit them with an appropriate message. If the smoke test passed clean, no commit is needed — proceed to branch finishing.

---

## Out of scope (explicit)

- Browser notifications, email/SMS reminders.
- Multiple callbacks or recurring callbacks per prospect.
- Auto-moving the card between status columns when a callback is set.
- Calendar integration.
- Bulk callback setting (via floating action bar).
- Moving the callback state into URL query params for deep linking.

Each of these is a sensible follow-up but would expand scope meaningfully. Ship the minimal version first; revisit only if pain is real.
