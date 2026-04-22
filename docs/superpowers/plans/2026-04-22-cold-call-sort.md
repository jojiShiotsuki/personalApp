# Cold-Call Prospect Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side sort dropdown to the Cold Calls kanban so the user can order prospects within every column by name, rating, reviews, callback time, or recency.

**Architecture:** Pure-UI feature. A new `sortProspects` util produces a new sorted copy of a `CallProspect[]`. `ColdCallsTab` adds a `sortKey` state + a native `<select>` in the kanban header row, and routes both `prospectsByStatus` and `prospectsByStep` through the util. Null values always sort last; ties break by `id DESC`. The existing Callbacks Due filter auto-switches `sortKey` to `'callback_asc'` when turning on, removing the filter's own implicit sort.

**Tech Stack:** React 18 + TypeScript + TailwindCSS. No new deps.

**Spec:** `docs/superpowers/specs/2026-04-22-cold-call-sort-design.md`

**Starting commit:** current HEAD on branch `feat/cold-call-sort` (spec committed).

---

## Testing Strategy

No frontend unit-test runner. Verification is `npm run build` + manual walk-through with backend/frontend dev servers. Each task ends with a build check; Task 4 is the full click-through.

---

## File Structure

**Create (1):**
- `frontend/src/lib/sortProspects.ts` — pure util + `SortKey` union + `SORT_OPTIONS`.

**Modify (1):**
- `frontend/src/components/outreach/ColdCallsTab.tsx` — state, dropdown, memo wiring, filter-toggle coupling.

No files exceed 800 lines after changes (`ColdCallsTab.tsx` stays under 1250).

---

## Task 1: Add `sortProspects` util

**Files:**
- Create: `frontend/src/lib/sortProspects.ts`

- [ ] **Step 1: Create the util with full contents**

Write `frontend/src/lib/sortProspects.ts`:

```typescript
import type { CallProspect } from '@/types';
import { parseBackendDatetime } from './callbackFormat';

/**
 * Available sort keys for the Cold Calls kanban. Each key orders prospects
 * within every column. Applied client-side after the API has returned its
 * own `updated_at DESC` ordering.
 */
export type SortKey =
  | 'default'
  | 'name_asc'
  | 'name_desc'
  | 'rating_desc'
  | 'rating_asc'
  | 'reviews_desc'
  | 'callback_asc'
  | 'created_desc'
  | 'updated_desc';

export interface SortOption {
  key: SortKey;
  label: string;
}

/**
 * Dropdown options in display order. `default` first so a fresh load shows
 * the API's own ordering without the user picking it.
 */
export const SORT_OPTIONS: readonly SortOption[] = [
  { key: 'default', label: 'Default' },
  { key: 'name_asc', label: 'Business name · A→Z' },
  { key: 'name_desc', label: 'Business name · Z→A' },
  { key: 'rating_desc', label: 'Rating · high → low' },
  { key: 'rating_asc', label: 'Rating · low → high' },
  { key: 'reviews_desc', label: 'Reviews · high → low' },
  { key: 'callback_asc', label: 'Callback · soonest' },
  { key: 'created_desc', label: 'Recently added' },
  { key: 'updated_desc', label: 'Recently updated' },
] as const;

/**
 * Returns a new array sorted by the chosen key. Null values always sort to
 * the end regardless of direction — the user picked a sort because they
 * want prospects WITH data in that field to surface. Ties break by
 * `id DESC` for deterministic rendering.
 *
 * `'default'` is a pass-through: the API already sorted by `updated_at DESC`
 * and we don't want to re-order a fresh load.
 */
export function sortProspects(
  list: CallProspect[],
  key: SortKey,
): CallProspect[] {
  if (key === 'default') return list;
  const copy = list.slice();
  copy.sort(compareBuilders[key]);
  return copy;
}

type Comparator = (a: CallProspect, b: CallProspect) => number;

/**
 * Nulls-last helper. `getValue` returns the comparable value or null.
 * `direction` is +1 for ascending, -1 for descending.
 */
function nullsLast<T>(
  getValue: (p: CallProspect) => T | null | undefined,
  direction: 1 | -1,
  compare: (a: T, b: T) => number,
): Comparator {
  return (a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return b.id - a.id;
    if (aNull) return 1;
    if (bNull) return -1;
    const primary = compare(av as T, bv as T) * direction;
    if (primary !== 0) return primary;
    return b.id - a.id;
  };
}

const compareStrings = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const compareNumbers = (a: number, b: number): number => a - b;

const compareDatetimes = (a: string, b: string): number =>
  parseBackendDatetime(a).getTime() - parseBackendDatetime(b).getTime();

const compareBuilders: Record<Exclude<SortKey, 'default'>, Comparator> = {
  name_asc: nullsLast((p) => p.business_name, 1, compareStrings),
  name_desc: nullsLast((p) => p.business_name, -1, compareStrings),
  rating_desc: nullsLast((p) => p.rating, -1, compareNumbers),
  rating_asc: nullsLast((p) => p.rating, 1, compareNumbers),
  reviews_desc: nullsLast((p) => p.reviews_count, -1, compareNumbers),
  callback_asc: nullsLast((p) => p.callback_at, 1, compareDatetimes),
  created_desc: nullsLast((p) => p.created_at, -1, compareDatetimes),
  updated_desc: nullsLast((p) => p.updated_at, -1, compareDatetimes),
};
```

