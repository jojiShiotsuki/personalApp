# Cold-Call Prospect Tier Tagging — Design

**Date:** 2026-04-22
**Scope:** Cold Calls tab in Outreach Hub
**Goal:** Tag each cold-call prospect with one of five quality/priority tiers so the user can visually scan the pipeline and rework higher-value leads first.

---

## Problem

The only categorical attribute on a prospect today is `status` (NEW/ATTEMPTED/CONNECTED/DEAD) and a free-text `script_label`. Neither signals prospect quality. Flagship candidates, commercial specialists, and developmental leads all look identical in the kanban, so the user can't prioritize without scrolling + reading every card.

## Tiers

Closed set of 5 enum values:

| Enum value | Display (full) | Pill label (card) |
|---|---|---|
| `S_TIER_FLAGSHIP` | S-tier flagship | `S · Flagship` |
| `A_TIER_FLAGSHIP` | A-tier flagship | `A · Flagship` |
| `B_TIER_FLAGSHIP` | B-tier flagship | `B · Flagship` |
| `COMMERCIAL_SPECIALIST` | Commercial specialist | `Commercial` |
| `DEVELOPMENTAL` | Developmental | `Developmental` |

Tier is nullable = "untagged". Most prospects start untagged; the user assigns as they qualify.

## Non-goals (v1)

- **Filter by tier** — stats bar is full after the Callbacks Due card. Revisit if pain is real.
- **Per-tier quotas** (e.g., "max 5 S-tier at a time"). Out of scope.
- **Tier history / audit log.** Last-write-wins, no historical record.
- **Color customization by user.** Fixed palette.
- **Backend validation that tier is one of the 5 values.** Pydantic enum enforces it — no additional DB constraint.

---

## Data model

Single new nullable column on `call_prospects`:

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `tier` | `String(30)` | yes | Stores the enum's string value. `NULL` = untagged. |

**Why `String` not `Enum` DB type:** adding a 6th tier later is a code-only change (extend Python enum + frontend map). DB enum types are rigid and require migrations to extend. Small cardinality (5 values, typical list of ~hundreds to low thousands of prospects) means no performance concern from string vs. enum.

**No index.** Tier is not queried server-side — filtering/sorting happens client-side on the already-loaded prospect list. Small fan-out per tier makes an index pointless.

**Column placement:** right after `script_label`, mirroring its shape (nullable string tag).

---

## Backend

### Python enum

Defined alongside the existing `CallStatus` enum in both `backend/app/models/call_prospect.py` and `backend/app/schemas/call_prospect.py`:

```python
class ProspectTier(str, enum.Enum):
    S_TIER_FLAGSHIP = "S_TIER_FLAGSHIP"
    A_TIER_FLAGSHIP = "A_TIER_FLAGSHIP"
    B_TIER_FLAGSHIP = "B_TIER_FLAGSHIP"
    COMMERCIAL_SPECIALIST = "COMMERCIAL_SPECIALIST"
    DEVELOPMENTAL = "DEVELOPMENTAL"
```

### Schema changes

- `CallProspectBase` gains `tier: Optional[ProspectTier] = None` (exposed on `CallProspectResponse` via inheritance).
- `CallProspectUpdate` gains `tier: Optional[ProspectTier] = None` (already all fields optional).
- New request/response schemas for bulk-tier:

```python
class BulkTierRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)
    tier: Optional[ProspectTier] = None  # None = clear

class BulkTierResponse(BaseModel):
    updated_count: int
```

### Bulk-update endpoint

Mirrors the existing `POST /api/cold-calls/bulk-update-label` route at `backend/app/routes/cold_calls.py`. Add `POST /api/cold-calls/bulk-update-tier` accepting `BulkTierRequest` and returning `BulkTierResponse`. Same pattern: iterate the IDs, `UPDATE … SET tier = :tier WHERE id IN (…)`, commit, return count.

### Migration

Hand-written Alembic migration (autogenerate is banned in this repo per existing memory). Adds the single column, no index:

```python
# Revision ID: tier_2026_04_22
# Revises: cb_tracking_2026_04_22

def upgrade() -> None:
    op.add_column(
        'call_prospects',
        sa.Column('tier', sa.String(length=30), nullable=True),
    )

def downgrade() -> None:
    with op.batch_alter_table('call_prospects', schema=None) as batch_op:
        batch_op.drop_column('tier')
```

Current head (verified via `alembic heads`): `cb_tracking_2026_04_22`.

---

## Frontend

### Type additions

