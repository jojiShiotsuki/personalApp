# Cold Calls Tab — Script Labels + Kanban Scroll Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free-text `script_label` per cold-call prospect (for A/B testing scripts) and fix the kanban horizontal scroll UX so the scrollbar stays in the viewport and mouse-wheel translates to horizontal scroll.

**Architecture:** Additive backend column with one new bulk endpoint; additive frontend (types, api helper, card badge, floating-bar popover, detail-modal field, hook, color helper). Kanban layout change scoped to `ColdCallsTab.tsx` — no refactor of `OutreachHub.tsx`.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (SQLite/Postgres), React 18 + TypeScript + TanStack Query + Tailwind, `@hello-pangea/dnd` for drag-and-drop.

**Spec:** `docs/superpowers/specs/2026-04-21-cold-calls-tab-improvements-design.md`

---

## File Structure

### Backend (create)
- `backend/alembic/versions/scr_label_2026_04_21_add_script_label_to_call_prospects.py` — hand-written migration

### Backend (modify)
- `backend/app/models/call_prospect.py` — add `script_label` column
- `backend/app/schemas/call_prospect.py` — add `script_label` to Base + Update schemas, new BulkLabel schemas
- `backend/app/routes/call_prospects.py` — wire `script_label` into the `create` constructor, add `POST /bulk-update-label` endpoint

### Frontend (create)
- `frontend/src/hooks/useWheelToHorizontalScroll.ts` — wheel-to-horizontal hook
- `frontend/src/lib/scriptLabelColor.ts` — deterministic label→palette-token helper

### Frontend (modify)
- `frontend/src/types/index.ts` — add `script_label` to `CallProspect` and `CallProspectUpdate`
- `frontend/src/lib/api.ts` — add `bulkUpdateLabel` on `coldCallsApi`
- `frontend/src/components/outreach/ColdCallsTab.tsx` — kanban layout, wheel hook, card badge, floating-bar "Set label" popover, bulk mutation
- `frontend/src/components/outreach/CallProspectDetailModal.tsx` — Script Label input field, extend update mutation

---

## Task 1: Alembic migration — add `script_label` column

**Files:**
- Create: `backend/alembic/versions/scr_label_2026_04_21_add_script_label_to_call_prospects.py`

- [ ] **Step 1: Write the migration file**

```python
"""add script_label column to call_prospects

Free-text tag for A/B testing phone scripts. Cold-call user labels
prospects (e.g. "Script A", "Script B") to track which variant was
used. Rendered as a deterministic-colored pill on the prospect card.

Nullable, no index, max 50 chars. NULL or empty string = no label.

Revision ID: scr_label_2026_04_21
Revises: add_addl_phones_2026_04_20
Create Date: 2026-04-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "scr_label_2026_04_21"
down_revision: Union[str, None] = "add_addl_phones_2026_04_20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "call_prospects",
        sa.Column("script_label", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("call_prospects", "script_label")
```

- [ ] **Step 2: Apply the migration**

Run from `backend/`:
```bash
venv/Scripts/alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade add_addl_phones_2026_04_20 -> scr_label_2026_04_21, add script_label column to call_prospects
```

- [ ] **Step 3: Verify the column exists**

Run from `backend/`:
```bash
venv/Scripts/alembic current
```

Expected: `scr_label_2026_04_21 (head)`.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/scr_label_2026_04_21_add_script_label_to_call_prospects.py
git commit -m "feat(cold-calls): add script_label column migration"
```

---

## Task 2: Backend model — add `script_label` field

**Files:**
- Modify: `backend/app/models/call_prospect.py`

- [ ] **Step 1: Add the column to `CallProspect`**

Locate the `notes = Column(Text, nullable=True)` line. Add directly below it:

```python
    notes = Column(Text, nullable=True)
    # Free-text tag for A/B testing phone scripts. NULL = no label.
    script_label = Column(String(50), nullable=True)
```

- [ ] **Step 2: Verify Python imports**

`String` is already imported at the top of the file — confirm by opening `backend/app/models/call_prospect.py` and checking the `from sqlalchemy import ...` line contains `String`. No import change needed.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/call_prospect.py
git commit -m "feat(cold-calls): add script_label field to CallProspect model"
```