- [ ] **Step 2: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: `✓ built in <N>s`, no TypeScript errors. (The util is not yet consumed; it must still compile.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/sortProspects.ts
git commit -m "feat(cold-calls): add sortProspects util with 9 sort keys"
```

---

## Task 2: Add sort state + dropdown to `ColdCallsTab`

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Import the util**

In the existing `@/lib/...` import block (around lines 54-59, after `callbackFormat` imports), add:

```typescript
import { sortProspects, SORT_OPTIONS, type SortKey } from '@/lib/sortProspects';
```

- [ ] **Step 2: Add `sortKey` state**

Inside `ColdCallsTab` immediately after the existing `callbackFilterActive` useState (search for `const [callbackFilterActive, setCallbackFilterActive] = useState(false);`), add:

```typescript
  const [sortKey, setSortKey] = useState<SortKey>('default');
```

- [ ] **Step 3: Render the `<select>` in the kanban header row**

Find the JSX block (around line 933 in the current file — verify by searching for the string `{isStepView ? 'Call Sequence' : 'Call Pipeline'}`). Currently it looks like:

```tsx
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[--exec-text]">
            {isStepView ? 'Call Sequence' : 'Call Pipeline'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddOpen(true)}
              className={smallPrimaryButtonClasses}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>
```

Replace that opening block with:

```tsx
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[--exec-text]">
            {isStepView ? 'Call Sequence' : 'Call Pipeline'}
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-[--exec-text-muted]">
              <span>Sort:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className={cn(
                  'min-w-[180px] max-w-[220px] px-3 py-1.5 rounded-lg text-xs',
                  'bg-stone-800/50 border border-stone-600/40',
                  'text-[--exec-text]',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'cursor-pointer appearance-none',
                )}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setIsAddOpen(true)}
              className={smallPrimaryButtonClasses}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>
```

(Only the inside of the right-side `<div className="flex items-center gap-2">` changes — the new `<label>` is inserted before the first `<button>`.)

- [ ] **Step 4: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds. `sortKey` is set but not yet consumed — no TS warnings because `setSortKey` is used.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): add sort dropdown to kanban header"
```

---

## Task 3: Wire sort into memos + couple with filter toggle

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

This task replaces the current implicit "sort by callback when filter active" behavior with explicit `sortKey`-driven sort, and wires the filter toggle to auto-switch the sort key.

- [ ] **Step 1: Remove `sortByCallbackAsc` helper**

Find the block (currently around lines 809-814):

```typescript
  const sortByCallbackAsc = (a: CallProspect, b: CallProspect): number => {
    // Only called in filtered view, where both have callback_at.
    const av = a.callback_at ? parseBackendDatetime(a.callback_at).getTime() : Infinity;
    const bv = b.callback_at ? parseBackendDatetime(b.callback_at).getTime() : Infinity;
    return av - bv;
  };
```

Delete it entirely. The `sortProspects` util supersedes it.

- [ ] **Step 2: Route `prospectsByStatus` through `sortProspects`**

Find the current block (around lines 816-834):

```typescript
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

Replace with:

```typescript
  const prospectsByStatus = useMemo(() => {
    const sorted = sortProspects(visibleProspects, sortKey);
    const map: Record<CallStatus, CallProspect[]> = {
      [CallStatus.NEW]: [],
      [CallStatus.ATTEMPTED]: [],
      [CallStatus.CONNECTED]: [],
      [CallStatus.DEAD]: [],
    };
    for (const p of sorted) {
      if (map[p.status]) {
        map[p.status].push(p);
      }
    }
    return map;
  }, [visibleProspects, sortKey]);