In `frontend/src/types/index.ts`:

```typescript
export enum ProspectTier {
  S_TIER_FLAGSHIP = 'S_TIER_FLAGSHIP',
  A_TIER_FLAGSHIP = 'A_TIER_FLAGSHIP',
  B_TIER_FLAGSHIP = 'B_TIER_FLAGSHIP',
  COMMERCIAL_SPECIALIST = 'COMMERCIAL_SPECIALIST',
  DEVELOPMENTAL = 'DEVELOPMENTAL',
}
```

Extend `CallProspect`, `CallProspectCreate`, `CallProspectUpdate` with `tier?: ProspectTier | null` (required on the response — always present, may be null — and optional on create/update).

### New util: `frontend/src/lib/tierMeta.ts`

Single source of truth for tier display metadata:

```typescript
import { ProspectTier } from '@/types';

export interface TierMeta {
  value: ProspectTier;
  fullLabel: string;   // shown in modal dropdown + tooltip on pill
  pillLabel: string;   // compact label on the card pill
  pillClasses: string; // Tailwind utility string: bg + text colors
}

export const TIER_META: Record<ProspectTier, TierMeta> = {
  [ProspectTier.S_TIER_FLAGSHIP]: {
    value: ProspectTier.S_TIER_FLAGSHIP,
    fullLabel: 'S-tier flagship',
    pillLabel: 'S · Flagship',
    pillClasses: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30',
  },
  [ProspectTier.A_TIER_FLAGSHIP]: {
    value: ProspectTier.A_TIER_FLAGSHIP,
    fullLabel: 'A-tier flagship',
    pillLabel: 'A · Flagship',
    pillClasses: 'bg-emerald-500/20 text-emerald-400',
  },
  [ProspectTier.B_TIER_FLAGSHIP]: {
    value: ProspectTier.B_TIER_FLAGSHIP,
    fullLabel: 'B-tier flagship',
    pillLabel: 'B · Flagship',
    pillClasses: 'bg-blue-500/20 text-blue-400',
  },
  [ProspectTier.COMMERCIAL_SPECIALIST]: {
    value: ProspectTier.COMMERCIAL_SPECIALIST,
    fullLabel: 'Commercial specialist',
    pillLabel: 'Commercial',
    pillClasses: 'bg-purple-500/20 text-purple-400',
  },
  [ProspectTier.DEVELOPMENTAL]: {
    value: ProspectTier.DEVELOPMENTAL,
    fullLabel: 'Developmental',
    pillLabel: 'Developmental',
    pillClasses: 'bg-stone-500/20 text-stone-300',
  },
};

// Ordered for dropdowns + sort.
export const TIER_ORDER: ProspectTier[] = [
  ProspectTier.S_TIER_FLAGSHIP,
  ProspectTier.A_TIER_FLAGSHIP,
  ProspectTier.B_TIER_FLAGSHIP,
  ProspectTier.COMMERCIAL_SPECIALIST,
  ProspectTier.DEVELOPMENTAL,
];

/** Numeric rank for sortProspects (lower = surfaces first). Null = last. */
export function tierRank(tier: ProspectTier | null | undefined): number {
  if (!tier) return Number.POSITIVE_INFINITY;
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}
```

The S-tier gets an extra subtle ring to visually differentiate it from A/B flagships — three different intensities of "flagship" benefit from a hierarchy cue beyond color alone. Amber (gold) for S is the one non-canonical palette entry and intentionally echoes the existing orange/amber exceptions documented in MASTER.md.

### Card: render pill

In `frontend/src/components/outreach/ColdCallsTab.tsx` (`CallProspectCard`), directly above the existing `script_label` pill block. When both are set, they stack (tier on top, script_label below). Each is a standalone line; no merged layout.

```tsx
{prospect.tier && (() => {
  const meta = TIER_META[prospect.tier];
  return (
    <div className="mb-1.5">
      <span
        className={cn(
          'inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md',
          meta.pillClasses,
        )}
        title={meta.fullLabel}
      >
        {meta.pillLabel}
      </span>
    </div>
  );
})()}
```

### Modal: tier select

In `frontend/src/components/outreach/CallProspectDetailModal.tsx`, new field between Script Label and Callback:

```tsx
<div>
  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
    Tier
  </label>
  <select
    value={tier ?? ''}
    onChange={(e) => setTier((e.target.value || null) as ProspectTier | null)}
    className={cn(inputClasses, 'cursor-pointer appearance-none')}
  >
    <option value="">— None —</option>
    {TIER_ORDER.map((t) => (
      <option key={t} value={t}>{TIER_META[t].fullLabel}</option>
    ))}
  </select>
</div>
```