---

## Task 3: Backend schemas — add `script_label` to Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/call_prospect.py`

- [ ] **Step 1: Add `script_label` to `CallProspectBase`**

Locate:
```python
    notes: Optional[str] = None
    campaign_id: Optional[int] = None
    current_step: int = 1
```

Change to:
```python
    notes: Optional[str] = None
    script_label: Optional[str] = Field(None, max_length=50)
    campaign_id: Optional[int] = None
    current_step: int = 1
```

- [ ] **Step 2: Add `script_label` to `CallProspectUpdate`**

Locate the `notes: Optional[str] = None` line inside `CallProspectUpdate`. Add directly below it:

```python
    notes: Optional[str] = None
    script_label: Optional[str] = Field(None, max_length=50)
    status: Optional[CallStatus] = None
```

- [ ] **Step 3: Add bulk-label request/response schemas**

At the bottom of the file (after `CallProspectCsvImportResponse`), append:

```python


class BulkLabelRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)
    script_label: Optional[str] = Field(None, max_length=50)


class BulkLabelResponse(BaseModel):
    updated_count: int
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/call_prospect.py
git commit -m "feat(cold-calls): add script_label to Pydantic schemas"
```

---

## Task 4: Backend route — bulk label endpoint + create-route wiring

**Files:**
- Modify: `backend/app/routes/call_prospects.py`

- [ ] **Step 1: Update the schema import block**

Locate the existing import block (around line 23):

```python
from app.schemas.call_prospect import (
    CallProspectCreate,
    CallProspectCsvImportRequest,
    CallProspectCsvImportResponse,
    CallProspectResponse,
    CallProspectUpdate,
)
```

Change to:

```python
from app.schemas.call_prospect import (
    BulkLabelRequest,
    BulkLabelResponse,
    CallProspectCreate,
    CallProspectCsvImportRequest,
    CallProspectCsvImportResponse,
    CallProspectResponse,
    CallProspectUpdate,
)
```

- [ ] **Step 2: Wire `script_label` into `create_call_prospect`**

In `create_call_prospect`, locate the `CallProspect(...)` constructor call. The last existing kwarg is `campaign_id=data.campaign_id,`. Insert just above it:

```python
        notes=data.notes,
        script_label=data.script_label,
        status=data.status.value,
        campaign_id=data.campaign_id,
```

(i.e. add `script_label=data.script_label,` between `notes=` and `status=`).

- [ ] **Step 3: Add the bulk-update-label endpoint**

After the existing `bulk_delete_call_prospects` function (ends around line 195), and before `import_call_prospects`, insert:

```python
@router.post("/bulk-update-label", response_model=BulkLabelResponse)
def bulk_update_label(
    payload: BulkLabelRequest,
    db: Session = Depends(get_db),
):
    """Bulk-assign a script label to multiple prospects.

    Empty string or None clears the label — both normalize to NULL in the
    database so the frontend has one unambiguous shape for "no label".
    """
    cleaned = (payload.script_label or "").strip() or None
    updated = (
        db.query(CallProspect)
        .filter(CallProspect.id.in_(payload.ids))
        .update({"script_label": cleaned}, synchronize_session=False)
    )
    db.commit()
    return BulkLabelResponse(updated_count=updated)
```

- [ ] **Step 4: Manual smoke-test via the FastAPI docs UI**

From `backend/`, start the server:
```bash
venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs in a browser. Find `POST /api/cold-calls/bulk-update-label` under the `cold-calls` tag. Click "Try it out", paste body:

```json
{ "ids": [1], "script_label": "Script A" }
```

Expected: `200` response `{ "updated_count": 1 }` (or `0` if ID 1 doesn't exist — either proves the endpoint shape is valid).

Also verify via `GET /api/cold-calls/` that the response payload now includes a `script_label` field on each prospect.

Stop the server (Ctrl+C) when done.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routes/call_prospects.py
git commit -m "feat(cold-calls): add bulk-update-label endpoint and wire script_label into create"
```

---

## Task 5: Frontend types — add `script_label` to `CallProspect` and `CallProspectUpdate`

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add `script_label` to `CallProspect` interface**

In `frontend/src/types/index.ts`, inside `CallProspect` (starts at line ~1659), locate the `notes?: string | null;` line. Add directly below it:

```typescript
  notes?: string | null;
  script_label?: string | null;
```

- [ ] **Step 2: Add `script_label` to `CallProspectUpdate` interface**

In the same file, inside `CallProspectUpdate` (starts at line ~1711), locate the `notes?: string | null;` line. Add directly below it:

```typescript
  notes?: string | null;
  script_label?: string | null;
```

- [ ] **Step 3: Type-check the project**

From `frontend/`:
```bash
npm run type-check
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(cold-calls): add script_label to TypeScript types"
```

---

## Task 6: Frontend API — add `bulkUpdateLabel` method

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add `bulkUpdateLabel` to `coldCallsApi`**

Locate the `bulkDelete` method inside `coldCallsApi` (around line 1635):

```typescript
  bulkDelete: async (ids: number[]): Promise<{ deleted_count: number }> => {
    const response = await api.post('/api/cold-calls/bulk-delete', { ids });
    return response.data;
  },
```

Directly below `bulkDelete`, insert:

```typescript
  bulkUpdateLabel: async (
    ids: number[],
    script_label: string | null,
  ): Promise<{ updated_count: number }> => {
    const response = await api.post('/api/cold-calls/bulk-update-label', {
      ids,
      script_label,
    });
    return response.data;
  },
```

- [ ] **Step 2: Type-check**

From `frontend/`:
```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(cold-calls): add bulkUpdateLabel API client method"
```

---

## Task 7: Script label color helper

**Files:**
- Create: `frontend/src/lib/scriptLabelColor.ts`

- [ ] **Step 1: Create the helper file**

```typescript
// Deterministic label → Tailwind palette-token mapping for Cold Calls
// script A/B labels. Same input string always yields the same swatch so
// labels stay visually stable across sessions and prospects.

const LABEL_PALETTE = [
  { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
] as const;

export type ScriptLabelTokens = (typeof LABEL_PALETTE)[number];

export function getScriptLabelTokens(label: string): ScriptLabelTokens {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash << 5) - hash + label.charCodeAt(i);
    hash |= 0;
  }
  return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length];
}
```

- [ ] **Step 2: Type-check**

From `frontend/`:
```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/scriptLabelColor.ts
git commit -m "feat(cold-calls): add deterministic script-label color helper"
```

---

## Task 8: Wheel-to-horizontal scroll hook

**Files:**
- Create: `frontend/src/hooks/useWheelToHorizontalScroll.ts`

- [ ] **Step 1: Create the hook file**

```typescript
import { useEffect } from 'react';

/**
 * Translates vertical mouse-wheel deltas into horizontal scroll on the
 * referenced element. Defers to native vertical scroll when the cursor
 * is over a child that has scrollable vertical content in the wheel
 * direction (identified by the `data-col-scroll` attribute) — that way
 * a kanban column can scroll its own cards before the board slides
 * sideways.
 *
 * No-op when the user is already scrolling horizontally (trackpad
 * two-finger) so the translation does not double-apply.
 */
export function useWheelToHorizontalScroll(
  ref: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const target = e.target as HTMLElement | null;
      const col = target?.closest<HTMLElement>('[data-col-scroll]');
      if (col) {
        const { scrollTop, scrollHeight, clientHeight } = col;
        const scrollingDown = e.deltaY > 0;
        const canScrollMore = scrollingDown
          ? scrollTop + clientHeight < scrollHeight - 1
          : scrollTop > 0;
        if (canScrollMore) return;
      }

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref]);
}
```

- [ ] **Step 2: Type-check**

From `frontend/`:
```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useWheelToHorizontalScroll.ts
git commit -m "feat(cold-calls): add useWheelToHorizontalScroll hook"
```

---

## Task 9: Apply viewport-bound kanban layout + wheel hook in `ColdCallsTab`

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Import the hook**

At the top of `ColdCallsTab.tsx`, find the existing `import { getStepColor } from '@/lib/stepColors';` line. Add directly below:

```typescript
import { useWheelToHorizontalScroll } from '@/hooks/useWheelToHorizontalScroll';
```

Also ensure `useRef` is imported from react — currently line 1 is `import { useEffect, useMemo, useState } from 'react';`. Change to:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 2: Constrain `Column` card container to scroll internally**

