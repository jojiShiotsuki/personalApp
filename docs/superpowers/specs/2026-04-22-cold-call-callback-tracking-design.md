# Cold-Call Callback Tracking — Design

**Date:** 2026-04-22
**Scope:** Cold Calls tab in Outreach Hub
**Goal:** Let the user capture when a prospect says "call me back at X time" during a cold call, and make sure those callbacks surface before the window passes.

---

## Problem

During a cold call, the prospect often says some variant of *"I can't talk now, call me back Wednesday at 3pm"*. Today there's no structured way to record that — it only lives in free-text notes and gets lost. Missed callback windows = wasted leads.

## Non-goals

- Push/email/SMS notifications — out of scope. Start visual-only; add later if callbacks are still being missed.
- Repeating callbacks, multiple scheduled callbacks per prospect — one pending callback per prospect.
- Auto-moving the prospect to a different kanban column — callback is orthogonal to call-outcome status.
- Calendar integration (Google Calendar, etc.) — out of scope.

---

## Data model

Two new nullable columns on `call_prospects`:

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `callback_at` | `DateTime` (UTC) | yes | When to call back. `NULL` = no callback scheduled. |
| `callback_notes` | `String(255)` | yes | Optional context (e.g., "owner back from holiday"). |

**Index:** `ix_call_prospects_callback_at` on `callback_at` — the "Due today" filter and card sorting both query by this column.

**Timezone:** server stores UTC; frontend converts to browser local for both display and input. No per-user timezone setting.

**Status coupling:** none. `status` remains independent. Setting `callback_at` does not move the card between columns. Changing `status` does not clear `callback_at`.

---

## UI surfaces

### 1. Prospect detail modal — new "Callback" section

Sits below the existing Stage / Script Label / Notes fields, above the footer.

```
┌──────────────────────────────────────────┐
│  Callback                                │
│  ┌─────────────────────────────────────┐ │
│  │ [date-time picker]         [Clear]  │ │
│  └─────────────────────────────────────┘ │
│  Quick: [In 1h] [In 2h] [Tomorrow 10am]  │
│         [Next Mon 10am]                  │
│                                          │
│  Notes (optional)                        │
│  ┌─────────────────────────────────────┐ │
│  │ e.g. owner back from holiday        │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

- **Picker:** native `<input type="datetime-local">` styled via existing `inputClasses`. Value bound to `callback_at` converted to local.
- **Quick presets:** four small pill buttons that set the picker value:
  - `In 1h` → `now + 60min`, rounded up to next 5-minute boundary for clean display
  - `In 2h` → `now + 120min`, rounded up to next 5-minute boundary
  - `Tomorrow 10am` → next calendar day, 10:00 local
  - `Next Mon 10am` → next Monday (skip today even if today is Monday), 10:00 local
  Presets write into the picker (don't auto-save) so the user can still adjust before clicking Save.
- **Clear button:** nulls `callback_at` and `callback_notes` in local state; commits on Save like other fields.
- **Notes:** single-line text, `max_length=255`, shares the `inputClasses` style.
- Persists via the existing `updateMutation` — no new endpoint needed.

### 2. Prospect card — callback pill

Renders only when `callback_at !== null`. Placement: directly under the phone number, above the channel icons. Format is smart-relative:

| Time-until-callback | Label | Color |
|---|---|---|
| Overdue (past) | `Overdue · {short time}` | `bg-red-500/20 text-red-400` + gentle pulse (`animate-pulse`) |
| ≤ 60 min | `Due in 45m` | `bg-orange-500/20 text-orange-400` |
| Today, > 60 min | `Today 3:00 PM` | `bg-amber-500/20 text-amber-400` |
| Tomorrow | `Tomorrow 10:00 AM` | `bg-blue-500/20 text-blue-400` |
| Within 7 days | `Wed 3:00 PM` | `bg-stone-500/20 text-stone-300` |
| > 7 days | `Apr 30 3:00 PM` | `bg-stone-500/20 text-stone-300` |

Pill component:

```tsx
<span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md">
  <Phone className="w-3 h-3" />
  {label}
