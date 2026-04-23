# Cold-Call Follow-up Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a date-only "follow-up" reminder to cold-call prospects that is independent of the existing time-of-day "callback" reminder. Surfaces as a card pill, a stats-bar count, and a kanban filter — mirroring the callback feature's UX so users get one consistent mental model with two distinct reminder types.

**Architecture:** Two new nullable columns on `call_prospects` (`follow_up_on: Date`, `follow_up_notes: String(255)`), a parallel `followUpFormat.ts` pure-util module, a new `FollowUpPill` rendered below the existing `CallbackPill` on prospect cards, and a new `Follow-ups Due` stat that toggles a follow-up filter alongside the existing callback filter (both filters compose with OR semantics).

**Tech Stack:** FastAPI + SQLAlchemy + SQLite (Alembic), React 18 + TypeScript + TailwindCSS, TanStack Query, `date-fns`, `lucide-react`.

**Reference spec:** `docs/superpowers/specs/2026-04-23-cold-call-follow-up-tracking-design.md`

**Reference implementation:** the existing callback-tracking feature is the structural twin — see commits `35dbfe5..a86a69e` and `frontend/src/lib/callbackFormat.ts`. Each task below mirrors the corresponding callback commit but adapted for date-only semantics.

**Project conventions** (from `MEMORY.md` and `CLAUDE.md`):
- **Local DB == production DB.** The local backend connects to the Render PostgreSQL. Do **not** run the local backend against this DB to "test" — any write hits real production data. Verification is read-only DB inspection or browser UI navigation only.
- **Alembic autogenerate is booby-trapped.** Always hand-write the migration file. Do **not** run `alembic revision --autogenerate`.
- **Outreach Hub: no `dark:` prefixes.** This component tree is forced-dark via `ThemeProvider`; only single-mode classes.
- **No icons on primary buttons** (text-only); the `Bell` icon used here is on a stats card and a small pill — not a primary button — so it's fine.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `backend/app/models/call_prospect.py` | modify | Add 2 columns + index, adjacent to existing `callback_at` block. |
| `backend/alembic/versions/follow_up_2026_04_23_add_follow_up_to_call_prospects.py` | **new** | Hand-written migration: 2 columns + 1 index. |
| `backend/app/schemas/call_prospect.py` | modify | Add fields to `CallProspectBase` and `CallProspectUpdate`. |
| `frontend/src/types/index.ts` | modify | Add fields to `CallProspect`, `CallProspectCreate`, `CallProspectUpdate`. |
| `frontend/src/lib/followUpFormat.ts` | **new** | Pure helpers: `followUpTier`, `formatFollowUpLabel`, `isFollowUpDueByEndOfToday`, `presetTomorrow`, `presetInThreeDays`, `presetNextMonday`, `presetInTwoWeeks`, `toLocalDateInputValue`, `fromLocalDateInputValue`, `parseBackendDate`. |
| `frontend/src/components/outreach/CallProspectDetailModal.tsx` | modify | Add Follow-up section directly below Callback section. Wire into existing `updateMutation`. |
| `frontend/src/components/outreach/ColdCallsTab.tsx` | modify | Add `FollowUpPill` subcomponent, render below `CallbackPill` on the card, add `followUpDueCount` memo, `followUpFilterActive` state, extend `visibleProspects` to OR-compose with callback filter, add `Bell` stat. |

**No test files** — this project does not have a configured frontend test framework (no Vitest, no Jest config) and no backend pytest tests for callable units. The callback feature shipped without tests and verified via browser UI navigation. Mirror that workflow.

---

## Task 1: Add `follow_up_on` + `follow_up_notes` columns to model

**Files:**
- Modify: `backend/app/models/call_prospect.py`

- [ ] **Step 1: Add the two columns to the `CallProspect` SQLAlchemy class**

Open `backend/app/models/call_prospect.py`. Find the existing block (lines ~67-73):

```python
    # Scheduled callback time captured when the prospect says "call me back at X".
    # Stored in UTC; frontend converts to browser local for display + input.
    # NULL = no callback scheduled. Orthogonal to `status` — setting this does
    # not move the prospect between kanban columns.
    callback_at = Column(DateTime, nullable=True, index=True)
    # Optional short context for the callback (e.g. "owner back from holiday").
    callback_notes = Column(String(255), nullable=True)
```

Add immediately after `callback_notes`, before the `status` column:

```python
    # Date-only follow-up reminder for the next non-call touch in the multi-step
    # sequence (SMS, email, etc.). Distinct from `callback_at` — that captures
    # an appointment time the prospect requested; this captures the user's own
    # "circle back on this date" reminder. Calendar-day granularity, no time-of-day,
    # no timezone conversion. NULL = no follow-up scheduled. Orthogonal to `status`.
    follow_up_on = Column(Date, nullable=True, index=True)
    # Optional short context (e.g. "send proposal", "check IG").
    follow_up_notes = Column(String(255), nullable=True)
```

