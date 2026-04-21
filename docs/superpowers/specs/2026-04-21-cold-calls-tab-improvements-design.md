# Cold Calls Tab — Script Labels + Kanban Scroll Fix

**Date:** 2026-04-21
**Scope:** Outreach Hub → Cold Calls tab (`frontend/src/components/outreach/ColdCallsTab.tsx`)

---

## Context

Two related quality-of-life improvements to the Cold Calls tab, both surfaced in the same session. Bundled because they touch the same file and ship together.

1. **Horizontal scroll pain.** The kanban row uses `overflow-x-auto` with no height constraint. Once any column stacks a meaningful number of cards, the page grows tall and the horizontal scrollbar sinks below the viewport. With a multi-step campaign, the user must scroll vertically to reach the scrollbar, scroll horizontally to see later steps, then scroll back up. The user currently has enough prospects that this happens every time they open the tab.

2. **No way to mark cards for A/B testing scripts.** The user splits cold-call prospects between two (or more) phone scripts to A/B test. There is no affordance to mark which script variant a given prospect was called with, so running the test relies on external tracking.

---

## Goal 1 — Kanban fits the viewport + mouse-wheel scrolls horizontally

### Approach

Constrain the kanban to a bounded height so the horizontal scrollbar stays in the viewport. Make each column scroll vertically inside itself so the page itself does not grow tall from column contents. Add a mouse-wheel handler that translates vertical wheel into horizontal scroll when hovering the kanban, so the user never has to find the scrollbar at all.

Self-contained in `ColdCallsTab.tsx`. No refactor of `OutreachHub.tsx` (the hero header has fixed vertical space; chaining flex all the way down from the page root is more disruption than the win justifies).

### Height strategy

- Kanban scroll container: `h-[calc(100vh-22rem)] min-h-[480px]`.
  - `22rem` (352px) is the combined vertical space of hero header + tabs + stats bar + campaign selector + kanban heading row. Starting estimate — plan step should measure the actual stack in dev tools and adjust before implementation. Off by 24–48px is acceptable; the scrollbar will still be in-viewport.
  - `min-h-[480px]` guarantees usable space on short screens (kanban simply begins scrolling vertically off the page rather than collapsing).
- Cards container inside each column: `flex-1 min-h-0 overflow-y-auto pr-1 space-y-2`.
  - `pr-1` reserves room for the scrollbar without shoving content.
- Column root: `h-full flex flex-col min-h-0` so the cards container can claim the remaining space below the column header.

### Wheel-to-horizontal handler

New hook `frontend/src/hooks/useWheelToHorizontalScroll.ts`. Signature:

```ts
function useWheelToHorizontalScroll(ref: React.RefObject<HTMLElement>): void
```

Behavior:

1. Attaches a non-passive `wheel` listener on mount, detaches on unmount.
2. Bails if `Math.abs(e.deltaX) > Math.abs(e.deltaY)` — the user is already scrolling horizontally (trackpad two-finger), do not double-apply.
3. Bails if the wheel target sits inside a column with `data-col-scroll` attribute AND that column can still scroll vertically in the wheel direction. Lets internal column scroll handle its own deltas.
4. Otherwise `preventDefault()` and sets `container.scrollLeft += e.deltaY`.

Applied to the kanban horizontal container in `ColdCallsTab`. Left in a generic location because the same hook will serve `MultiTouchCampaignsTab` and `WarmLeadsTab` if adopted later (out of scope for this change).

### `data-col-scroll` attribute

Column inner cards containers get `data-col-scroll` on the scrolling element. Used by the wheel handler to identify "legitimate vertical scroll regions".

### Files touched

- `frontend/src/components/outreach/ColdCallsTab.tsx` — layout, wheel hook wiring, `data-col-scroll` attribute on column scroll containers.
- `frontend/src/hooks/useWheelToHorizontalScroll.ts` — new.

### Testing

- Populate a column with 30+ cards. Column scrolls internally; page does not grow taller than the viewport from column content.
- Horizontal scrollbar on the kanban is always visible without any vertical scroll.
- Hover kanban empty area or column header, mouse wheel → kanban scrolls sideways.
- Hover inside a column with cards overflowing, mouse wheel → column scrolls vertically; keep scrolling past the column's bottom/top → kanban then scrolls sideways.
- Trackpad two-finger horizontal scroll unaffected.
- Drag-drop between columns still works; drag auto-scroll near column edges still works.

### Known risk