In `Column` (around line 460), locate the cards container:

```tsx
          {/* Cards */}
          <div className="space-y-2">
            {prospects.map((prospect, index) => (
```

Change the wrapper div to:

```tsx
          {/* Cards */}
          <div
            data-col-scroll
            className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2"
          >
            {prospects.map((prospect, index) => (
```

Then update the `Column`'s outer droppable wrapper so it establishes the vertical flex context. Locate:

```tsx
          className={cn(
            kanbanColumnClasses,
            kanbanColumnAccents[column.accent],
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
```

Change to:

```tsx
          className={cn(
            kanbanColumnClasses,
            kanbanColumnAccents[column.accent],
            'h-full flex flex-col min-h-0',
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
```

- [ ] **Step 3: Constrain `StepColumn` card container to scroll internally**

In `StepColumn` (around line 390), locate the outer wrapper className:

```tsx
          className={cn(
            'bg-stone-700/30 rounded-xl p-3 border-l border-r border-b border-stone-600/40 min-w-[240px] flex-1',
            'border-t-2 transition-all',
            borderClass,
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
```

Change to:

```tsx
          className={cn(
            'bg-stone-700/30 rounded-xl p-3 border-l border-r border-b border-stone-600/40 min-w-[240px] flex-1',
            'border-t-2 transition-all',
            'h-full flex flex-col min-h-0',
            borderClass,
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
```

Then in the same component, locate the cards container:

```tsx
          {/* Cards */}
          <div className="space-y-2">
            {prospects.map((prospect, index) => (
```

Change to:

```tsx
          {/* Cards */}
          <div
            data-col-scroll
            className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2"
          >
            {prospects.map((prospect, index) => (
```

- [ ] **Step 4: Wire the horizontal scroll container to the hook and bind its height**

Inside the `ColdCallsTab` component body (around line 519, just after the existing `useState` declarations), add a ref:

```typescript
  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);
  useWheelToHorizontalScroll(kanbanScrollRef);
```

Locate the DragDropContext area (around line 790):

```tsx
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {isStepView
```

Change to:

```tsx
          <DragDropContext onDragEnd={handleDragEnd}>
            <div
              ref={kanbanScrollRef}
              className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 h-[calc(100vh-22rem)] min-h-[480px]"
            >
              {isStepView
```

- [ ] **Step 5: Type-check**

From `frontend/`:
```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Manual verification (browser)**

Start backend and frontend:
```bash
# Terminal 1 (from backend/)
venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 (from frontend/)
npm run dev
```

In the browser:
1. Navigate to `http://localhost:5173/outreach?tab=cold-calls`.
2. Confirm the kanban horizontal scrollbar is visible at the bottom of the kanban area without any vertical page scroll.
3. Hover over the kanban empty area (between columns or column header). Scroll the mouse wheel down — the kanban should slide sideways (horizontal).
4. Hover inside a column that has overflow cards. Scroll the mouse wheel — the column should scroll vertically. Continue past the bottom — the kanban should begin sliding sideways.
5. Drag a card from one column to another — drag + drop still works.
6. If any of the above feels off, the likely culprit is the `22rem` subtraction for the header. Adjust up/down in 1rem increments until the kanban height leaves a small buffer below the page bottom.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "fix(cold-calls): bind kanban height to viewport and wheel-scroll horizontally