- [ ] **Step 2: Add `Date` to the SQLAlchemy import line**

Find the import at the top of the file:

```python
from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
```

Replace with:

```python
from sqlalchemy import JSON, Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
```

(`Date` inserted in alphabetical order after `Column`.)

- [ ] **Step 3: Verify the model imports parse**

Run: `cd backend && venv/Scripts/python -c "from app.models.call_prospect import CallProspect; print(CallProspect.__table__.columns['follow_up_on'].type)"`

Expected output:
```
DATE
```

(If this errors with `ModuleNotFoundError`, run `cd backend && venv/Scripts/activate && python -c "..."` in a fresh shell.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/call_prospect.py
git commit -m "feat(cold-calls): add follow_up_on and follow_up_notes to CallProspect model"
```

---

## Task 2: Hand-written Alembic migration

**Files:**
- Create: `backend/alembic/versions/follow_up_2026_04_23_add_follow_up_to_call_prospects.py`

- [ ] **Step 1: Create the migration file**

Create `backend/alembic/versions/follow_up_2026_04_23_add_follow_up_to_call_prospects.py` with these exact contents:

```python
"""add follow_up fields to call_prospects

Adds follow_up_on (nullable Date) and follow_up_notes (nullable String(255))
for the Cold Calls follow-up tracking feature. Date-only semantics — distinct
from callback_at which is a DateTime. Includes an index on follow_up_on to
keep the "Follow-ups Due" count + kanban filter cheap.

Revision ID: follow_up_2026_04_23
Revises: tier_2026_04_22
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "follow_up_2026_04_23"
down_revision: Union[str, None] = "tier_2026_04_22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'call_prospects',
        sa.Column('follow_up_on', sa.Date(), nullable=True),
    )
    op.add_column(
        'call_prospects',
        sa.Column('follow_up_notes', sa.String(length=255), nullable=True),
    )
    op.create_index(
        'ix_call_prospects_follow_up_on',
        'call_prospects',
        ['follow_up_on'],
        unique=False,
    )


def downgrade() -> None:
    with op.batch_alter_table('call_prospects', schema=None) as batch_op:
        batch_op.drop_index('ix_call_prospects_follow_up_on')
        batch_op.drop_column('follow_up_notes')
        batch_op.drop_column('follow_up_on')
```

- [ ] **Step 2: Verify the alembic graph picks it up**

Run: `cd backend && venv/Scripts/alembic heads`

Expected output (the new revision should be the head):
```
follow_up_2026_04_23 (head)
```

If output shows multiple heads or `tier_2026_04_22` still as head, the `down_revision` chain is broken — re-check Step 1.

- [ ] **Step 3: Apply the migration to the live (production) DB**

⚠️ **This writes to production.** This is intentional and documented — local backend connects to Render PostgreSQL. The change is additive (two nullable columns + index). Roll-forward only.

Run: `cd backend && venv/Scripts/alembic upgrade head`

Expected output (one of):
```
INFO  [alembic.runtime.migration] Running upgrade tier_2026_04_22 -> follow_up_2026_04_23, add follow_up fields to call_prospects
```

- [ ] **Step 4: Verify the columns exist in the live DB**

Run: `cd backend && venv/Scripts/python -c "from app.database import engine; from sqlalchemy import inspect; cols = {c['name']: str(c['type']) for c in inspect(engine).get_columns('call_prospects')}; print('follow_up_on:', cols.get('follow_up_on')); print('follow_up_notes:', cols.get('follow_up_notes'))"`

Expected:
```
follow_up_on: DATE
follow_up_notes: VARCHAR(255)
```

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/follow_up_2026_04_23_add_follow_up_to_call_prospects.py
git commit -m "feat(cold-calls): migration for follow_up_on and follow_up_notes columns"
```

---

## Task 3: Expose follow-up fields in Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/call_prospect.py`

- [ ] **Step 1: Add `date` to the datetime import**

Find at the top of `backend/app/schemas/call_prospect.py`:

```python
from datetime import datetime
```

Replace with:

```python
from datetime import date, datetime
```

- [ ] **Step 2: Add the two fields to `CallProspectBase`**

Find in `CallProspectBase` (around lines 49-50):

```python
    callback_at: Optional[datetime] = None
    callback_notes: Optional[str] = Field(None, max_length=255)
```

Add immediately after `callback_notes`, before `tier`:

```python
    follow_up_on: Optional[date] = None
    follow_up_notes: Optional[str] = Field(None, max_length=255)
```

- [ ] **Step 3: Add the same two fields to `CallProspectUpdate`**

Find in `CallProspectUpdate` (around lines 82-83):

```python
    callback_at: Optional[datetime] = None
    callback_notes: Optional[str] = Field(None, max_length=255)
```

Add immediately after `callback_notes`, before `tier`:

```python
    follow_up_on: Optional[date] = None
    follow_up_notes: Optional[str] = Field(None, max_length=255)
```

(`CallProspectResponse` inherits from `CallProspectBase`, so it picks up the new fields automatically. `CallProspectCreate` also inherits from `CallProspectBase` — no explicit edit needed there.)

- [ ] **Step 4: Verify Pydantic accepts the new fields**

Run: `cd backend && venv/Scripts/python -c "from app.schemas.call_prospect import CallProspectUpdate; from datetime import date; u = CallProspectUpdate(follow_up_on=date(2026, 4, 30), follow_up_notes='send proposal'); print(u.model_dump_json())"`

Expected output (exact JSON):
```
{"business_name":null,"first_name":null,"last_name":null,"position":null,"email":null,"linkedin_url":null,"phone":null,"additional_phones":null,"vertical":null,"address":null,"facebook_url":null,"website":null,"source":null,"rating":null,"reviews_count":null,"google_maps_url":null,"working_hours":null,"description":null,"notes":null,"script_label":null,"status":null,"campaign_id":null,"current_step":null,"callback_at":null,"callback_notes":null,"follow_up_on":"2026-04-30","follow_up_notes":"send proposal","tier":null}
```

The key thing to check: `"follow_up_on":"2026-04-30"` (ISO date string, no time component). If you see `"2026-04-30T00:00:00"`, you used `datetime` instead of `date` — fix.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/call_prospect.py
git commit -m "feat(cold-calls): expose follow-up fields in CallProspect schemas"
```

---

## Task 4: Add follow-up fields to frontend `CallProspect` types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add fields to the `CallProspect` interface**

Find in `frontend/src/types/index.ts` (around lines 1689-1691):

```typescript
  tier: ProspectTier | null;
  callback_at: string | null;
  callback_notes: string | null;
```

Add immediately after `callback_notes`:

```typescript
  follow_up_on: string | null;
  follow_up_notes: string | null;
```

(Final order in `CallProspect`: `tier`, `callback_at`, `callback_notes`, `follow_up_on`, `follow_up_notes`. Keep alphabetical inside each pair.)

- [ ] **Step 2: Add fields to the `CallProspectCreate` interface**

Find in `CallProspectCreate` (around lines 1718-1719):

```typescript
  callback_at?: string | null;
  callback_notes?: string | null;
```

Add immediately after:

```typescript
  follow_up_on?: string | null;
  follow_up_notes?: string | null;
```

- [ ] **Step 3: Add fields to the `CallProspectUpdate` interface**

Find in `CallProspectUpdate` (around lines 1746-1747):

```typescript
  callback_at?: string | null;
  callback_notes?: string | null;
```

Add immediately after:

```typescript
  follow_up_on?: string | null;
  follow_up_notes?: string | null;
```

- [ ] **Step 4: Run type-check**

Run: `cd frontend && npm run type-check`

Expected: exits cleanly (no errors). If errors mention `follow_up_on` they're in consumer code that hasn't been touched yet — acceptable; later tasks will introduce the consumers.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(cold-calls): add follow-up fields to CallProspect types"
```

---

## Task 5: Create `followUpFormat.ts` pure-util module

**Files:**
- Create: `frontend/src/lib/followUpFormat.ts`

- [ ] **Step 1: Create the file**

Create `frontend/src/lib/followUpFormat.ts` with these exact contents:

```typescript
import { differenceInCalendarDays, format, isSameDay } from 'date-fns';

/**
 * Urgency tier for a scheduled follow-up. Drives the pill color in the card
 * and the sort order in the "Follow-ups Due" filter (overdue first).
 *
 * Date-only semantics — there is no "soon" tier (no time-of-day to count down to).
 */
export type FollowUpTier =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'thisweek'   // 2..7 calendar days from today
  | 'future';    // > 7 calendar days

export function followUpTier(on: Date, today: Date): FollowUpTier {
  if (isSameDay(on, today)) return 'today';
  const days = differenceInCalendarDays(on, today);
  if (days < 0) return 'overdue';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'thisweek';
  return 'future';
}

/**
 * Smart relative label for a follow-up pill.
 *
 * overdue  → "Overdue · Apr 22"
 * today    → "Today"
 * tomorrow → "Tomorrow"
 * thisweek → "Wed"
 * future   → "Apr 30"
 */
export function formatFollowUpLabel(on: Date, today: Date): string {
  const tier = followUpTier(on, today);
  switch (tier) {
    case 'overdue':
      return `Overdue · ${format(on, 'MMM d')}`;
    case 'today':
      return 'Today';
    case 'tomorrow':
      return 'Tomorrow';
    case 'thisweek':
      return format(on, 'EEE');
    case 'future':
      return format(on, 'MMM d');
  }
}

/**
 * True when a scheduled follow-up should count toward "Follow-ups Due" —
 * i.e. on or before today (calendar-day comparison, browser-local).
 * Used by both the stats bar count AND the filter predicate so they stay in sync.
 */
export function isFollowUpDueByEndOfToday(on: Date, today: Date): boolean {
  return differenceInCalendarDays(on, today) <= 0;
}

/**
 * Quick-preset values for the modal follow-up picker. All preset helpers
 * return a Date pinned to local-midnight (time component zeroed).
 */
export function presetTomorrow(today: Date): Date {
  const d = startOfLocalDay(today);
  d.setDate(d.getDate() + 1);
  return d;
}

export function presetInThreeDays(today: Date): Date {
  const d = startOfLocalDay(today);
  d.setDate(d.getDate() + 3);
  return d;
}

export function presetNextMonday(today: Date): Date {
  const d = startOfLocalDay(today);
  // getDay(): 0=Sun..6=Sat. Days until next Monday — always at least 1 day
  // ahead even if today is Monday (matches presetNextMondayTenAm in callbackFormat).
  const daysAhead = ((1 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + daysAhead);
  return d;
}

export function presetInTwoWeeks(today: Date): Date {
  const d = startOfLocalDay(today);
  d.setDate(d.getDate() + 14);
  return d;
}

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * `<input type="date">` needs a string in `YYYY-MM-DD` representing local
 * calendar date. Returns empty string for null.
 */
export function toLocalDateInputValue(on: Date | null): string {
  if (!on) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${on.getFullYear()}-${pad(on.getMonth() + 1)}-${pad(on.getDate())}`;
}

/**
 * Parse a `<input type="date">` value back into a local-midnight Date.
 * Returns null for empty/invalid input.
 *
 * Note: `new Date("2026-04-30")` parses as UTC-midnight, which can render
 * as the previous day in negative-UTC timezones. Splitting and using the
 * Date(y, m-1, d) constructor pins to local-midnight reliably.
 */
export function fromLocalDateInputValue(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse an ISO date string coming from the backend (e.g. `"2026-04-30"`).
 *
 * The backend stores `follow_up_on` as a Date column and Pydantic serializes
 * it as `"YYYY-MM-DD"`. We construct a local-midnight Date so calendar-day
 * comparisons against `new Date()` ("today") behave consistently in any
 * timezone. This is the date-only counterpart to `parseBackendDatetime` in
 * callbackFormat.ts (which had to deal with naive UTC datetimes).
 */
export function parseBackendDate(value: string): Date {
  // Reuse the same defensive parse as fromLocalDateInputValue so a stray
  // datetime suffix (e.g. `"2026-04-30T00:00:00"`) still works — split on
  // the first non-digit non-dash character.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
```

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npm run type-check`

Expected: exits cleanly. (`date-fns` is already a project dep — used by `callbackFormat.ts`.)

- [ ] **Step 3: Smoke-test the helpers in the Vite dev server**

Open `frontend/src/lib/followUpFormat.ts` in any temp scratch — the file has no consumers yet, so this step is just a syntax check via the type-check above. Skip if Step 2 passed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/followUpFormat.ts
git commit -m "feat(cold-calls): add follow-up format and preset utilities"
```

---

## Task 6: Add Follow-up section to `CallProspectDetailModal`

**Files:**
- Modify: `frontend/src/components/outreach/CallProspectDetailModal.tsx`

- [ ] **Step 1: Add follow-up imports**

Find the existing import block (around lines 18-26):

```typescript
import {
  fromLocalInputValue,
  parseBackendDatetime,
  presetInOneHour,
  presetInTwoHours,
  presetNextMondayTenAm,
  presetTomorrowTenAm,
  toLocalInputValue,
} from '@/lib/callbackFormat';
```

Add a sibling import block immediately after:

```typescript
import {
  fromLocalDateInputValue,
  parseBackendDate,
  presetInThreeDays,
  presetInTwoWeeks,
  presetNextMonday,
  presetTomorrow,
  toLocalDateInputValue,
} from '@/lib/followUpFormat';
```

- [ ] **Step 2: Add follow-up state hooks alongside callback state**

Find the existing state block (around lines 75-78):

```typescript
  const [callbackInput, setCallbackInput] = useState<string>(() =>
    toLocalInputValue(prospect.callback_at ? parseBackendDatetime(prospect.callback_at) : null),
  );
  const [callbackNotes, setCallbackNotes] = useState(prospect.callback_notes ?? '');
```

Add immediately after `callbackNotes`:

```typescript
  const [followUpInput, setFollowUpInput] = useState<string>(() =>
    toLocalDateInputValue(prospect.follow_up_on ? parseBackendDate(prospect.follow_up_on) : null),
  );
  const [followUpNotes, setFollowUpNotes] = useState(prospect.follow_up_notes ?? '');
```

- [ ] **Step 3: Sync follow-up state when the prospect prop changes**

Find the existing `useEffect` that resets state on prospect change (around lines 88-102):

```typescript
    setCallbackInput(
      toLocalInputValue(prospect.callback_at ? parseBackendDatetime(prospect.callback_at) : null),
    );
    setCallbackNotes(prospect.callback_notes ?? '');
```

Add immediately after `setCallbackNotes(prospect.callback_notes ?? '');`:

```typescript
    setFollowUpInput(
      toLocalDateInputValue(prospect.follow_up_on ? parseBackendDate(prospect.follow_up_on) : null),
    );
    setFollowUpNotes(prospect.follow_up_notes ?? '');
```

Then add the two new prospect fields to the dependency array. The current dep array (around lines 100-102):

```typescript
    prospect.callback_at,
    prospect.callback_notes,
  ]);
```

Replace with:

```typescript
    prospect.callback_at,
    prospect.callback_notes,
    prospect.follow_up_on,
    prospect.follow_up_notes,
  ]);
```

- [ ] **Step 4: Persist follow-up fields in the save mutation**

Find the existing `updateMutation` (around lines 114-125):

```typescript
  const updateMutation = useMutation({
    mutationFn: () => {
      const callbackDate = fromLocalInputValue(callbackInput);
      return coldCallsApi.update(prospect.id, {
        notes: notes.trim() ? notes : null,
        status,
        script_label: scriptLabel.trim() || null,
        tier,
        callback_at: callbackDate ? callbackDate.toISOString() : null,
        callback_notes: callbackNotes.trim() || null,
      });
    },
```

Replace with:

```typescript
  const updateMutation = useMutation({
    mutationFn: () => {
      const callbackDate = fromLocalInputValue(callbackInput);
      const followUpDate = fromLocalDateInputValue(followUpInput);
      return coldCallsApi.update(prospect.id, {
        notes: notes.trim() ? notes : null,
        status,
        script_label: scriptLabel.trim() || null,
        tier,
        callback_at: callbackDate ? callbackDate.toISOString() : null,
        callback_notes: callbackNotes.trim() || null,
        follow_up_on: followUpDate ? toLocalDateInputValue(followUpDate) : null,
        follow_up_notes: followUpNotes.trim() || null,
      });
    },
```

(`toLocalDateInputValue` produces the `"YYYY-MM-DD"` string the backend Pydantic `date` schema expects.)

- [ ] **Step 5: Add follow-up preset + clear handlers**

Find the existing handlers (around lines 158-165):

```typescript
  const applyPreset = (preset: (now: Date) => Date) => {
    setCallbackInput(toLocalInputValue(preset(new Date())));
  };

  const clearCallback = () => {
    setCallbackInput('');
    setCallbackNotes('');
  };
```

Add immediately after `clearCallback`:

```typescript
  const applyFollowUpPreset = (preset: (today: Date) => Date) => {
    setFollowUpInput(toLocalDateInputValue(preset(new Date())));
  };

  const clearFollowUp = () => {
    setFollowUpInput('');
    setFollowUpNotes('');
  };
```

- [ ] **Step 6: Add the Follow-up section to the modal's JSX**

Find the existing Callback section (around lines 395-442) — the closing `</div>` is the line just before the `{/* Notes textarea with timestamp button */}` comment.

Insert the following JSX **immediately after** that closing `</div>` of the Callback section, **before** the `{/* Notes textarea with timestamp button */}` comment:

```tsx
            {/* Follow-up — date picker + quick presets + optional note */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Follow-up
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  className={cn(inputClasses, 'flex-1')}
                />
                {followUpInput && (
                  <button
                    type="button"
                    onClick={clearFollowUp}
                    className="px-3 py-2 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: 'Tomorrow', fn: presetTomorrow },
                  { label: 'In 3 days', fn: presetInThreeDays },
                  { label: 'Next Mon', fn: presetNextMonday },
                  { label: 'In 2 weeks', fn: presetInTwoWeeks },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyFollowUpPreset(p.fn)}
                    className="px-2.5 py-1 text-[11px] font-medium text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50 rounded-lg transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                maxLength={255}
                placeholder="Follow-up note (optional) — e.g. send proposal, check IG"
                className={cn(inputClasses, 'mt-2')}
              />
            </div>
```

- [ ] **Step 7: Run type-check + dev build sanity**

Run: `cd frontend && npm run type-check`

Expected: exits cleanly.

If you have a dev server already running (the user may have one), no restart is needed — Vite HMR picks up the change. Don't start a new dev server in the plan.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/outreach/CallProspectDetailModal.tsx
git commit -m "feat(cold-calls): add Follow-up section to prospect detail modal"
```

---

## Task 7: Render follow-up pill on prospect cards

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Add `Bell` to the lucide-react imports**

Find the existing lucide-react import block in `ColdCallsTab.tsx` (search for `from 'lucide-react'`). Add `Bell` to the alphabetically-sorted import list.

For example, if the current line is:

```typescript
import { Phone, PhoneCall, PhoneOutgoing, Plus, ... } from 'lucide-react';
```

Add `Bell`:

```typescript
import { Bell, Phone, PhoneCall, PhoneOutgoing, Plus, ... } from 'lucide-react';
```

(Use whatever spread structure already exists — preserve existing line breaks and ordering.)

- [ ] **Step 2: Add follow-up format imports**

Find the existing callback-format import (around lines 56-65):

```typescript
import {
  callbackTier,
  formatCallbackLabel,
  isDueByEndOfToday,
  parseBackendDatetime,
} from '@/lib/callbackFormat';
```

Add a sibling import immediately after:

```typescript
import {
  followUpTier,
  formatFollowUpLabel,
  isFollowUpDueByEndOfToday,
  parseBackendDate,
} from '@/lib/followUpFormat';
```

- [ ] **Step 3: Add `FOLLOW_UP_PILL_TOKENS` token map**

Find the existing `CALLBACK_PILL_TOKENS` declaration (around lines 133-144):

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

Add immediately after:

```typescript
const FOLLOW_UP_PILL_TOKENS: Record<
  ReturnType<typeof followUpTier>,
  string
> = {
  overdue:
    'bg-red-500/20 text-red-400 animate-pulse',
  today: 'bg-amber-500/20 text-amber-400',
  tomorrow: 'bg-blue-500/20 text-blue-400',
  thisweek: 'bg-stone-500/20 text-stone-300',
  future: 'bg-stone-500/20 text-stone-300',
};
```

(No `soon` key — date-only follow-ups have no sub-day tier.)

- [ ] **Step 4: Add the `FollowUpPill` subcomponent**

Find the existing `CallbackPill` component (around lines 197-219):

```typescript
interface CallbackPillProps {
  callbackAt: string;
  now: Date;
}

function CallbackPill({ callbackAt, now }: CallbackPillProps) {
  const at = parseBackendDatetime(callbackAt);
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

Add immediately after:

```typescript
interface FollowUpPillProps {
  followUpOn: string;
  today: Date;
}

function FollowUpPill({ followUpOn, today }: FollowUpPillProps) {
  const on = parseBackendDate(followUpOn);
  const tier = followUpTier(on, today);
  const tokens = FOLLOW_UP_PILL_TOKENS[tier];
  const label = formatFollowUpLabel(on, today);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md mb-1',
        tokens,
      )}
      title={on.toLocaleDateString()}
    >
      <Bell className="w-3 h-3" />
      {label}
    </span>
  );
}
```

- [ ] **Step 5: Render the pill on the card**

Find the existing callback pill render in `CallProspectCard` (around lines 358-362):

```tsx
            {prospect.callback_at && (
              <div className="mb-1">
                <CallbackPill callbackAt={prospect.callback_at} now={now} />
              </div>
            )}
```

Replace with:

```tsx
            {prospect.callback_at && (
              <div className="mb-1">
                <CallbackPill callbackAt={prospect.callback_at} now={now} />
              </div>
            )}

            {prospect.follow_up_on && (
              <div className="mb-1">
                <FollowUpPill followUpOn={prospect.follow_up_on} today={now} />
              </div>
            )}
```

(Reuse the existing `now: Date` prop already passed into `CallProspectCard` — `followUpTier` only cares about calendar-day, so the `useCurrentMinute` clock is more than precise enough.)

- [ ] **Step 6: Run type-check**

Run: `cd frontend && npm run type-check`

Expected: exits cleanly.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): render follow-up pill on prospect cards"
```

---

## Task 8: Add "Follow-ups Due" stat + filter to `ColdCallsTab`

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Add follow-up filter state**

Find the existing callback filter state (around line 640):

```typescript
  const [callbackFilterActive, setCallbackFilterActive] = useState(false);
```

Add immediately after:

```typescript
  const [followUpFilterActive, setFollowUpFilterActive] = useState(false);
```

- [ ] **Step 2: Extend `visibleProspects` to OR-compose with the callback filter**

Find the existing `visibleProspects` memo (around lines 887-892):

```typescript
  const visibleProspects = useMemo(() => {
    if (!callbackFilterActive) return prospects;
    return prospects.filter(
      (p) => p.callback_at && isDueByEndOfToday(parseBackendDatetime(p.callback_at), now),
    );
  }, [prospects, callbackFilterActive, now]);
```

Replace with:

```typescript
  const visibleProspects = useMemo(() => {
    if (!callbackFilterActive && !followUpFilterActive) return prospects;
    return prospects.filter((p) => {
      const callbackHit =
        callbackFilterActive &&
        Boolean(p.callback_at) &&
        isDueByEndOfToday(parseBackendDatetime(p.callback_at as string), now);
      const followUpHit =
        followUpFilterActive &&
        Boolean(p.follow_up_on) &&
        isFollowUpDueByEndOfToday(parseBackendDate(p.follow_up_on as string), now);
      return callbackHit || followUpHit;
    });
  }, [prospects, callbackFilterActive, followUpFilterActive, now]);
```

(OR composition: when both filters are on, a prospect appears if either reminder is due — matches the spec's "what do I need to handle today" mental model.)

- [ ] **Step 3: Add `followUpDueCount` memo**

Find the existing `dueCount` memo (around lines 935-943):

```typescript
  const dueCount = useMemo(() => {
    let count = 0;
    for (const p of prospects) {
      if (p.callback_at && isDueByEndOfToday(parseBackendDatetime(p.callback_at), now)) {
        count += 1;
      }
    }
    return count;
  }, [prospects, now]);
```

Add immediately after:

```typescript
  const followUpDueCount = useMemo(() => {
    let count = 0;
    for (const p of prospects) {
      if (p.follow_up_on && isFollowUpDueByEndOfToday(parseBackendDate(p.follow_up_on), now)) {
        count += 1;
      }
    }
    return count;
  }, [prospects, now]);
```

- [ ] **Step 4: Add the `Follow-ups Due` stat to the `stats` array**

Find the existing `Callbacks Due` stat in the `stats: HubStat[]` array (around lines 970-986):

```typescript
    {
      icon: PhoneCall,
      label: 'Callbacks Due',
      value: dueCount,
      accent: 'orange',
      active: callbackFilterActive,
      onClick: () => {
        setCallbackFilterActive((prev) => {
          const next = !prev;
          // Turning ON the filter flips to callback_asc by default so the
          // user sees soonest-due first. Leave the dropdown alone on OFF so
          // the user's last-chosen sort sticks.
          if (next) setSortKey('callback_asc');
          return next;
        });
      },
    },
```

Add immediately after (still inside the `stats` array, before the closing `]`):

```typescript
    {
      icon: Bell,
      label: 'Follow-ups Due',
      value: followUpDueCount,
      accent: 'blue',
      active: followUpFilterActive,
      onClick: () => {
        setFollowUpFilterActive((prev) => !prev);
      },
    },
```

(No `setSortKey` flip — there is no `follow_up_asc` sort key in the existing `SortKey` union, and the spec doesn't require sorting changes when toggling this filter. The user's last-chosen sort key stays put.)

- [ ] **Step 5: Run type-check**

Run: `cd frontend && npm run type-check`

Expected: exits cleanly. If TypeScript complains about `accent: 'blue'` not matching the `HubStat` accent union, peek at the `HubStat` type — `blue` is a known accent (used elsewhere in the same component, around line 950: `{ icon: Circle, label: 'New', ..., accent: 'blue' }`). If for some reason it errors, fall back to whatever accent token the existing 'New' stat uses verbatim.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): add Follow-ups Due stat + kanban filter"
```

---

## Task 9: Manual end-to-end verification

**Files:** none — browser-only verification.

⚠️ **Reminder:** The local backend connects to the production DB. Verification = read-only browsing + creating/clearing follow-ups on a single throwaway prospect. Do not bulk-edit or test destructively.

- [ ] **Step 1: Start the backend and frontend**

Two terminals:

Terminal A:
```bash
cd backend && venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Terminal B:
```bash
cd frontend && npm run dev
```

Expected: backend serves on `http://localhost:8000`, frontend on `http://localhost:5173` (or whatever Vite picks). No startup errors mentioning `follow_up_on`.

- [ ] **Step 2: Open the Outreach Hub → Cold Calls tab**

Browser: `http://localhost:5173/outreach` → click "Cold Calls" tab.

Expected:
- Page renders without console errors.
- Stats bar shows the new **"Follow-ups Due"** stat with `Bell` icon, blue accent, value `0`.
- Existing `Callbacks Due` stat still renders alongside it.

- [ ] **Step 3: Open a prospect detail modal**

Click any prospect card.

Expected:
- The detail modal opens.
- Below the existing **Callback** section, a new **Follow-up** section is visible with:
  - A `<input type="date">` picker
  - Four preset buttons: `Tomorrow`, `In 3 days`, `Next Mon`, `In 2 weeks`
  - A 1-line notes input below the presets

- [ ] **Step 4: Set a follow-up via a preset**

Click `Tomorrow`. Expected: the date picker fills in tomorrow's date (browser-local).

Type a follow-up note: `verify follow-up plumbing`.

Click **Save Changes**.

Expected:
- Toast: "Prospect saved".
- Modal closes.
- The prospect's card now shows a **Follow-up pill** ("Tomorrow" with a `Bell` icon, blue background) directly below any callback pill.
- The "Follow-ups Due" stat updates if the picked date is today or earlier (otherwise `0` — picking "Tomorrow" leaves it at 0).

- [ ] **Step 5: Verify same-day filter behavior**

Re-open the same prospect, change the picker to **today's date** (use the picker directly), Save.

Expected:
- Follow-up pill on the card now reads "Today" with amber background.
- "Follow-ups Due" stat increments to `1`.
- Click the "Follow-ups Due" stat — it gains a `ring-2 ring-blue-500/40` active state and the kanban now shows only that prospect (filter is on).
- Click the stat again — filter clears, all prospects return.

- [ ] **Step 6: Verify callback + follow-up coexist on one card**

In the same prospect's modal, set both:
- Callback: pick `Tomorrow 10am` preset.
- Follow-up: pick `In 3 days`.

Save.

Expected:
- The prospect's card shows **both pills**, callback (Phone icon, "Tomorrow 10:00 AM") above follow-up (Bell icon, in-3-days date).
- Both stats reflect their respective counts independently.

- [ ] **Step 7: Verify OR-composition of both filters**

With one prospect having a callback due today and a different prospect having a follow-up due today, click **both** stats so both filters are active (both stats show their `ring-2` active state).

Expected:
- The kanban shows **both** prospects (one matched on callback-due, the other on follow-up-due).
- Toggling either stat off narrows the view to just the other filter's matches; toggling both off restores all prospects.

- [ ] **Step 8: Clear a follow-up**

Open a prospect with a follow-up set. Click **Clear** next to the date picker. Save.

Expected:
- Follow-up pill disappears from the card.
- Notes field is also cleared (consistent with `clearCallback` behavior).

- [ ] **Step 9: Cleanup**

Walk back any test follow-ups you set on real prospects (Clear them and Save).

Stop the dev servers (Ctrl+C in each terminal).

- [ ] **Step 10: Final commit (if any uncommitted manual fixes)**

If verification surfaced any small fixes, commit them:

```bash
git status
# review unintended changes
git add <files>
git commit -m "fix(cold-calls): <what you fixed>"
```

If nothing changed, skip — no empty commit.

---

## Self-review notes

**Spec coverage check:**

| Spec requirement | Implemented in |
|---|---|
| `follow_up_on` Date column | Task 1, Task 2 |
| `follow_up_notes` String(255) column | Task 1, Task 2 |
| Index on `follow_up_on` | Task 2 |
| Pydantic schemas (Read/Create/Update) | Task 3 |
| Frontend types (CallProspect/Create/Update) | Task 4 |
| `followUpFormat.ts` pure helpers (tier, label, dueByEndOfToday, presets, in/out converters, parseBackendDate) | Task 5 |
| Follow-up section in detail modal (picker + 4 presets + notes + Clear) | Task 6 |
| Persisted via existing `updateMutation` | Task 6 Step 4 |
| `FollowUpPill` with smart-relative label and tier-based colors | Task 7 |
| Pill stacked below callback pill on card | Task 7 Step 5 |
| `Bell` icon distinguishing follow-up from callback's `Phone` | Task 7 Step 4 |
| `Follow-ups Due` stat with blue accent | Task 8 Step 4 |
| Stat doubles as filter toggle | Task 8 Step 4 |
| OR composition with callback filter | Task 8 Step 2 |
| Manual verification | Task 9 |

**Type-consistency check:** All new symbols (`followUpTier`, `formatFollowUpLabel`, `isFollowUpDueByEndOfToday`, `parseBackendDate`, `presetTomorrow`, `presetInThreeDays`, `presetNextMonday`, `presetInTwoWeeks`, `toLocalDateInputValue`, `fromLocalDateInputValue`, `FollowUpPill`, `followUpDueCount`, `followUpFilterActive`, `setFollowUpFilterActive`, `applyFollowUpPreset`, `clearFollowUp`, `followUpInput`, `followUpNotes`, `setFollowUpInput`, `setFollowUpNotes`) use consistent names across the tasks where they're introduced and consumed.

**Out of scope (deferred per spec):** notifications, recurring follow-ups, multiple follow-ups per prospect, calendar sync, typed actions (SMS/email).