`@hello-pangea/dnd` auto-scroll interacts with scroll containers. The existing portal-on-drag logic at `ColdCallsTab.tsx:350–352` handles the outer transform issue. Verify auto-scroll still triggers near the bottom of a column with internal scroll — if it misbehaves, the fix is to ensure `provided.droppableProps` (which carry `data-rbd-droppable-id`) remain on the DOM element that actually scrolls.

---

## Goal 2 — Script label per prospect (free text, bulk-assignable)

### Data model

Add one nullable column to `call_prospects`:

```
script_label  VARCHAR(50)  NULL
```

Free text. No enum, no index. `NULL` or empty string = no label. 50 chars is enough for labels like `Script A - Mobile Opener v2` and short enough that the card badge cannot blow out the card width.

Alembic migration written by hand. Per the project's autogenerate-drift rule, any `--autogenerate` output is discarded; the migration file contains exactly one `op.add_column` in `upgrade()` and one `op.drop_column` in `downgrade()`.

### Backend

**`backend/app/models/call_prospect.py`**
- Add `script_label = Column(String(50), nullable=True)` on `CallProspect`, placed near `notes`.

**`backend/app/schemas/call_prospect.py`**
- `CallProspectBase`: add `script_label: Optional[str] = Field(None, max_length=50)`. Flows into `CallProspectCreate` and `CallProspectResponse` automatically.
- `CallProspectUpdate`: add the same optional field.

**`backend/app/routes/call_prospects.py`**
- Existing `PUT /api/cold-calls/{id}` uses `model_dump(exclude_unset=True)` and loops `setattr` — picks up `script_label` for free, no route change.
- Existing `POST /api/cold-calls` constructs `CallProspect(...)` explicitly; add `script_label=data.script_label` to the constructor call so new prospects carry it too.
- **New route** `POST /api/cold-calls/bulk-update-label`:

```python
class BulkLabelRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)
    script_label: Optional[str] = Field(None, max_length=50)

class BulkLabelResponse(BaseModel):
    updated_count: int

@router.post("/bulk-update-label", response_model=BulkLabelResponse)
def bulk_update_label(payload: BulkLabelRequest, db: Session = Depends(get_db)):
    cleaned = (payload.script_label or "").strip() or None
    updated = (
        db.query(CallProspect)
        .filter(CallProspect.id.in_(payload.ids))
        .update({"script_label": cleaned}, synchronize_session=False)
    )
    db.commit()
    return BulkLabelResponse(updated_count=updated)
```

Empty-string input is normalized to `NULL` on the server so the "Clear label" UI affordance has one unambiguous shape.

### Frontend types + API

**`frontend/src/types/index.ts`**
- `CallProspect`: add `script_label?: string | null`.
- `CallProspectUpdate`: add `script_label?: string | null`.

**`frontend/src/lib/api.ts`**
- `coldCallsApi.bulkUpdateLabel(ids: number[], label: string | null): Promise<{ updated_count: number }>`.

### Label color mapping

New file `frontend/src/lib/scriptLabelColor.ts`:

```ts
const LABEL_PALETTE = [
  { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  { bg: 'bg-blue-500/15',   text: 'text-blue-400' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  { bg: 'bg-emerald-500/15',text: 'text-emerald-400' },
  { bg: 'bg-rose-500/15',   text: 'text-rose-400' },
  { bg: 'bg-amber-500/15',  text: 'text-amber-400' },
  { bg: 'bg-sky-500/15',    text: 'text-sky-400' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
] as const;

export function getScriptLabelTokens(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash) + label.charCodeAt(i);
    hash |= 0;
  }
  return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length];
}
```

Deterministic: same label string → same palette entry. No user config.