`tier` joins the existing form-state hooks and reset effect; `updateMutation.mutationFn` sends `tier: tier ?? null` in the payload.

### Floating action bar: "Set tier" popover

Mirror the existing `bulkUpdateLabelMutation` + `isLabelPopoverOpen` / `labelInput` state + popover JSX. Add:

- `isTierPopoverOpen` state
- `bulkUpdateTierMutation` using a new `coldCallsApi.bulkUpdateTier(ids, tier)`
- A `Set tier` button in the bar (between `Set label` and `Delete`)
- A popover with 5 radio-style buttons (one per tier) + `Clear tier` + `Cancel`

Popover content uses the same pill color tokens so the user previews what they're about to apply.

### Sort

Extend `SortKey` in `frontend/src/lib/sortProspects.ts`:

- Add `'tier_asc'`.
- Add `{ key: 'tier_asc', label: 'Tier · S → Developmental' }` to `SORT_OPTIONS` (inserted right after `callback_asc`, before `created_desc`).
- Add a comparator that projects `tier` to its numeric rank via `tierRank`, then compares numbers. Using the existing `nullsLast` helper: `nullsLast((p) => p.tier ?? null, 1, (a, b) => tierRank(a) - tierRank(b))`. The helper strips null cards to the end; non-null cards compare by rank (lower rank = higher priority = surfaces first).

### API client

Extend `coldCallsApi` in `frontend/src/lib/api.ts` with:

```typescript
bulkUpdateTier: async (ids: number[], tier: ProspectTier | null): Promise<{ updated_count: number }> => {
  const res = await fetch(`${API_BASE}/cold-calls/bulk-update-tier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ids, tier }),
  });
  if (!res.ok) throw new Error('Failed to bulk-update tier');
  return res.json();
},
```

(Pattern matches `bulkUpdateLabel` — copy its auth header logic.)

---

## Component / file changes

| File | Change |
|---|---|
| `backend/app/models/call_prospect.py` | Add `ProspectTier` enum + `tier` column (String(30), nullable). |
| `backend/app/schemas/call_prospect.py` | Add `ProspectTier` enum + `tier` on Base/Update schemas + `BulkTierRequest`/`BulkTierResponse`. |
| `backend/app/routes/cold_calls.py` | Add `POST /bulk-update-tier` endpoint mirroring bulk-update-label. |
| `backend/alembic/versions/tier_2026_04_22_add_tier_to_call_prospects.py` *(new)* | Hand-written migration adding the column. |
| `frontend/src/types/index.ts` | Add `ProspectTier` enum + `tier` field on 3 interfaces. |
| `frontend/src/lib/tierMeta.ts` *(new)* | `TIER_META`, `TIER_ORDER`, `tierRank`. |
| `frontend/src/lib/api.ts` | Add `bulkUpdateTier`. |
| `frontend/src/lib/sortProspects.ts` | Add `tier_asc` key + option + comparator. |
| `frontend/src/components/outreach/CallProspectDetailModal.tsx` | Tier `<select>` field. |
| `frontend/src/components/outreach/ColdCallsTab.tsx` | Tier pill on card; `Set tier` button + popover in floating action bar. |

No files exceed 1250 lines after changes.

---

## Edge cases

- **Untagged card:** no pill renders. Card height shrinks accordingly.
- **Tier present, script_label absent:** tier pill renders alone.
- **Both tier + script_label + callback pill + vertical pill:** four small stacked pills at the top of the card. Existing cards already handle 2-3 pills cleanly; a fourth doesn't break layout (they all use `mb-*` for vertical rhythm).
- **Setting tier via bulk action bar while the kanban filter is on:** updates apply to all selected prospects regardless of filter visibility — matches the existing `bulk-update-label` behavior.
- **Dropping a tier (selecting "— None —" in modal, or "Clear tier" in bulk popover):** sends `tier: null` to the backend. Backend sets column to NULL.
- **Legacy data (all existing rows) come back as `tier: null`:** nothing to migrate beyond adding the column.

---

## Rollout

Single PR. Migration + backend schema + frontend UI land together, matching the previous callback feature's rollout pattern. Per user memory "local backend connects to live Render Postgres," the migration step requires explicit user authorization before applying — same flow as the previous two features.

---

## Open questions

None for v1. Filter-by-tier, quotas, and history are deferred.
