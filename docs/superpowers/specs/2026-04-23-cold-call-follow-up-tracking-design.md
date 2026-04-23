# Cold-Call Follow-up Tracking — Design

**Date:** 2026-04-23
**Scope:** Cold Calls tab in Outreach Hub
**Goal:** Let the user set a date-only "follow up" reminder on a prospect (separate from the existing callback feature) so the next non-call touch in their multi-step sequence isn't forgotten.

---

## Problem

Cold-call prospecting is a multi-step sequence — initial call, then SMS, then email, etc. The existing **callback** feature captures *"call me back at this exact time"* the prospect asked for. It does not cover *"I should circle back to this prospect on Tuesday with an SMS"* — the user's own reminder for the next step in the sequence, which is calendar-day granularity, not appointment-time granularity.

Today that lives only in free-text notes and gets lost.

## Non-goals

- Action type (SMS / email / DM) — generic reminder only. Adding a typed taxonomy can come later if the user actually wants to filter by channel.
- Multiple pending follow-ups per prospect — single pending, mirrors the callback model.
- Notifications, calendar sync, recurring follow-ups — out of scope.
- Auto-clearing follow-up when status changes to `DEAD` — leave to the user; revisit if it becomes annoying.
- Time-of-day precision — date-only is intentional. If the user wants a specific time, that's what callback is for.

---

## Data model

Two new nullable columns on `call_prospects`:

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `follow_up_on` | `Date` | yes | Calendar date — no time-of-day, no timezone. `NULL` = no follow-up scheduled. |
| `follow_up_notes` | `String(255)` | yes | Optional context (e.g., "send proposal", "check IG"). |

**Index:** `ix_call_prospects_follow_up_on` on `follow_up_on` — the "Due today" filter and card sorting both query by this column.

**Type rationale:** `Date` not `DateTime`. The user explicitly chose date-only, and using `Date` keeps the API contract honest — no fake time-of-day values, no timezone conversion needed in either direction. The frontend treats it as an ISO date string `"YYYY-MM-DD"`.

**Status coupling:** none. `status` and `follow_up_on` are orthogonal. Setting `follow_up_on` does not move the card between kanban columns. Changing `status` does not clear `follow_up_on`. Same model as callback.

**Coexistence with callback:** independent columns. A single prospect can have both `callback_at` (e.g., Wed 3pm) and `follow_up_on` (e.g., Fri) simultaneously. Both pills render on the card.

---

## UI surfaces

### 1. Prospect detail modal — new "Follow-up" section

Sits directly below the existing **Callback** section (which sits below Stage / Script Label / Notes).

```
┌──────────────────────────────────────────┐
│  Follow-up                               │
│  ┌─────────────────────────────────────┐ │
│  │ [date picker]              [Clear]  │ │
│  └─────────────────────────────────────┘ │
│  Quick: [Tomorrow] [In 3 days]           │
│         [Next Mon] [In 2 weeks]          │
│                                          │
│  Notes (optional)                        │
│  ┌─────────────────────────────────────┐ │
│  │ e.g. send proposal, check IG        │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

- **Picker:** native `<input type="date">` styled via existing `inputClasses`. Value bound directly to `follow_up_on` (no conversion — already an ISO date string).
- **Quick presets:** four small pill buttons that set the picker value:
  - `Tomorrow` → today + 1 calendar day (local)
  - `In 3 days` → today + 3 calendar days (local)
  - `Next Mon` → next Monday (skip today even if today is Monday) (local)
  - `In 2 weeks` → today + 14 calendar days (local)

  Presets write into the picker (don't auto-save) so the user can still adjust before clicking Save.
- **Clear button:** nulls `follow_up_on` and `follow_up_notes` in local state; commits on Save like other fields.
- **Notes:** single-line text, `max_length=255`, shares the `inputClasses` style.
- Persists via the existing `updateMutation` — no new endpoint needed.

### 2. Prospect card — follow-up pill

Renders only when `follow_up_on !== null`. Placement: directly **below the callback pill** (under the phone number, above the channel icons). When both are present they stack vertically — callback first (more time-urgent), follow-up second.

Format is smart-relative based on date difference from today (browser-local):

| Days from today | Label | Color |
|---|---|---|
| Past | `Overdue · Apr 22` | `bg-red-500/20 text-red-400` + gentle pulse (`animate-pulse`) |
| 0 (today) | `Today` | `bg-amber-500/20 text-amber-400` |
| 1 (tomorrow) | `Tomorrow` | `bg-blue-500/20 text-blue-400` |
| 2–7 days | `Wed` (short weekday) | `bg-stone-500/20 text-stone-300` |
| > 7 days | `Apr 30` (short month + day) | `bg-stone-500/20 text-stone-300` |

Pill component:

```tsx
<span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md">
  <Bell className="w-3 h-3" />
  {label}
