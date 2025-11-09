# Kanban Board for Deals - Design Document

**Date:** 2025-11-09
**Status:** Approved for Implementation

## Overview

Transform the Deals page from a table view into a visual Kanban board with drag-and-drop functionality to improve deal pipeline management and visualization.

## Problem Statement

The current Deals page uses a simple table layout that makes it difficult to:
- Visualize the sales pipeline at a glance
- Quickly move deals between stages
- Identify bottlenecks in the pipeline
- Get a sense of deal velocity

A Kanban board provides immediate visual feedback on pipeline health and makes stage transitions intuitive through drag-and-drop.

## Solution

Replace the existing table view with a horizontal Kanban board featuring:
- 6 columns representing deal stages (Lead → Prospect → Proposal → Negotiation → Closed Won/Lost)
- Draggable deal cards that update stage via API when moved
- Rich card information (title, contact, value, days in stage)
- Collapsed closed deals by default to focus on active pipeline
- Responsive design with horizontal scroll on mobile

## Design Approach

**Chosen:** Full Kanban with Drag-and-Drop

Uses @hello-pangea/dnd library for smooth drag-and-drop interactions. Provides the most engaging UX and matches the original design document vision for a "kanban board" feature.

**Rejected alternatives:**
- Simple column view with dropdowns: Less visual, lacks intuitive drag-and-drop
- Hybrid list+board toggle: Unnecessary complexity for initial release, can add later if needed

## Architecture

### Technology Stack

**Library:**
- `@hello-pangea/dnd` v13+ - Modern, maintained fork of react-beautiful-dnd
- Fully accessible (keyboard navigation, screen reader support)
- TypeScript-first with excellent type definitions

**No backend changes required:**
- Uses existing `PUT /deals/{id}` endpoint
- Deal stage update triggers optimistic UI + API call
- Existing deal CRUD operations remain unchanged

### Component Structure

```
frontend/src/pages/Deals.tsx
├── KanbanBoard (new component)
│   ├── DragDropContext (from @hello-pangea/dnd)
│   ├── KanbanColumn × 6 (one per stage)
│   │   ├── Droppable (from @hello-pangea/dnd)
│   │   └── DealCard[] (draggable cards)
│   │       ├── Draggable (from @hello-pangea/dnd)
│   │       ├── Deal title
│   │       ├── Contact name + company
│   │       ├── Value (formatted currency)
│   │       ├── Days in stage indicator
│   │       └── Quick actions (edit, delete)
│   └── FloatingActionButton (Add Deal)
```

### Files to Modify

1. **`frontend/src/pages/Deals.tsx`**
   - Replace table view with KanbanBoard component
   - Keep existing modal for add/edit functionality
   - Maintain existing React Query hooks for data fetching

2. **`frontend/src/components/KanbanBoard.tsx`** (new)
   - Main board container with DragDropContext
   - Handle onDragEnd event to update deal stage
   - Optimistic updates with error rollback

3. **`frontend/src/components/KanbanColumn.tsx`** (new)
   - Droppable column for each stage
   - Header with stage name and count
   - Collapse/expand for Closed Won/Lost columns

4. **`frontend/src/components/DealCard.tsx`** (new)
   - Draggable card with deal information
   - Hover state for edit/delete actions
   - Click to open edit modal

5. **`frontend/package.json`**
   - Add dependency: `@hello-pangea/dnd: ^13.1.0`

### No Backend Changes

All backend functionality exists:
- `GET /deals` - Fetch all deals
- `PUT /deals/{id}` - Update deal (including stage)
- `POST /deals` - Create new deal
- `DELETE /deals/{id}` - Delete deal

## Visual Design

### Column Configuration