```

- [ ] **Step 3: Route `prospectsByStep` through `sortProspects`**

Find the current block (around lines 844-863):

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

Replace with:

```typescript
  const prospectsByStep = useMemo(() => {
    const map: Record<number, CallProspect[]> = {};
    for (const s of stepColumns) map[s.step_number] = [];
    if (stepColumns.length === 0) return map;
    const sorted = sortProspects(visibleProspects, sortKey);
    for (const p of sorted) {
      const step = p.current_step ?? 1;
      if (map[step] !== undefined) {
        map[step].push(p);
      } else {
        // Out-of-range step: bucket into the first column rather than dropping.
        map[stepColumns[0].step_number].push(p);
      }
    }
    return map;
  }, [visibleProspects, stepColumns, sortKey]);
```

- [ ] **Step 4: Couple the filter toggle with `sortKey`**

The filter toggle lives inside the `stats: HubStat[]` definition. Find the "Callbacks Due" entry (search for `label: 'Callbacks Due'`), currently the last object in the array:

```typescript
    {
      icon: PhoneCall,
      label: 'Callbacks Due',
      value: dueCount,
      accent: 'orange',
      active: callbackFilterActive,
      onClick: () => setCallbackFilterActive((v) => !v),
    },
```

Replace with:

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

- [ ] **Step 5: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds, no TS errors. Specifically, no dangling reference to `sortByCallbackAsc` or `parseBackendDatetime` in the section you edited — `parseBackendDatetime` is still used elsewhere in the file (in the callback pill, the filter predicate, and `dueCount`), so don't remove its import.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): apply sort to kanban columns, couple filter toggle"
```

---

## Task 4: Smoke test + tidy

**Files:** none modified.

- [ ] **Step 1: Full build**

From `frontend/`:

```bash
npm run build
```

Expected: `✓ built in <N>s`.

- [ ] **Step 2: Start dev servers (manual)**

In two shells:

```bash
# Shell A
cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

```bash
# Shell B
cd frontend && npm run dev
```

- [ ] **Step 3: Walk the UI**

Open the Cold Calls tab with a populated campaign (or the global "All Campaigns" view). Verify:

1. **Dropdown renders** in the header row between `Call Pipeline` / `Call Sequence` heading and the `Add Lead` / `Import CSV` buttons.
2. **Default** — cards order matches pre-sort behavior (server `updated_at DESC`).
3. **Business name · A→Z** — first card in each column alphabetically first. Diacritics fold (a business starting with `Á` sorts among the `A`s).
4. **Rating · high → low** — top card per column has the highest rating; cards with `null` rating cluster at the bottom of each column.
5. **Rating · low → high** — flips the non-null cards. Null-rating cards STILL cluster at the bottom (not top) — this is the deliberate null-last rule.
6. **Reviews · high → low** — top card has the highest `reviews_count`.
7. **Callback · soonest** — cards with overdue callbacks surface first; cards without callbacks fall to the bottom.
8. **Recently added** — newest `created_at` on top.
9. **Recently updated** — most recently touched on top (matches Default for a freshly-loaded page).
10. **Filter ON** (click the "Callbacks Due" stat) — dropdown auto-switches to `Callback · soonest`. Kanban shows only prospects due today, ordered ascending by callback time.
11. **Change dropdown while filter is on** (e.g., to `Rating · high → low`) — filter stays on, but remaining cards re-order by rating.
12. **Filter OFF** — unfiltered set returns; dropdown value sticks (does NOT revert to `default`).
13. **Drag-and-drop while sorted** — drop a card into a different status; on re-render the card lands at its sort-determined position in the new column, not necessarily at the top.
14. **Dark mode sanity** — select has dark background, light text, visible focus ring.

If anything in 1-14 is wrong, fix the specific task responsible and re-run. If everything passes, move on.

- [ ] **Step 4: No commit required**

If no fixes, nothing to commit. If fixes were needed, commit each fix with an appropriate `fix(cold-calls): ...` message.

---

## Out of scope (explicit)

- URL param / `sessionStorage` persistence across reloads.
- Multi-column sort ("rating then name").
- Per-column sort overrides.
- Backend-side sort (`GET /api/cold-calls?sort=rating_desc`).
- Drag-to-reorder inside a column.
- Tooltip or help text on the dropdown — label is self-explanatory.