Stone-palette-safe: all swatches use outreach-hub-approved Tailwind accents (`blue`, `purple`, `emerald`, `rose`, `amber`, `sky`, `indigo`, `orange`). `orange` is already a documented acceptable color in the outreach exception list (MASTER.md §13 #4).

### Card UI

In `CallProspectCard` (around `ColdCallsTab.tsx:240`), render the badge directly below the business-name `<h4>` and above the `personLine` paragraph:

```tsx
{prospect.script_label && (
  <div className="mb-1.5">
    <span
      className={cn(
        'inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md',
        getScriptLabelTokens(prospect.script_label).bg,
        getScriptLabelTokens(prospect.script_label).text,
      )}
    >
      {prospect.script_label}
    </span>
  </div>
)}
```

Visually sits between business name and person line — high-signal spot without competing with the vertical tag further down. Rounded `-md` (fits the outreach 4-tier radius scale), `/15` bg opacity (matches the existing accent-tinted badges in the file), uppercase+tracking matches the existing vertical badge pattern.

### Bulk assign — floating action bar

Add a **"Set label"** button between "Clear" and "Delete" in the existing floating bar (around `ColdCallsTab.tsx:850`). Uses the lucide `Tag` icon. Styling mirrors the existing "Clear" button (`bg-stone-700/70 hover:bg-stone-600/70`).

Clicking opens an inline popover anchored directly above the floating bar (same fixed positioning, higher `bottom`). Popover contains:

- Text input, placeholder `"Script A"`, `maxLength={50}`
- **Apply** button — primary (`bg-[--exec-accent] hover:bg-[--exec-accent-dark]`); disabled when input is empty (for clearing, use the Clear button)
- **Clear label** button — secondary (`bg-stone-700/50`); sends `null`
- **Cancel** button — ghost

The popover is NOT a modal. No backdrop, no Pattern A/B framing. It is a small floating panel part of the floating bar UI family. Rendered in the same `createPortal(..., document.body)` as the floating bar.

### Mutation (bulk)

`bulkUpdateLabelMutation` follows the same optimistic-update pattern as `bulkDeleteMutation` at `ColdCallsTab.tsx:623`:

```ts
onMutate — cancel outgoing queries, snapshot current list, optimistically set script_label on each selected prospect, return snapshot
onError — roll back from snapshot, toast "Failed to update labels"
onSuccess — toast "Labeled N prospects" (or "Cleared labels from N prospects"), clearSelection(), closePopover(), invalidate ['call-prospects']
```

### Detail modal

Add a `Script Label` field to `CallProspectDetailModal` in the "Business / Contact" section alongside other free-text fields (near `vertical` or `source`). Uses the standard outreach `inputClasses` spec (Pattern A / §5.3.1 of MASTER.md). Single field, no styling deviation. Sends `script_label` via the existing single-update endpoint.

### Files touched

- `backend/app/models/call_prospect.py`
- `backend/app/schemas/call_prospect.py`
- `backend/app/routes/call_prospects.py`
- `backend/alembic/versions/<hash>_add_script_label_to_call_prospects.py` — new, hand-written
- `frontend/src/types/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/scriptLabelColor.ts` — new
- `frontend/src/components/outreach/ColdCallsTab.tsx` — card badge + floating-bar button + popover + mutation
- `frontend/src/components/outreach/CallProspectDetailModal.tsx` — new field

### Testing

- Assign "Script A" to 5 prospects via bulk bar → all 5 show a pill, all 5 the same color.
- Assign "Script B" to 5 different prospects → distinct stable color vs A.
- Reload page → colors persist.
- Clear label via bulk bar → pills disappear on those prospects.
- Edit single prospect via detail modal → pill updates in-place on the card after save.
- Blank input applied → treated as clear (backend normalizes empty → null).
- 51-char input → server 422 validation error, toast surfaces "script_label too long" (or the Pydantic message). Out of scope to pretty this up.
- Bulk-assign 0 selected → button not reachable (floating bar only renders on `selectedIds.size > 0`).

---

## Shared testing

- Dark mode only (outreach hub is dark-only, `dark:` prefixes banned per MASTER.md).
- Drag a prospect from one column to another with the new internal scroll → prospect lands correctly, no jumpy re-render.
- Drag a prospect to a scrolled-down column (internal scroll below the visible top) → drop target still works.

---

## Out of scope (explicit)

- Filter or group Cold Calls prospects by script label.
- Analytics / close-rate breakdown by label.
- Preset-label or tag-management UI.
- Propagating the kanban height fix and wheel-to-horizontal hook to other outreach tabs (`MultiTouchCampaignsTab`, `LinkedInCampaignsTab`, `WarmLeadsTab`). Those carry their own kanban patterns and will take their own pass.
- Any modal-pattern changes. Detail modal stays Pattern A, floating bar popover is not a modal.

---

## Not changing

- All 5 documented Outreach Hub exceptions (MASTER.md §13).
- Pattern A / Pattern B modal conventions.
- Existing `outreachStyles.ts` kanban token helpers.
- `@hello-pangea/dnd` wiring beyond verifying it still works.
- The hero header layout in `OutreachHub.tsx`.