| Stage | Color | Status | Default State |
|-------|-------|--------|---------------|
| Lead | Blue (#3B82F6) | Active | Expanded |
| Prospect | Purple (#8B5CF6) | Active | Expanded |
| Proposal | Yellow (#EAB308) | Active | Expanded |
| Negotiation | Orange (#F97316) | Active | Expanded |
| Closed Won | Green (#10B981) | Closed | Collapsed |
| Closed Lost | Red (#EF4444) | Closed | Collapsed |

### Card Layout

```
┌──────────────────────────────┐
│ Deal Title (bold)            │
│ Contact Name · Company       │
│ $50k                         │
│ 14 days in Proposal      [⋮] │
└──────────────────────────────┘
```

**Card Dimensions:**
- Width: 100% of column (column min-width: 280px)
- Height: Auto (min 120px)
- Padding: 16px
- Border-radius: 8px
- Shadow on hover: 0 4px 6px rgba(0,0,0,0.1)

### Responsive Behavior

**Desktop (>1024px):**
- All 6 columns visible side-by-side
- Horizontal scroll if needed

**Tablet (768px-1024px):**
- 4 columns visible, horizontal scroll
- Collapsed closed columns stay collapsed

**Mobile (<768px):**
- 2 columns visible, horizontal scroll
- Larger touch targets (min 44×44px)
- Simplified card layout

## Data Flow

### Drag-and-Drop Flow

```
1. User grabs card
   ↓
2. onDragStart → Store original state
   ↓
3. User drops card in new column
   ↓
4. onDragEnd → Extract deal ID + new stage
   ↓
5. Optimistic update → Move card immediately
   ↓
6. API call → PUT /deals/{id} with {stage: newStage}
   ↓
7a. Success → Invalidate React Query cache
7b. Error → Revert to original state + show toast
```

### State Management

**React Query for data:**
- `useQuery(['deals'])` - Fetch all deals
- `useMutation(updateDeal)` - Update deal stage
- Optimistic updates for instant feedback
- Automatic cache invalidation

**Local state:**
- Column collapse/expand states (useState)
- Active drag state (handled by @hello-pangea/dnd)

## Implementation Details

### Days in Stage Calculation

```typescript
function getDaysInStage(deal: Deal): number {
  const now = new Date();
  const updatedAt = new Date(deal.updated_at);
  const diffTime = Math.abs(now.getTime() - updatedAt.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
```

### Optimistic Update Pattern

```typescript
const updateStageMutation = useMutation({
  mutationFn: ({ id, stage }) => dealApi.update(id, { stage }),
  onMutate: async ({ id, stage }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['deals'] });

    // Snapshot previous value
    const previousDeals = queryClient.getQueryData(['deals']);

    // Optimistically update
    queryClient.setQueryData(['deals'], (old) =>
      old.map(deal => deal.id === id ? { ...deal, stage } : deal)
    );

    return { previousDeals };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['deals'], context.previousDeals);
    toast.error('Failed to update deal stage');
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  },
});
```

### Accessibility

**Keyboard Navigation:**
- Tab to focus on card
- Space/Enter to pick up card
- Arrow keys to move between positions
- Space/Enter to drop card
- Escape to cancel drag

**Screen Reader Support:**
- Announce current position during drag
- Announce drop result
- Label all interactive elements

**Focus Management:**
- Preserve focus after drag-and-drop
- Clear focus indicators

## Error Handling

### Network Errors
- Show error toast with retry option
- Revert optimistic update
- Log error for debugging

### Edge Cases
- **Empty column:** Show placeholder message
- **No deals:** Show empty state with "Add Deal" CTA
- **Concurrent updates:** Last write wins (backend handles)
- **Stale data:** React Query refetches on window focus

## Testing Strategy

### Manual Testing
1. Create deals in different stages
2. Drag deals between columns
3. Verify API updates (check network tab)
4. Test optimistic updates (throttle network to slow 3G)
5. Test error handling (kill backend mid-drag)
6. Test responsive behavior (resize browser)
7. Test keyboard navigation
8. Test with screen reader

### Integration Points
- Verify existing Add/Edit/Delete modals still work
- Verify dashboard metrics update after stage changes
- Verify CEO AI Briefing reflects updated stages

## Success Criteria

1. **Visual Appeal:** Board is visually appealing with color-coded columns
2. **Performance:** Drag-and-drop feels smooth (60fps)
3. **Data Integrity:** All stage updates persist correctly to database
4. **Error Recovery:** Failed updates roll back gracefully
5. **Accessibility:** Fully keyboard navigable and screen reader compatible
6. **Mobile Usable:** Touch interactions work on mobile devices

## Future Enhancements

**Phase 2 (Optional):**
- Quick add: Add deal directly to a column without modal
- Inline editing: Edit deal title/value directly on card
- Filters: Filter deals by contact, value range, or date
- Sorting: Sort cards within columns by value, date, or custom order

**Phase 3 (Optional):**
- Swimlanes: Group deals by contact or priority
- Deal templates: Create deals from templates
- Bulk actions: Select multiple cards and move together
- Customizable stages: Allow users to add custom pipeline stages

## Timeline

**Estimated: 3-4 hours**

1. Install @hello-pangea/dnd and setup (15 min)
2. Create DealCard component (45 min)
3. Create KanbanColumn component (30 min)
4. Create KanbanBoard component (60 min)
5. Integrate with Deals.tsx page (30 min)
6. Add drag-and-drop logic and optimistic updates (45 min)
7. Styling and responsive design (30 min)
8. Testing and polish (30 min)

## Migration Notes

- No data migration required
- No breaking changes to API
- Existing Deals page functionality preserved in modals
- Can roll back by reverting frontend changes only