</span>
```

Uses a plain `Phone` icon (already imported). A `useCurrentMinute()` custom hook re-renders the pill each minute so the "Due in 45m" style counts down without a full-page refresh.

### 3. Stats bar — "Callbacks Due" stat

Add one `HubStat` entry:

```ts
{
  icon: PhoneCall,                  // new import from lucide-react
  label: 'Callbacks Due',
  value: dueCount,                  // prospects where callback_at <= end-of-today-local
  accent: 'orange',
}
```

Count logic: prospects whose `callback_at` is non-null AND falls at or before 23:59:59 local today. This covers both overdue and due-later-today in one number — matches the "I need to handle these today" mental model.

Clicking the stat toggles a **callback filter** state (also reachable via URL query param if desired, but not required for v1).

### 4. Callback filter behavior

When the filter is ON:

- Kanban still renders all four status columns (or step columns).
- Each column shows only prospects with `callback_at` non-null AND `callback_at <= end-of-today-local`.
- Within each column, cards sort by `callback_at` ascending (overdue first, then next-up).
- Stats bar stat shows an "Active" visual state (e.g., `ring-2 ring-orange-500/40`) so it's obvious a filter is applied.
- A second click on the stat clears the filter and restores the unfiltered view.

No new filter UI beyond the clickable stat — keeps the hub uncluttered.

---

## Component changes

| File | Change |
|---|---|
| `backend/app/models/call_prospect.py` | Add `callback_at` and `callback_notes` columns + index. |
| `backend/app/schemas/call_prospect.py` | Add fields to `CallProspectRead`, `CallProspectCreate`, `CallProspectUpdate`. |
| Alembic migration | Hand-scrubbed migration: **add columns + index only**. Per existing memory, autogenerate drifts — review before apply. |
| `frontend/src/types/index.ts` | Add `callback_at: string \| null` and `callback_notes: string \| null` to `CallProspect`, `CallProspectCreate`, `CallProspectUpdate`. |
| `frontend/src/components/outreach/CallProspectDetailModal.tsx` | Add Callback section (picker + presets + notes + Clear). Wire into existing `updateMutation`. |
| `frontend/src/components/outreach/ColdCallsTab.tsx` | Add `CallbackPill` subcomponent to `CallProspectCard`. Add `dueCount` memo and `callbackFilterActive` state. Filter + sort `prospectsByStatus` / `prospectsByStep` when active. Add `PhoneCall` stat to `HubStatsBar`. |
| `frontend/src/hooks/useCurrentMinute.ts` *(new)* | Hook returning a `Date` pinned to the current minute, re-rendering every 60s — used by callback pills for relative time. |
| `frontend/src/lib/callbackFormat.ts` *(new)* | Pure functions: `formatCallbackLabel(at: Date, now: Date)` and `callbackTier(at, now): 'overdue' \| 'soon' \| 'today' \| 'tomorrow' \| 'thisweek' \| 'future'`. Unit-testable without React. |

File count: **3 new** (hook, format util, migration), **5 modified**. No existing file blows past 800 lines after changes (`ColdCallsTab.tsx` stays under 1200; extracting the Column/StepColumn split is not in scope here).

---

## Edge cases

- **Saving in the past:** allowed. The pill just renders as Overdue. Useful if the user set it loosely and missed it.
- **Clearing callback on status change to `DEAD`:** not automatic. The user can clear manually. If this turns out to be annoying, we'll revisit.
- **Timezone around DST boundary:** native `datetime-local` + JS `Date` handles DST correctly in browser-local. Quick presets like "tomorrow 10am" use `setHours(10, 0, 0, 0)` on the next day, which stays correct across DST.
- **Stale pill after page left open overnight:** `useCurrentMinute` keeps the label fresh. A card showing `In 45m` at 9:15 becomes `In 5m`, then `Overdue · 9:45 AM` automatically.
- **Filter with 0 results:** empty-state text already renders per column ("No leads" / "No prospects"); no special messaging needed.
- **Bulk operations interact with filter:** selection checkboxes keep working while filter is active — user can multi-select filtered set for bulk label/delete as today.

---

## Rollout

Single PR. Backend migration + frontend changes land together. Behind no feature flag — the feature is additive (new columns default to `NULL`, new UI only renders when data exists).

---

## Open questions

None for v1. Notifications and calendar sync are intentionally deferred.