Constrain the kanban horizontal container to calc(100vh-22rem) with a
480px floor so its scrollbar stays in the viewport. Each column becomes
a vertical flex container; cards scroll inside the column. Wheel hook
attached to the horizontal container translates vertical scroll to
horizontal unless the user is inside a still-scrollable column."
```

---

## Task 10: Render script label badge on `CallProspectCard`

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Import the color helper**

At the top of `ColdCallsTab.tsx`, add (grouped with other `@/lib/` imports):

```typescript
import { getScriptLabelTokens } from '@/lib/scriptLabelColor';
```

- [ ] **Step 2: Render the badge in `CallProspectCard`**

Locate in `CallProspectCard` (around line 240):

```tsx
            <h4 className={cn(
              'text-sm font-semibold text-[--exec-text] line-clamp-2 leading-tight mb-1',
              // Make room for the checkbox in the corner
              'pr-6'
            )}>
              {prospect.business_name}
            </h4>

            {personLine && (
```

Insert the badge block between the `<h4>` and `{personLine && (`:

```tsx
            <h4 className={cn(
              'text-sm font-semibold text-[--exec-text] line-clamp-2 leading-tight mb-1',
              // Make room for the checkbox in the corner
              'pr-6'
            )}>
              {prospect.business_name}
            </h4>

            {prospect.script_label && (() => {
              const tokens = getScriptLabelTokens(prospect.script_label);
              return (
                <div className="mb-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md',
                      tokens.bg,
                      tokens.text,
                    )}
                  >
                    {prospect.script_label}
                  </span>
                </div>
              );
            })()}

            {personLine && (
```

- [ ] **Step 3: Type-check**

From `frontend/`:
```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

With backend + frontend running:
1. In the FastAPI docs UI at http://localhost:8000/docs, use `POST /api/cold-calls/bulk-update-label` with a real prospect ID and `{ "ids": [<id>], "script_label": "Script A" }`.
2. In the browser at `/outreach?tab=cold-calls`, refresh. The labeled card should show an orange pill under the business name.
3. Repeat with `script_label: "Script B"` on a different prospect — should get a different stable color.
4. Clear with `{ "ids": [<id>], "script_label": null }` — pill disappears on refresh.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): render script_label pill on prospect cards"
```

---

## Task 11: "Set label" button and popover in the floating action bar

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Import the `Tag` icon**

Locate the lucide-react import block (around line 10-29):

```typescript
import {
  Upload,
  Plus,
  Circle,
  PhoneOutgoing,
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
  X,
  Check,
} from 'lucide-react';
```

Add `Tag` to the list:

```typescript
import {
  Upload,
  Plus,
  Circle,
  PhoneOutgoing,
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

- [ ] **Step 2: Add popover state and bulk-label mutation**

In the `ColdCallsTab` component body, find the existing `const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);` line. Add directly below:

```typescript
  const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false);
  const [labelInput, setLabelInput] = useState('');
```

Then locate the `bulkDeleteMutation` definition (around line 623). Directly below the end of that `useMutation({...});` block, add:

```typescript
  const bulkUpdateLabelMutation = useMutation({
    mutationFn: ({ ids, label }: { ids: number[]; label: string | null }) =>
      coldCallsApi.bulkUpdateLabel(ids, label),
    onMutate: async ({ ids, label }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>([
        'call-prospects',
        selectedCampaignId,
      ]);
      const idSet = new Set(ids);
      const cleaned = (label ?? '').trim() || null;
      queryClient.setQueryData<CallProspect[]>(
        ['call-prospects', selectedCampaignId],
        (old) =>
          old ? old.map((p) => (idSet.has(p.id) ? { ...p, script_label: cleaned } : p)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['call-prospects', selectedCampaignId], context.previous);
      }
      toast.error('Failed to update labels');
    },
    onSuccess: (result, { label }) => {
      const cleaned = (label ?? '').trim() || null;
      if (cleaned === null) {
        toast.success(`Cleared ${result.updated_count} label${result.updated_count === 1 ? '' : 's'}`);
      } else {
        toast.success(`Labeled ${result.updated_count} prospect${result.updated_count === 1 ? '' : 's'}`);
      }
      clearSelection();
      setIsLabelPopoverOpen(false);
      setLabelInput('');
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
    },
  });
```

- [ ] **Step 3: Add the "Set label" button to the floating bar**

Locate the floating bar block (around line 849):

```tsx
      {selectedIds.size > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-2 px-3 py-2 bg-stone-800 border border-stone-500/70 rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-black/40">
            <span className="text-sm font-semibold text-[--exec-text] px-2">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>,
        document.body
      )}
```

Replace the whole `selectedIds.size > 0 && createPortal(...)` block with:

```tsx
      {selectedIds.size > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {isLabelPopoverOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-stone-800 border border-stone-500/70 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-black/40 p-3">
              <label className="block text-xs font-medium text-[--exec-text-secondary] mb-1.5">
                Label {selectedIds.size} prospect{selectedIds.size === 1 ? '' : 's'}
              </label>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Script A"
                maxLength={50}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && labelInput.trim()) {
                    bulkUpdateLabelMutation.mutate({
                      ids: Array.from(selectedIds),
                      label: labelInput,
                    });
                  }
                  if (e.key === 'Escape') {
                    setIsLabelPopoverOpen(false);
                    setLabelInput('');
                  }
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-stone-900/60 border border-stone-600/40',
                  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                )}
              />
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() =>
                    bulkUpdateLabelMutation.mutate({
                      ids: Array.from(selectedIds),
                      label: labelInput,
                    })
                  }
                  disabled={!labelInput.trim() || bulkUpdateLabelMutation.isPending}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-[--exec-accent] hover:bg-[--exec-accent-dark] rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() =>
                    bulkUpdateLabelMutation.mutate({
                      ids: Array.from(selectedIds),
                      label: null,
                    })
                  }
                  disabled={bulkUpdateLabelMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors disabled:opacity-50"
                >
                  Clear label
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLabelPopoverOpen(false);
                    setLabelInput('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 bg-stone-800 border border-stone-500/70 rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-black/40">
            <span className="text-sm font-semibold text-[--exec-text] px-2">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={() => setIsLabelPopoverOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              Set label
            </button>
            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>,
        document.body
      )}
```

- [ ] **Step 4: Close popover when selection clears**

Locate the existing `clearSelection` function (around line 538):

```typescript
  const clearSelection = () => setSelectedIds(new Set());
```

Change to:

```typescript
  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsLabelPopoverOpen(false);
    setLabelInput('');
  };
```

- [ ] **Step 5: Type-check**

From `frontend/`:
```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Manual verification**

With backend + frontend running:
1. Navigate to `/outreach?tab=cold-calls`.
2. Select 3 prospect cards via the checkbox. Floating bar appears.
3. Click **Set label**. Popover opens above the bar with an input.
4. Type `Script A`. Click **Apply**.
5. Toast: "Labeled 3 prospects". Popover closes, selection clears. The 3 cards now show an orange-tinted pill with "SCRIPT A".
6. Select 3 different prospects. Click **Set label** → **Clear label**. Toast: "Cleared 3 labels" (though these had none, the endpoint still runs).
7. Select 1 prospect. Click **Set label**, type `Script B`, hit **Enter**. Same outcome as clicking Apply.
8. Escape key inside input closes the popover without applying.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): bulk-assign script labels via floating action bar"
```

---

## Task 12: Script Label field in the detail modal

**Files:**
- Modify: `frontend/src/components/outreach/CallProspectDetailModal.tsx`

- [ ] **Step 1: Add a state variable for the label**

Locate the existing state initialization (around line 61):

```typescript
  const [notes, setNotes] = useState(prospect.notes ?? '');
  const [status, setStatus] = useState<CallStatus>(prospect.status);
```

Add directly below:

```typescript
  const [scriptLabel, setScriptLabel] = useState(prospect.script_label ?? '');
```

- [ ] **Step 2: Reset the field when a different prospect is opened**

Locate the existing `useEffect` that resets form state (around line 68):

```typescript
  useEffect(() => {
    setNotes(prospect.notes ?? '');
    setStatus(prospect.status);
    setDescExpanded(false);
  }, [prospect.id, prospect.notes, prospect.status]);
```

Change to:

```typescript
  useEffect(() => {
    setNotes(prospect.notes ?? '');
    setStatus(prospect.status);
    setScriptLabel(prospect.script_label ?? '');
    setDescExpanded(false);
  }, [prospect.id, prospect.notes, prospect.status, prospect.script_label]);
```

- [ ] **Step 3: Send the label on save**

Locate the `updateMutation` (around line 84):

```typescript
  const updateMutation = useMutation({
    mutationFn: () =>
      coldCallsApi.update(prospect.id, {
        notes: notes.trim() ? notes : null,
        status,
      }),
```

Change to:

```typescript
  const updateMutation = useMutation({
    mutationFn: () =>
      coldCallsApi.update(prospect.id, {
        notes: notes.trim() ? notes : null,
        status,
        script_label: scriptLabel.trim() || null,
      }),
```

- [ ] **Step 4: Add the input field to the form**

Locate the Stage select block inside the form (around line 297):

```tsx
            {/* Status dropdown */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Stage
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CallStatus)}
                className={cn(inputClasses, 'cursor-pointer appearance-none')}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
```

Directly below that `</div>` (between the Stage dropdown and the Notes block), insert:

```tsx
            {/* Script label — free text for A/B testing call scripts */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Script Label
              </label>
              <input
                type="text"
                value={scriptLabel}
                onChange={(e) => setScriptLabel(e.target.value)}
                maxLength={50}
                placeholder="e.g. Script A"
                className={inputClasses}
              />
            </div>
```

- [ ] **Step 5: Type-check**

From `frontend/`:
```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Manual verification**

With backend + frontend running:
1. Navigate to `/outreach?tab=cold-calls`. Click any prospect card to open the detail modal.
2. A **Script Label** input appears between Stage and Notes, pre-populated with whatever the prospect currently has (empty string if none).
3. Type `Script B`. Click **Save**. Modal closes. The card shows the pill.
4. Reopen the card. Script Label field shows `Script B`.
5. Clear the field entirely. Click **Save**. The pill disappears from the card.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/outreach/CallProspectDetailModal.tsx
git commit -m "feat(cold-calls): add script_label field to prospect detail modal"
```

---

## Task 13: End-to-end verification with Playwright MCP

**Files:** none modified (verification only)

- [ ] **Step 1: Navigate and verify the kanban fits the viewport**

Use the Playwright MCP to drive the browser:

```
mcp__playwright__browser_navigate({ url: "http://localhost:5173/outreach?tab=cold-calls" })
mcp__playwright__browser_take_screenshot({ filename: "cold-calls-kanban-layout.png" })
```

Inspect the screenshot. Expected: kanban horizontal scrollbar visible at the bottom of the board within the viewport; no long vertical page scroll required to see it.

- [ ] **Step 2: Verify badge rendering**

With a prospect already labeled from Task 11/12 verification:

```
mcp__playwright__browser_snapshot()
```

Confirm the prospect card surfaces the label text (e.g. "SCRIPT A") in the accessibility tree.

- [ ] **Step 3: Verify horizontal scroll via wheel**

If the campaign has enough steps to require horizontal scroll:

```
mcp__playwright__browser_hover({ element: "kanban board empty area", ref: "<ref-from-snapshot>" })
mcp__playwright__browser_evaluate({
  function: "() => document.querySelector('[ref=kanbanScrollRef]')?.scrollLeft"
})
```

(If no easy hover target exists, skip — manual verification already covers this.)

- [ ] **Step 4: Final commit sanity check**

Run:
```bash
git log --oneline -15
```

Expected: 12 commits matching the per-task commits from Tasks 1-12 (prefixed `feat(cold-calls):` / `fix(cold-calls):`).

Run the type-check one final time from `frontend/`:
```bash
npm run type-check
```

Expected: zero errors.

---

## Self-review — spec coverage

| Spec requirement | Task |
|---|---|
| Add `script_label VARCHAR(50) NULL` column | 1, 2 |
| Hand-scrubbed alembic migration | 1 |
| Pydantic schema updates (Base, Update, Response) | 3 |
| `script_label` wired into create route | 4 |
| `POST /bulk-update-label` endpoint | 3, 4 |
| Empty string normalizes to NULL on server | 4 (step 3) |
| `CallProspect` / `CallProspectUpdate` TS types | 5 |
| `coldCallsApi.bulkUpdateLabel` | 6 |
| `getScriptLabelTokens` deterministic hash | 7 |
| `useWheelToHorizontalScroll` hook | 8 |
| Kanban `h-[calc(100vh-22rem)] min-h-[480px]` | 9 |
| Column internal vertical scroll w/ `data-col-scroll` | 9 |
| Card badge placement (below business name, above personLine) | 10 |
| Floating-bar "Set label" button + popover | 11 |
| Bulk-label optimistic mutation | 11 |
| Detail modal Script Label field | 12 |
| No modal backdrop for the popover | 11 (popover uses same portal/positioning family as bar) |
| Drag-drop continues to work | 9 step 6, 13 step 1 |
| Dark-mode only (no `dark:` prefix) | All frontend tasks — no `dark:` variants introduced |

No gaps.
