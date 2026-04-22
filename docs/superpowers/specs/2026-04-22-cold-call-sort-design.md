# Cold-Call Prospect Sort — Design

**Date:** 2026-04-22
**Scope:** Cold Calls tab in Outreach Hub
**Goal:** Let the user sort prospect cards inside every kanban column by a chosen field (name, rating, reviews, callback, recency) so they can rework the pipeline from different angles without pre-filtering or scrolling.

---

## Problem

Prospects currently render in whatever order the API returns (server sorts by `updated_at DESC`). When the user wants to work high-rating leads first, or run through alphabetically for a disciplined pass, they have no way to reorder. The Callbacks Due filter has its own implicit "callback ASC" sort, which is helpful there but doesn't compose with anything else.

## Non-goals

- Multi-column sort ("rating then name"). YAGNI for v1 — adds UI weight for marginal value.
- Per-column sort overrides. Complicates mental model.
- Persistence across page reloads (URL param or localStorage). Can add later if missed.
- Custom drag-to-reorder within a column. The kanban already supports stage/step drag on a different axis; intra-column manual reordering is a different feature.
- Backend changes. Sort is client-side over the already-loaded `prospects` array.

---

## Sort keys

| Key | Field(s) | Order | Null handling |
|---|---|---|---|
| `default` | — | Current API order (server `updated_at DESC`). | N/A |
| `name_asc` | `business_name` | Locale-aware A→Z (`localeCompare`). | Nulls last (no-op in practice — name is required). |
| `name_desc` | `business_name` | Locale-aware Z→A. | Nulls last. |
| `rating_desc` | `rating` | High → low. | Nulls last. |
| `rating_asc` | `rating` | Low → high. | Nulls last. |
| `reviews_desc` | `reviews_count` | High → low. | Nulls last. |
| `callback_asc` | `callback_at` | Overdue first, then upcoming. | No-callback cards sort last. |
| `created_desc` | `created_at` | Recently added first. | Nulls last. |
| `updated_desc` | `updated_at` | Recently touched first. | Nulls last. |

**Null-last rule (all keys):** a card with a `null` value for the sort field always sorts after cards with a non-null value, regardless of direction. This means `rating_asc` does NOT surface no-rating cards first — it surfaces low-rating cards first, then no-rating cards last. This matches the intent of "I want to work cards with data in this field".

**Stable sort tiebreaker:** when sort values are equal, ties break by `id DESC` (roughly insertion order) for deterministic rendering.

---

## UI

A compact `<select>` inserted into the existing header row that holds the `Call Pipeline` / `Call Sequence` heading and the Add Lead / Import CSV buttons. Placed between the heading and the right-side button cluster.

```
┌─────────────────────────────────────────────────────────────┐
│  Call Pipeline        Sort: [Default            ▼]   [+Add] [⬆Import] │
└─────────────────────────────────────────────────────────────┘
```

- Native `<select>` styled with the existing `inputClasses` pattern from `outreachStyles.ts`. Native is fine here — no grouped options, no search affordance needed.
- Label: `Sort:` prefix as a small muted span, so the select itself can use minimal width.
- Width: `min-w-[180px]` (accommodates "Rating · high → low" without truncation) but `max-w-[220px]`.
- No icon — the label carries meaning.
- No "applied" visual state — the value in the dropdown is self-evident.

Option labels (human-readable):

| Key | Label |
|---|---|
| `default` | `Default` |
| `name_asc` | `Business name · A→Z` |
| `name_desc` | `Business name · Z→A` |
| `rating_desc` | `Rating · high → low` |
| `rating_asc` | `Rating · low → high` |
| `reviews_desc` | `Reviews · high → low` |
| `callback_asc` | `Callback · soonest` |
| `created_desc` | `Recently added` |
| `updated_desc` | `Recently updated` |

---

## Behavior

### Interaction with Callbacks Due filter

The callback filter (shipped in the prior feature) currently forces its own "callback ASC" sort inside `prospectsByStatus` and `prospectsByStep`. Remove that implicit forced sort. Replace with:

- **When the user toggles the filter ON:** auto-switch `sortKey` state to `callback_asc` so the visible set is ordered by soonest-due by default. The user can then change the dropdown to anything else (e.g., `rating_desc`) and the sort respects that.
- **When the user toggles the filter OFF:** do NOT revert `sortKey` — leave the dropdown wherever the user put it. Changing the filter shouldn't silently undo a sort choice.

This couples the two features loosely via state, keeping each one self-contained but composable.

### Drag-and-drop

Drag-and-drop still moves a card between stages/steps as today. When the drop lands, the prospect's `status` or `current_step` changes, React re-renders, and the sort re-applies — so a dropped card snaps to the sort-determined position within its new column rather than to the top. This is the expected behavior when a sort is active.

### Session-only state

`sortKey` is `useState` in `ColdCallsTab`. It does not sync to URL, does not persist across reloads, does not sync across tabs. Kept minimal intentionally — easy to promote to `sessionStorage` or URL later.

---

## Component changes

| File | Change |
|---|---|
| `frontend/src/lib/sortProspects.ts` *(new)* | Pure util: `sortProspects(list: CallProspect[], key: SortKey): CallProspect[]` returning a new sorted array. Exports the `SortKey` union type and a `SORT_OPTIONS: Array<{ key: SortKey; label: string }>` for rendering the dropdown. |
| `frontend/src/components/outreach/ColdCallsTab.tsx` | Add `sortKey` state. Render `<select>` in the header row. Apply `sortProspects` inside both `prospectsByStatus` and `prospectsByStep` memos (after filter, before bucketing). Remove the existing `callbackFilterActive && sort` block — the sort comes from `sortKey` now. Auto-set `sortKey = 'callback_asc'` in the filter toggle handler when turning ON. |

No new files in `components/`, no new icons, no new deps. Estimated ~80 lines of new code + ~15 lines deleted (the callback-filter's internal sort).

---

## Edge cases

- **Empty list:** sort returns empty — no special case needed.
- **All-null sort field:** stable by `id DESC` tiebreaker.
- **Locale-aware sort on non-ASCII names:** `localeCompare(b, undefined, { sensitivity: 'base' })` — diacritics fold, case-insensitive. Fine for PH business names (Filipino/English).
- **Large prospect counts:** sort is O(n log n) on an array that's already been filtered. Even 10k prospects is <5ms on a modern machine — no memoization concerns beyond the existing `useMemo`.
- **Callback filter active + `sortKey = 'default'`:** the filter narrows cards, but "default" means "server order" which for filtered cards still means `updated_at DESC`. That's a reasonable outcome; user can change sort if they prefer.

---

## Rollout

Single PR, single commit ideally. No feature flag — purely additive UI on existing data. No migration.

---

## Open questions

None for v1. Persistence and multi-sort are deliberately deferred.
