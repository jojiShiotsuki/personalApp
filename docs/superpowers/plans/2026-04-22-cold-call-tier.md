# Cold-Call Prospect Tier Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users tag cold-call prospects with one of 5 quality tiers (S/A/B flagship, Commercial specialist, Developmental), visible on the card as a colored pill, settable per-prospect in the modal and in bulk via the floating action bar, and usable as a sort key.

**Architecture:** Single nullable `tier` column on `call_prospects`. Python + TS enums share the same 5 string values. A `tierMeta.ts` util provides display metadata (full label, pill label, color tokens, rank). Kanban card renders a pill; modal has a `<select>`; floating action bar gains a "Set tier" popover with 6 buttons (5 tiers + Clear). `sortProspects` gains a `tier_asc` key that ranks S→Developmental→null.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), React 18 + TypeScript + TanStack Query + TailwindCSS (frontend). Axios API client. No new deps.

**Spec:** `docs/superpowers/specs/2026-04-22-cold-call-tier-design.md`

**Current alembic head:** `cb_tracking_2026_04_22` (verified via `venv/Scripts/python.exe -m alembic heads`).

---

## Testing Strategy

No frontend unit runner, no backend pytest infra — per repo convention. Verification per task is `npm run build` for frontend and a boot + OpenAPI schema check for backend. Task 10 walks the full UI manually.

---

## File Structure

**Create (3):**
- `backend/alembic/versions/tier_2026_04_22_add_tier_to_call_prospects.py` — hand-written migration.
- `frontend/src/lib/tierMeta.ts` — tier display metadata + rank helper.
- *(no new React components — pill and popover are inline in `ColdCallsTab.tsx`)*

**Modify (8):**
- `backend/app/models/call_prospect.py` — `ProspectTier` enum + `tier` column.
- `backend/app/schemas/call_prospect.py` — `ProspectTier` enum + `tier` field on Base/Update + `BulkTierRequest`/`BulkTierResponse`.
- `backend/app/routes/call_prospects.py` — new `POST /bulk-update-tier` endpoint.
- `frontend/src/types/index.ts` — `ProspectTier` TS enum + `tier` field on 3 interfaces.
- `frontend/src/lib/api.ts` — `coldCallsApi.bulkUpdateTier`.
- `frontend/src/lib/sortProspects.ts` — `tier_asc` key + option + comparator.
- `frontend/src/components/outreach/CallProspectDetailModal.tsx` — Tier `<select>` field.
- `frontend/src/components/outreach/ColdCallsTab.tsx` — card pill + floating-bar popover.

No files exceed 1350 lines after changes (ColdCallsTab grows by ~90 lines; currently ~1180 lines).

---

## Task 1: Add `tier` column + ProspectTier enum to model

**Files:**
- Modify: `backend/app/models/call_prospect.py`

- [ ] **Step 1: Add the ProspectTier enum + column**

Open `backend/app/models/call_prospect.py`. Immediately after the existing `class CallStatus(str, enum.Enum):` block (currently around lines 18-22), insert a new enum:

```python
class ProspectTier(str, enum.Enum):
    S_TIER_FLAGSHIP = "S_TIER_FLAGSHIP"
    A_TIER_FLAGSHIP = "A_TIER_FLAGSHIP"
    B_TIER_FLAGSHIP = "B_TIER_FLAGSHIP"
    COMMERCIAL_SPECIALIST = "COMMERCIAL_SPECIALIST"
    DEVELOPMENTAL = "DEVELOPMENTAL"
```

Then find the `script_label` column (currently around line 54) and insert the new column immediately after it. Replace:

```python
    # Free-text tag for A/B testing phone scripts. NULL = no label.
    script_label = Column(String(50), nullable=True)
    # Scheduled callback time captured when the prospect says "call me back at X".
```

with:

```python
    # Free-text tag for A/B testing phone scripts. NULL = no label.
    script_label = Column(String(50), nullable=True)
    # Prospect quality tier (S/A/B flagship, Commercial specialist, Developmental).
    # Stored as the enum's string value; NULL = untagged. No index — low cardinality
    # (5 values) and filtering/sorting happens client-side.
    tier = Column(String(30), nullable=True)
    # Scheduled callback time captured when the prospect says "call me back at X".
```

- [ ] **Step 2: Verify import and column registration**

From `backend/`:

```bash
venv/Scripts/python.exe -c "from app.models.call_prospect import CallProspect, ProspectTier; print([c.name for c in CallProspect.__table__.columns]); print([t.value for t in ProspectTier])"
```

Expected: column list includes `tier`; enum values list is `['S_TIER_FLAGSHIP', 'A_TIER_FLAGSHIP', 'B_TIER_FLAGSHIP', 'COMMERCIAL_SPECIALIST', 'DEVELOPMENTAL']`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/call_prospect.py
git commit -m "feat(cold-calls): add ProspectTier enum + tier column to CallProspect"
```

---

## Task 2: Hand-written Alembic migration

**Files:**
- Create: `backend/alembic/versions/tier_2026_04_22_add_tier_to_call_prospects.py`

**Per existing repo convention (user memory `feedback_alembic-autogenerate-drift`), do NOT run `alembic --autogenerate`.** Hand-write the migration with exact contents below.

**User memory also says local backend points at live Render Postgres.** Do NOT apply the migration in this task — apply only the file creation + commit. The controller will handle the `alembic upgrade head` step with explicit user authorization after Task 3.

- [ ] **Step 1: Create the migration file**

Write `backend/alembic/versions/tier_2026_04_22_add_tier_to_call_prospects.py`:

```python
"""add tier to call_prospects

Adds tier (nullable String(30)) column for the Cold Calls tier-tagging
feature. Stores ProspectTier enum values as strings (S_TIER_FLAGSHIP,
A_TIER_FLAGSHIP, B_TIER_FLAGSHIP, COMMERCIAL_SPECIALIST, DEVELOPMENTAL).
No index — low cardinality, client-side sort/filter.

Revision ID: tier_2026_04_22
Revises: cb_tracking_2026_04_22
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'tier_2026_04_22'
down_revision = 'cb_tracking_2026_04_22'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'call_prospects',
        sa.Column('tier', sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    with op.batch_alter_table('call_prospects', schema=None) as batch_op:
        batch_op.drop_column('tier')
```

- [ ] **Step 2: Commit the migration file (do NOT apply)**

```bash
git add backend/alembic/versions/tier_2026_04_22_add_tier_to_call_prospects.py
git commit -m "feat(cold-calls): migration for tier column on call_prospects"
```

Report the commit SHA clearly so the controller knows to pause for user authorization before applying.

---

## Task 3: Extend schemas + bulk-update-tier endpoint

**Files:**
- Modify: `backend/app/schemas/call_prospect.py`
- Modify: `backend/app/routes/call_prospects.py`

- [ ] **Step 1: Add ProspectTier enum to schemas**

In `backend/app/schemas/call_prospect.py`, add a new enum below the existing `CallStatus` class (around lines 11-15):

```python
class ProspectTier(str, Enum):
    S_TIER_FLAGSHIP = "S_TIER_FLAGSHIP"
    A_TIER_FLAGSHIP = "A_TIER_FLAGSHIP"
    B_TIER_FLAGSHIP = "B_TIER_FLAGSHIP"
    COMMERCIAL_SPECIALIST = "COMMERCIAL_SPECIALIST"
    DEVELOPMENTAL = "DEVELOPMENTAL"
```

- [ ] **Step 2: Add `tier` field on `CallProspectBase`**

Inside `CallProspectBase`, after the `callback_notes: Optional[str] = Field(None, max_length=255)` line (or equivalent final field — adjust for the actual current location), add:

```python
    tier: Optional[ProspectTier] = None
```

- [ ] **Step 3: Add `tier` field on `CallProspectUpdate`**

Inside `CallProspectUpdate`, after its final field (also `callback_notes: Optional[str] = Field(None, max_length=255)` or similar), add:

```python
    tier: Optional[ProspectTier] = None
```

- [ ] **Step 4: Add BulkTier schemas**

At the bottom of `backend/app/schemas/call_prospect.py` (after `BulkLabelResponse`), add:

```python
class BulkTierRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)
    tier: Optional[ProspectTier] = None  # None = clear


class BulkTierResponse(BaseModel):
    updated_count: int
```

- [ ] **Step 5: Register the new endpoint**

In `backend/app/routes/call_prospects.py`:

First, extend the schema import (currently contains `BulkLabelRequest, BulkLabelResponse, ...`). Find the schema import block (near line 26) and add `BulkTierRequest` and `BulkTierResponse` to the imported names.

Then, immediately after the existing `bulk_update_label` endpoint (around line 222, ending with `return BulkLabelResponse(updated_count=updated)`), add:

```python
@router.post("/bulk-update-tier", response_model=BulkTierResponse)
def bulk_update_tier(
    payload: BulkTierRequest,
    db: Session = Depends(get_db),
):
    """Bulk-assign a tier (or clear it) on multiple prospects.

    `tier=None` clears the tier — normalizes to NULL in the DB so the frontend
    has one unambiguous shape for 'no tier'.
    """
    value = payload.tier.value if payload.tier else None
    updated = (
        db.query(CallProspect)
        .filter(CallProspect.id.in_(payload.ids))
        .update({"tier": value}, synchronize_session=False)
    )
    db.commit()
    return BulkTierResponse(updated_count=updated)
```

- [ ] **Step 6: Verify schemas load**

From `backend/`:

```bash
venv/Scripts/python.exe -c "from app.schemas.call_prospect import CallProspectBase, CallProspectUpdate, BulkTierRequest, ProspectTier; print('Base has tier:', 'tier' in CallProspectBase.model_fields); print('Update has tier:', 'tier' in CallProspectUpdate.model_fields); print('BulkTierRequest:', list(BulkTierRequest.model_fields.keys())); print('ProspectTier:', [t.value for t in ProspectTier])"
```

Expected:
```
Base has tier: True
Update has tier: True
BulkTierRequest: ['ids', 'tier']
ProspectTier: ['S_TIER_FLAGSHIP', 'A_TIER_FLAGSHIP', 'B_TIER_FLAGSHIP', 'COMMERCIAL_SPECIALIST', 'DEVELOPMENTAL']
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/call_prospect.py backend/app/routes/call_prospects.py
git commit -m "feat(cold-calls): tier schema fields + bulk-update-tier endpoint"
```

---

## Task 4: Extend TS types + API client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add ProspectTier enum + type fields**

In `frontend/src/types/index.ts`, near the `CallStatus` enum (around line 1652), add the new enum:

```typescript
export enum ProspectTier {
  S_TIER_FLAGSHIP = 'S_TIER_FLAGSHIP',
  A_TIER_FLAGSHIP = 'A_TIER_FLAGSHIP',
  B_TIER_FLAGSHIP = 'B_TIER_FLAGSHIP',
  COMMERCIAL_SPECIALIST = 'COMMERCIAL_SPECIALIST',
  DEVELOPMENTAL = 'DEVELOPMENTAL',
}
```

Then extend the three interfaces:

In `CallProspect` (currently has `script_label?: string | null;` around line 1680), add after `script_label`:

```typescript
  tier: ProspectTier | null;
```

In `CallProspectCreate` (currently has `current_step?: number;` around line 1710), add:

```typescript
  tier?: ProspectTier | null;
```

In `CallProspectUpdate` (currently has `callback_notes?: string | null;` at the end), add:

```typescript
  tier?: ProspectTier | null;
```

- [ ] **Step 2: Add bulkUpdateTier to the API client**

In `frontend/src/lib/api.ts`, find the `bulkUpdateLabel` method inside `coldCallsApi` (around line 1640) and add a sibling method immediately below it. Also extend the type import at the top of the file if needed.

First, ensure `ProspectTier` is imported from `@/types` — find the existing type import block for cold calls (search for `CallProspect,` near where other types are imported for the api module) and add `ProspectTier` to it.

Then add, immediately after the closing `},` of `bulkUpdateLabel`:

```typescript
  bulkUpdateTier: async (
    ids: number[],
    tier: ProspectTier | null,
  ): Promise<{ updated_count: number }> => {
    const response = await api.post('/api/cold-calls/bulk-update-tier', {
      ids,
      tier,
    });
    return response.data;
  },
```

- [ ] **Step 3: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat(cold-calls): add ProspectTier type + bulkUpdateTier API"
```

---

## Task 5: Create `tierMeta.ts` util

**Files:**
- Create: `frontend/src/lib/tierMeta.ts`

- [ ] **Step 1: Create the file**

Write `frontend/src/lib/tierMeta.ts`:

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

/**
 * Display/sort order (surfaces S first, Developmental last). Used by the
 * modal dropdown, the bulk popover, and the tier_asc sort key.
 */
export const TIER_ORDER: readonly ProspectTier[] = [
  ProspectTier.S_TIER_FLAGSHIP,
  ProspectTier.A_TIER_FLAGSHIP,
  ProspectTier.B_TIER_FLAGSHIP,
  ProspectTier.COMMERCIAL_SPECIALIST,
  ProspectTier.DEVELOPMENTAL,
] as const;

/**
 * Numeric rank for sortProspects (lower = surfaces first). Null/unknown
 * returns +Infinity so untagged cards sort last. This lets `sortProspects`
 * reuse its `nullsLast` helper with a numeric comparator.
 */
export function tierRank(tier: ProspectTier | null | undefined): number {
  if (!tier) return Number.POSITIVE_INFINITY;
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}
```

- [ ] **Step 2: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/tierMeta.ts
git commit -m "feat(cold-calls): add tierMeta util with display tokens + rank"
```

---

## Task 6: Extend `sortProspects` with `tier_asc`

**Files:**
- Modify: `frontend/src/lib/sortProspects.ts`

- [ ] **Step 1: Add the `tier_asc` key to the `SortKey` union**

In `frontend/src/lib/sortProspects.ts`, find the `export type SortKey` union (around lines 8-17) and add `'tier_asc'` as a new case. Full replacement:

```typescript
export type SortKey =
  | 'default'
  | 'name_asc'
  | 'name_desc'
  | 'rating_desc'
  | 'rating_asc'
  | 'reviews_desc'
  | 'callback_asc'
  | 'tier_asc'
  | 'created_desc'
  | 'updated_desc';
```

- [ ] **Step 2: Insert the new option into `SORT_OPTIONS`**

Find the `SORT_OPTIONS` array (around lines 26-36). Insert the new option after `callback_asc`, before `created_desc`. Replace:

```typescript
  { key: 'callback_asc', label: 'Callback · soonest' },
  { key: 'created_desc', label: 'Recently added' },
```

with:

```typescript
  { key: 'callback_asc', label: 'Callback · soonest' },
  { key: 'tier_asc', label: 'Tier · S → Developmental' },
  { key: 'created_desc', label: 'Recently added' },
```

- [ ] **Step 3: Import `tierRank` + add the comparator**

At the top of `sortProspects.ts`, extend the imports. Replace:

```typescript
import type { CallProspect } from '@/types';
import { parseBackendDatetime } from './callbackFormat';
```

with:

```typescript
import type { CallProspect } from '@/types';
import { parseBackendDatetime } from './callbackFormat';
import { tierRank } from './tierMeta';
```

Then find the `compareBuilders` record (near the bottom of the file) and add a `tier_asc` entry. Replace:

```typescript
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

with:

```typescript
const compareBuilders: Record<Exclude<SortKey, 'default'>, Comparator> = {
  name_asc: nullsLast((p) => p.business_name, 1, compareStrings),
  name_desc: nullsLast((p) => p.business_name, -1, compareStrings),
  rating_desc: nullsLast((p) => p.rating, -1, compareNumbers),
  rating_asc: nullsLast((p) => p.rating, 1, compareNumbers),
  reviews_desc: nullsLast((p) => p.reviews_count, -1, compareNumbers),
  callback_asc: nullsLast((p) => p.callback_at, 1, compareDatetimes),
  tier_asc: nullsLast(
    (p) => p.tier ?? null,
    1,
    (a, b) => tierRank(a) - tierRank(b),
  ),
  created_desc: nullsLast((p) => p.created_at, -1, compareDatetimes),
  updated_desc: nullsLast((p) => p.updated_at, -1, compareDatetimes),
};
```

- [ ] **Step 4: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sortProspects.ts
git commit -m "feat(cold-calls): add tier_asc sort key"
```

---

## Task 7: Add Tier select to prospect modal

**Files:**
- Modify: `frontend/src/components/outreach/CallProspectDetailModal.tsx`

- [ ] **Step 1: Extend imports**

Add `ProspectTier` to the `@/types` import block. Find:

```typescript
import { CallProspect, CallStatus } from '@/types';
```

Replace with:

```typescript
import { CallProspect, CallStatus, ProspectTier } from '@/types';
```

Then add a new import block after the existing `@/lib/callbackFormat` imports:

```typescript
import { TIER_META, TIER_ORDER } from '@/lib/tierMeta';
```

- [ ] **Step 2: Add tier state hook and reset**

Find the existing `const [scriptLabel, setScriptLabel] = useState(prospect.script_label ?? '');` line. Immediately after it, add:

```typescript
  const [tier, setTier] = useState<ProspectTier | null>(prospect.tier ?? null);
```

In the reset `useEffect` (the one that sets notes/status/scriptLabel/callbackInput/callbackNotes), add `setTier(prospect.tier ?? null);` inside the effect body, and add `prospect.tier` to the dependency array. Replace the current effect (which covers notes, status, script_label, callback_at, callback_notes):

```typescript
  useEffect(() => {
    setNotes(prospect.notes ?? '');
    setStatus(prospect.status);
    setScriptLabel(prospect.script_label ?? '');
    setCallbackInput(
      toLocalInputValue(prospect.callback_at ? parseBackendDatetime(prospect.callback_at) : null),
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

with:

```typescript
  useEffect(() => {
    setNotes(prospect.notes ?? '');
    setStatus(prospect.status);
    setScriptLabel(prospect.script_label ?? '');
    setTier(prospect.tier ?? null);
    setCallbackInput(
      toLocalInputValue(prospect.callback_at ? parseBackendDatetime(prospect.callback_at) : null),
    );
    setCallbackNotes(prospect.callback_notes ?? '');
    setDescExpanded(false);
  }, [
    prospect.id,
    prospect.notes,
    prospect.status,
    prospect.script_label,
    prospect.tier,
    prospect.callback_at,
    prospect.callback_notes,
  ]);
```

- [ ] **Step 3: Wire tier into the update mutation**

Find the `updateMutation.mutationFn` (currently sends notes/status/script_label/callback_at/callback_notes). Add `tier: tier,` to the payload object. Replace the mutation's `mutationFn`:

```typescript
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
```

with:

```typescript
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

- [ ] **Step 4: Render the Tier select in the form**

Find the existing Script Label block inside the `<form>`. It starts with `<label>Script Label</label>` and ends with its `</div>`. Directly after that closing `</div>` and before the Callback section, insert:

```tsx
            {/* Tier — quality classification (S/A/B flagship, Commercial, Developmental) */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Tier
              </label>
              <select
                value={tier ?? ''}
                onChange={(e) =>
                  setTier((e.target.value as ProspectTier) || null)
                }
                className={cn(inputClasses, 'cursor-pointer appearance-none')}
              >
                <option value="">— None —</option>
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TIER_META[t].fullLabel}
                  </option>
                ))}
              </select>
            </div>
```

- [ ] **Step 5: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/outreach/CallProspectDetailModal.tsx
git commit -m "feat(cold-calls): add Tier select to prospect detail modal"
```

---

## Task 8: Render tier pill on prospect card

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Import TIER_META**

Near the other `@/lib` imports in this file (around line 62 — the existing `sortProspects` import block), add:

```typescript
import { TIER_META } from '@/lib/tierMeta';
```

- [ ] **Step 2: Render the tier pill inside `CallProspectCard`**

Find the existing `script_label` pill render block in `CallProspectCard` (search for `{prospect.script_label && (() => {` — around line 298). Immediately before that block (i.e., above the script_label pill in the DOM — tier renders on top), insert:

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

- [ ] **Step 3: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): render tier pill on prospect card"
```

---

## Task 9: Bulk "Set tier" button + popover in floating action bar

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Extend imports**

Ensure these imports exist at the top of `ColdCallsTab.tsx` (add what's missing):

- Extend `@/types` import to include `ProspectTier`:

  Find the existing `@/types` import (search for `CallProspect, CallStatus,`) and add `ProspectTier` to the named imports.

- Extend the `@/lib/tierMeta` import (added in Task 8) to also bring in `TIER_ORDER`:

  Replace:

  ```typescript
  import { TIER_META } from '@/lib/tierMeta';
  ```

  with:

  ```typescript
  import { TIER_META, TIER_ORDER } from '@/lib/tierMeta';
  ```

- The existing `lucide-react` import block already has `Tag` and `X`. Add `Layers` for the tier icon. Find the existing `Tag,` line inside the lucide-react import block and add `Layers,` on a new line immediately after it.

- [ ] **Step 2: Add tier popover state**

Inside `ColdCallsTab` component body, find the existing `const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false);` line (around line 615). Immediately after it, add:

```typescript
  const [isTierPopoverOpen, setIsTierPopoverOpen] = useState(false);
```

- [ ] **Step 3: Extend `clearSelection` to also close the tier popover**

Find the existing `clearSelection` function (around line 631):

```typescript
  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsLabelPopoverOpen(false);
    setLabelInput('');
  };
```

Replace with:

```typescript
  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsLabelPopoverOpen(false);
    setIsTierPopoverOpen(false);
    setLabelInput('');
  };
```

- [ ] **Step 4: Add the `bulkUpdateTierMutation`**

Find the existing `bulkUpdateLabelMutation` declaration (around line 745). Immediately after its closing `});`, add:

```typescript
  const bulkUpdateTierMutation = useMutation({
    mutationFn: ({ ids, tier }: { ids: number[]; tier: ProspectTier | null }) =>
      coldCallsApi.bulkUpdateTier(ids, tier),
    onMutate: async ({ ids, tier }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>([
        'call-prospects',
        selectedCampaignId,
      ]);
      const idSet = new Set(ids);
      queryClient.setQueryData<CallProspect[]>(
        ['call-prospects', selectedCampaignId],
        (old) =>
          old ? old.map((p) => (idSet.has(p.id) ? { ...p, tier } : p)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['call-prospects', selectedCampaignId], context.previous);
      }
      toast.error('Failed to update tiers');
    },
    onSuccess: (result, { tier }) => {
      if (tier === null) {
        toast.success(`Cleared tier on ${result.updated_count} prospect${result.updated_count === 1 ? '' : 's'}`);
      } else {
        toast.success(`Tagged ${result.updated_count} prospect${result.updated_count === 1 ? '' : 's'}`);
      }
      clearSelection();
      setIsTierPopoverOpen(false);
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
    },
  });
```

- [ ] **Step 5: Render the tier popover + button in the floating action bar**

Find the existing label popover JSX (search for `{isLabelPopoverOpen && (` — around line 1047). Immediately after its closing `)}` (the one ending the `isLabelPopoverOpen` conditional block, around line 1124), add the new tier popover:

```tsx
          {isTierPopoverOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-stone-800 border border-stone-500/70 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-black/40 p-3">
              <label className="block text-xs font-medium text-[--exec-text-secondary] mb-2">
                Set tier on {selectedIds.size} prospect{selectedIds.size === 1 ? '' : 's'}
              </label>
              <div className="space-y-1.5">
                {TIER_ORDER.map((t) => {
                  const meta = TIER_META[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (bulkUpdateTierMutation.isPending) return;
                        bulkUpdateTierMutation.mutate({
                          ids: Array.from(selectedIds),
                          tier: t,
                        });
                      }}
                      disabled={bulkUpdateTierMutation.isPending}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left',
                        'bg-stone-900/60 hover:bg-stone-700/60 disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      <span className="text-sm text-[--exec-text]">{meta.fullLabel}</span>
                      <span
                        className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md',
                          meta.pillClasses,
                        )}
                      >
                        {meta.pillLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-stone-700/40">
                <button
                  type="button"
                  onClick={() => {
                    if (bulkUpdateTierMutation.isPending) return;
                    bulkUpdateTierMutation.mutate({
                      ids: Array.from(selectedIds),
                      tier: null,
                    });
                  }}
                  disabled={bulkUpdateTierMutation.isPending}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors disabled:opacity-50"
                >
                  Clear tier
                </button>
                <button
                  type="button"
                  onClick={() => setIsTierPopoverOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
```

Then find the existing `Set label` button (search for `Set label` — around line 1141). Immediately after its closing `</button>`, add the new `Set tier` button:

```tsx
            <button
              onClick={() => {
                setIsLabelPopoverOpen(false);
                setIsTierPopoverOpen((v) => !v);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Set tier
            </button>
```

Also update the existing `Set label` button's onClick to close the tier popover when opening the label one. Replace:

```tsx
            <button
              onClick={() => setIsLabelPopoverOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              Set label
            </button>
```

with:

```tsx
            <button
              onClick={() => {
                setIsTierPopoverOpen(false);
                setIsLabelPopoverOpen((v) => !v);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              Set label
            </button>
```

- [ ] **Step 6: Verify build passes**

From `frontend/`:

```bash
npm run build
```

Expected: build succeeds, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): add bulk Set tier button + popover to floating action bar"
```

---

## Task 10: Smoke test

**Files:** none modified.

Apply the migration BEFORE running the smoke test — the backend will 500 on any write that touches `tier` until the column exists. Per user memory, applying the migration requires explicit user authorization (controller handles this).

- [ ] **Step 1: Full build**

From `frontend/`:

```bash
npm run build
```

Expected: `✓ built in <N>s`.

- [ ] **Step 2: OpenAPI schema check (requires backend running)**

With backend running on port 8000:

```bash
curl -sf http://localhost:8000/openapi.json | python -c "
import sys, json
spec = json.load(sys.stdin)
schemas = spec.get('components', {}).get('schemas', {})
for name in ['CallProspectResponse', 'CallProspectUpdate', 'BulkTierRequest', 'ProspectTier']:
    if name in schemas:
        if 'enum' in schemas[name]:
            print(f'{name} enum:', schemas[name]['enum'])
        else:
            props = list(schemas[name].get('properties', {}).keys())
            print(f'{name} has tier:', 'tier' in props, '  properties:', props[-5:])
    else:
        print(f'{name}: MISSING')
"
```

Expected:
- `CallProspectResponse has tier: True`
- `CallProspectUpdate has tier: True`
- `BulkTierRequest` properties include `ids` and `tier`
- `ProspectTier enum: ['S_TIER_FLAGSHIP', 'A_TIER_FLAGSHIP', 'B_TIER_FLAGSHIP', 'COMMERCIAL_SPECIALIST', 'DEVELOPMENTAL']`

Also verify the bulk-update-tier path exists:

```bash
curl -sf http://localhost:8000/openapi.json | python -c "
import sys, json
spec = json.load(sys.stdin)
paths = [p for p in spec['paths'] if 'tier' in p.lower()]
print('tier paths:', paths)
"
```

Expected: `tier paths: ['/api/cold-calls/bulk-update-tier']`

- [ ] **Step 3: Manual UI walkthrough**

With frontend + backend dev servers running:

1. Open Cold Calls tab. Open a prospect → modal.
2. `Tier` dropdown renders between `Script Label` and `Callback`. Options: `— None —`, `S-tier flagship`, `A-tier flagship`, `B-tier flagship`, `Commercial specialist`, `Developmental`.
3. Select `S-tier flagship` → Save. Card now shows an amber `S · Flagship` pill above the script_label pill (or in its place if script_label is null).
4. Re-open the prospect. Tier dropdown is pre-selected to `S-tier flagship`.
5. Select `— None —` → Save. Pill disappears from card.
6. Select multiple prospects via the card checkboxes. Floating action bar shows `N selected`, `Clear`, `Set label`, `Set tier`, `Delete` in that order.
7. Click `Set tier`. Popover renders above the bar with 5 rows (S-tier, A-tier, B-tier, Commercial, Developmental) — each showing the colored pill on the right. Plus `Clear tier` and `Cancel` at the bottom.
8. Click `A-tier flagship` row. Toast: `Tagged N prospects`. Selection clears. All N cards now show an emerald `A · Flagship` pill.
9. Re-select the same cards, click `Set tier` → `Clear tier`. Toast: `Cleared tier on N prospects`. Pills disappear.
10. Click `Set label` — the tier popover closes (if open). Click `Set tier` — the label popover closes (if open). Mutual exclusion works.
11. Open the sort dropdown in the kanban header. `Tier · S → Developmental` option exists between `Callback · soonest` and `Recently added`.
12. Select that sort option. Cards within each column reorder: S-tier first, then A-tier, B-tier, Commercial, Developmental, untagged cards last.
13. Dark mode check: pills, popover, and dropdown all render correctly with no white backgrounds or low-contrast text.

- [ ] **Step 4: No commit unless fixes needed**

If all checks pass, nothing to commit. If fixes were required, commit each with an appropriate `fix(cold-calls): ...` message.

---

## Out of scope (explicit)

- Filter by tier in the stats bar (deferred — stats bar full at 5 cards).
- Historical audit of tier changes.
- Per-tier quotas or limits.
- Color customization by user.
- Automatic tier assignment based on rating / reviews.