</span>
```

Uses `Bell` from `lucide-react` (new import). Distinct from the callback pill's `Phone` icon — at a glance the user can tell which type of reminder is firing.

**No countdown re-render needed.** Date-only follow-ups don't change label state mid-day, so the existing `useCurrentMinute` hook is not required for follow-up pills. They re-evaluate on the next render (any data change, navigation, or re-mount), which is sufficient for date-granularity.

### 3. Stats bar — "Follow-ups Due" stat

Add one `HubStat` entry alongside the existing `Callbacks Due`:

```ts
{
  icon: Bell,                       // new import from lucide-react
  label: 'Follow-ups Due',
  value: followUpDueCount,          // prospects where follow_up_on <= today (local)
  accent: 'blue',
}
```

**Accent rationale:** callback uses `orange`; follow-up uses `blue`. Distinct accents make the two stats visually separable in the stats bar at a glance.

Count logic: prospects whose `follow_up_on` is non-null AND `<= today (local date)`. Covers both overdue and due-today in one number.

Clicking the stat toggles a **follow-up filter** state.

### 4. Follow-up filter behavior

When the filter is ON:

- Kanban still renders all four status columns (or step columns).
- Each column shows only prospects with `follow_up_on` non-null AND `follow_up_on <= today (local)`.
- Within each column, cards sort by `follow_up_on` ascending (overdue first, then today).
- The stat shows an "Active" visual state (`ring-2 ring-blue-500/40`) so it's obvious a filter is applied.
- A second click on the stat clears the filter and restores the unfiltered view.

### 5. Filter composition (callback + follow-up together)

Callback filter and follow-up filter are **independent toggles**. When both are active:

- Each column shows prospects matching **either** filter (OR composition):
  - prospects with a `callback_at` <= end-of-today-local, OR
  - prospects with a `follow_up_on` <= today-local
- Sort key: earliest of the two timestamps (treating `follow_up_on` as start-of-day local for comparison).
- Both stats show their active `ring-2` state.

Rationale: when the user opens both filters they're in "what do I need to handle today" mode. AND would frequently produce empty columns; OR matches the mental model.

---

## Component changes

| File | Change |
|---|---|
| `backend/app/models/call_prospect.py` | Add `follow_up_on` (Date) + `follow_up_notes` (String 255) + `Index("ix_call_prospects_follow_up_on", "follow_up_on")`. Place adjacent to existing `callback_at` / `callback_notes` block for readability. |
| `backend/app/schemas/call_prospect.py` | Add `follow_up_on: date \| None` and `follow_up_notes: str \| None` to `CallProspectRead`, `CallProspectCreate`, `CallProspectUpdate`. Pydantic serializes `date` as `"YYYY-MM-DD"`. |
| Alembic migration *(new)* | Hand-scrubbed: **add 2 columns + 1 index only**. Per `MEMORY.md` autogenerate-drift rule, do not use `--autogenerate` blindly — write the migration manually or hand-scrub the autogen output to remove drift (no other tables/columns touched). |
| `frontend/src/types/index.ts` | Add `follow_up_on: string \| null` and `follow_up_notes: string \| null` to `CallProspect`, `CallProspectCreate`, `CallProspectUpdate`. |
| `frontend/src/lib/followUpFormat.ts` *(new)* | Pure functions: `formatFollowUpLabel(on: Date, today: Date): string` and `followUpTier(on: Date, today: Date): 'overdue' \| 'today' \| 'tomorrow' \| 'thisweek' \| 'future'`. Pure / unit-testable; no React. |
| `frontend/src/components/outreach/CallProspectDetailModal.tsx` | Add Follow-up section below Callback section. Wire into existing `updateMutation`. Reuse `inputClasses`. |
| `frontend/src/components/outreach/ColdCallsTab.tsx` | Add `FollowUpPill` subcomponent to `CallProspectCard` (renders below `CallbackPill`). Add `followUpDueCount` memo. Add `followUpFilterActive` state. Extend filter + sort logic on `prospectsByStatus` / `prospectsByStep` to support the follow-up filter and OR-composition with the callback filter. Add `Bell`-icon stat to `HubStatsBar`. |

**File counts:** **2 new** (format util, migration), **5 modified**. No file blows past existing limits — `ColdCallsTab.tsx` gains roughly the same surface area that the callback feature added (~80 lines for pill + memo + filter wiring + stat).

---

## Edge cases

- **Saving a date in the past:** allowed. Pill renders as Overdue. Useful if the user set a follow-up loosely and missed it.
- **Status changed to `DEAD`:** does not auto-clear `follow_up_on`. User can clear manually. Symmetric with callback behavior.
- **Both callback and follow-up set:** both pills render, stacked (callback above follow-up). Both stats reflect them independently. With both filters active, prospect appears as long as either reminder is due.
- **Date format inconsistency:** `<input type="date">` always emits `"YYYY-MM-DD"` regardless of browser locale. Backend accepts the same. No locale-dependent parsing.
- **Empty filter result:** existing per-column empty state ("No leads" / "No prospects") already handles this; no special messaging needed.
- **Bulk operations interact with filter:** existing selection checkboxes keep working while filter is active — user can multi-select the filtered set for bulk label/delete/tier as today.
- **Daylight saving:** date-only fields are unaffected. No JS `Date` arithmetic across DST is required (presets use `setDate(getDate() + n)` on a local-midnight reference).
- **Page left open across midnight:** the "today" comparison uses `new Date()` evaluated each render. When data invalidates or user navigates, the comparison refreshes. Stale labels are acceptable at date granularity for a few hours; a manual filter toggle re-runs the comparison.

---

## Rollout

Single PR. Backend migration + frontend changes land together. No feature flag — additive (new columns default to `NULL`, new UI only renders when data exists).

---

## Open questions

None for v1. Notifications, typed actions (SMS/email), and follow-up queues are intentionally deferred.
