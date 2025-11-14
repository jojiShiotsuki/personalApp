# Deal Follow-Up Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual follow-up tracking to deals pipeline with soft warning when attempting to close deals without 5 follow-ups.

**Architecture:** Compute follow-up count from interactions table, display as badge on deal cards, intercept closed_lost drag-drop to show warning modal if count < 5.

**Tech Stack:** FastAPI, SQLAlchemy, React, TypeScript, TanStack Query, Tailwind CSS

---

## Task 1: Add SOCIAL_MEDIA Interaction Type (Backend)

**Files:**
- Modify: `backend/app/models/crm.py:27-31`
- Modify: `backend/app/schemas/crm.py:5`

**Step 1: Add SOCIAL_MEDIA to InteractionType enum**

In `backend/app/models/crm.py`, update the InteractionType enum:

```python
class InteractionType(str, enum.Enum):
    MEETING = "meeting"
    EMAIL = "email"
    CALL = "call"
    NOTE = "note"
    SOCIAL_MEDIA = "social_media"  # ADD THIS LINE
```

**Step 2: Verify imports in schemas**

In `backend/app/schemas/crm.py`, verify line 5 imports InteractionType:

```python
from app.models.crm import ContactStatus, DealStage, InteractionType, LeadSource
```

This should already be correct, no changes needed.

**Step 3: Test the enum value exists**

Start Python interpreter:
```bash
cd backend
venv/Scripts/python.exe
```

Run:
```python
from app.models.crm import InteractionType
print(list(InteractionType))
print(InteractionType.SOCIAL_MEDIA.value)
```

Expected output:
```
[<InteractionType.MEETING: 'meeting'>, <InteractionType.EMAIL: 'email'>, <InteractionType.CALL: 'call'>, <InteractionType.NOTE: 'note'>, <InteractionType.SOCIAL_MEDIA: 'social_media'>]
social_media
```

**Step 4: Commit backend enum change**

```bash
git add backend/app/models/crm.py
git commit -m "feat: add SOCIAL_MEDIA interaction type to backend enum"
```

---

## Task 2: Add followup_count to Deal Response (Backend)

**Files:**
- Modify: `backend/app/schemas/crm.py:61-93`
- Modify: `backend/app/routes/crm.py:91-108`

**Step 1: Add followup_count field to DealResponse schema**

In `backend/app/schemas/crm.py`, modify the DealResponse class (around line 61):

```python
class DealResponse(DealBase):
    id: int
    created_at: datetime
    updated_at: datetime
    contact: Optional[ContactResponse] = None
    followup_count: int = 0  # ADD THIS LINE

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def populate_contact(cls, data: Any) -> Any:
        # If data is a SQLAlchemy model instance
        if hasattr(data, '__dict__'):
            # Check if it has a contact relationship loaded
            if hasattr(data, 'contact') and data.contact is not None:
                # Convert to dict and add contact
                result = {
                    'id': data.id,
                    'contact_id': data.contact_id,
                    'title': data.title,
                    'description': data.description,
                    'value': data.value,
                    'stage': data.stage,
                    'probability': data.probability,
                    'expected_close_date': data.expected_close_date,
                    'actual_close_date': data.actual_close_date,
                    'created_at': data.created_at,
                    'updated_at': data.updated_at,
                    'contact': ContactResponse.model_validate(data.contact),
                    'followup_count': getattr(data, 'followup_count', 0)  # ADD THIS LINE
                }
                return result
        return data
```

**Step 2: Update get_deals to compute followup_count**

In `backend/app/routes/crm.py`, replace the get_deals function (lines 91-108) with:

```python
@router.get("/deals", response_model=List[DealResponse])
def get_deals(
    stage: Optional[DealStage] = None,
    contact_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all deals with optional filtering"""
    from sqlalchemy import func

    # Subquery to count interactions per contact after deal creation
    interaction_count_subquery = (
        db.query(
            Deal.id.label('deal_id'),
            func.count(Interaction.id).label('followup_count')
        )
        .outerjoin(
            Interaction,
            (Interaction.contact_id == Deal.contact_id) &
            (Interaction.interaction_date >= Deal.created_at)
        )
        .group_by(Deal.id)
        .subquery()
    )

    # Main query with followup count
    query = (
        db.query(
            Deal,
            func.coalesce(interaction_count_subquery.c.followup_count, 0).label('followup_count')
        )
        .outerjoin(interaction_count_subquery, Deal.id == interaction_count_subquery.c.deal_id)
        .options(joinedload(Deal.contact))
    )

    if stage:
        query = query.filter(Deal.stage == stage)
    if contact_id:
        query = query.filter(Deal.contact_id == contact_id)

    results = query.offset(skip).limit(limit).all()

    # Attach followup_count to each deal object
    deals_with_count = []
    for deal, followup_count in results:
        deal.followup_count = followup_count
        deals_with_count.append(deal)

    return deals_with_count
```

**Step 3: Update get_deal to compute followup_count**

In `backend/app/routes/crm.py`, replace the get_deal function (lines 110-116) with:

```python
@router.get("/deals/{deal_id}", response_model=DealResponse)
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    """Get a single deal by ID"""
    from sqlalchemy import func

    # Count interactions for this deal
    followup_count = (
        db.query(func.count(Interaction.id))
        .join(Deal, Deal.contact_id == Interaction.contact_id)
        .filter(Deal.id == deal_id)
        .filter(Interaction.interaction_date >= Deal.created_at)
        .scalar() or 0
    )

    deal = db.query(Deal).options(joinedload(Deal.contact)).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Attach followup_count to deal object
    deal.followup_count = followup_count
    return deal
```

**Step 4: Test the API returns followup_count**

Start the backend server:
```bash
cd backend
venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8001
```

In another terminal, test the endpoint:
```bash
curl -s http://127.0.0.1:8001/api/crm/deals | python -m json.tool
```

Expected: JSON response with deals, each having a `followup_count` field (likely 0 for now).

**Step 5: Commit backend followup count**

```bash
git add backend/app/schemas/crm.py backend/app/routes/crm.py
git commit -m "feat: add followup_count to deal responses

- Compute count from interactions created after deal
- Include in both get_deals and get_deal endpoints
- Count interactions where interaction_date >= deal.created_at"
```

---

## Task 3: Update Frontend InteractionType Enum

**Files:**
- Modify: `frontend/src/types/index.ts:71-76`

**Step 1: Add SOCIAL_MEDIA to InteractionType enum**

In `frontend/src/types/index.ts`, update the InteractionType enum:

```typescript
export enum InteractionType {
  MEETING = "meeting",
  EMAIL = "email",
  CALL = "call",
  NOTE = "note",
  SOCIAL_MEDIA = "social_media",  // ADD THIS LINE
}
```

**Step 2: Update Deal type with followup_count**

In `frontend/src/types/index.ts`, update the Deal type (around line 101):

```typescript
export type Deal = {
  id: number;
  contact_id: number;
  title: string;
  description?: string;
  value?: number;
  stage: DealStage;
  probability: number;
  expected_close_date?: string;
  actual_close_date?: string;
  created_at: string;
  updated_at: string;
  followup_count: number;  // ADD THIS LINE
}
```

**Step 3: Verify TypeScript compilation**

Run:
```bash
cd frontend
npx tsc -b
```

Expected: No errors.

**Step 4: Commit frontend type changes**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add SOCIAL_MEDIA interaction type and followup_count to Deal type"
```

---

## Task 4: Add Social Media Option to Interaction Forms

**Files:**
- Modify: `frontend/src/components/AddInteractionModal.tsx`

**Step 1: Find AddInteractionModal component**

Check if the component exists:
```bash
cd frontend/src/components
ls -la AddInteractionModal.tsx
```

**Step 2: Add social_media option to type dropdown**

In `frontend/src/components/AddInteractionModal.tsx`, find the interaction type select element and add the social media option:

```typescript
<select
  name="type"
  required
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">Select type...</option>
  <option value={InteractionType.MEETING}>Meeting</option>
  <option value={InteractionType.CALL}>Call</option>
  <option value={InteractionType.EMAIL}>Email</option>
  <option value={InteractionType.NOTE}>Note</option>
  <option value={InteractionType.SOCIAL_MEDIA}>Social Media</option>  {/* ADD THIS LINE */}
</select>
```

**Step 3: Verify TypeScript compilation**

Run:
```bash
cd frontend
npx tsc -b
```

Expected: No errors.

**Step 4: Test the form displays correctly**

Start the frontend dev server:
```bash
cd frontend
npm run dev
```

Open browser to http://localhost:5173, navigate to Contacts, click a contact, click "Add Interaction". Verify "Social Media" appears in the type dropdown.

**Step 5: Commit interaction form update**

```bash
git add frontend/src/components/AddInteractionModal.tsx
git commit -m "feat: add social media option to interaction forms"
```

---

## Task 5: Create Follow-Up Badge Component

**Files:**
- Create: `frontend/src/components/FollowUpBadge.tsx`

**Step 1: Create FollowUpBadge component**

Create `frontend/src/components/FollowUpBadge.tsx`:

```typescript
interface FollowUpBadgeProps {
  count: number;
  target?: number;
}

export default function FollowUpBadge({ count, target = 5 }: FollowUpBadgeProps) {
  // Determine color based on progress
  const getColorClasses = () => {
    if (count >= target) {
      return 'bg-green-100 text-green-700 border-green-300';
    } else if (count >= 3) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    } else {
      return 'bg-red-100 text-red-700 border-red-300';
    }
  };

  const getEmoji = () => {
    if (count >= target) return '🟢';
    if (count >= 3) return '🟡';
    return '🔴';
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getColorClasses()}`}>
      <span>{getEmoji()}</span>
      <span>{count}/{target}</span>
    </div>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run:
```bash
cd frontend
npx tsc -b
```

Expected: No errors.

**Step 3: Commit follow-up badge component**

```bash
git add frontend/src/components/FollowUpBadge.tsx
git commit -m "feat: create FollowUpBadge component with color-coded progress"
```

---

## Task 6: Add Follow-Up Badge to Deal Cards

**Files:**
- Modify: `frontend/src/components/KanbanColumn.tsx`

**Step 1: Import FollowUpBadge in KanbanColumn**

In `frontend/src/components/KanbanColumn.tsx`, add the import at the top:

```typescript
import FollowUpBadge from './FollowUpBadge';
```

**Step 2: Find the deal card rendering section**

Locate where individual deal cards are rendered within KanbanColumn component (likely in the map function that iterates over deals).

**Step 3: Add FollowUpBadge to each deal card**

Find the deal card JSX and add the badge. The card structure will look something like:

```typescript
<Draggable key={deal.id} draggableId={`deal-${deal.id}`} index={index}>
  {(provided, snapshot) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={/* existing classes */}
    >
      {/* Existing card content: title, contact, value, etc. */}

      {/* ADD THIS SECTION - at the bottom of the card */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <FollowUpBadge count={deal.followup_count} />
      </div>
    </div>
  )}
</Draggable>
```

**Step 4: Verify TypeScript compilation**

Run:
```bash
cd frontend
npx tsc -b
```

Expected: No errors.

**Step 5: Test badges display on deals**

With frontend dev server running (npm run dev), open browser to http://localhost:5173/deals. Verify each deal card shows a follow-up badge (likely "🔴 0/5" for deals with no interactions).

**Step 6: Commit follow-up badge integration**

```bash
git add frontend/src/components/KanbanColumn.tsx
git commit -m "feat: display follow-up badges on deal cards"
```

---

## Task 7: Create Follow-Up Warning Modal

**Files:**
- Create: `frontend/src/components/FollowUpWarningModal.tsx`

**Step 1: Create FollowUpWarningModal component**

Create `frontend/src/components/FollowUpWarningModal.tsx`:

```typescript
import { X, AlertTriangle } from 'lucide-react';
import { Deal } from '@/types';

interface FollowUpWarningModalProps {
  deal: Deal;
  onClose: () => void;
  onAddFollowUp: () => void;
  onCloseDealAnyway: () => void;
}

export default function FollowUpWarningModal({
  deal,
  onClose,
  onAddFollowUp,
  onCloseDealAnyway,
}: FollowUpWarningModalProps) {
  const remainingFollowUps = Math.max(0, 5 - deal.followup_count);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-gray-900">
              Insufficient Follow-ups
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              You've only followed up <strong>{deal.followup_count} time{deal.followup_count !== 1 ? 's' : ''}</strong> with this prospect.
            </p>
            <p className="text-gray-600">
              Consider reaching out <strong>{remainingFollowUps} more time{remainingFollowUps !== 1 ? 's' : ''}</strong> before closing this deal.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Studies show that most sales require 5-7 follow-ups before conversion.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onAddFollowUp}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Follow-up
            </button>
            <button
              onClick={onCloseDealAnyway}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close Deal Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run:
```bash
cd frontend
npx tsc -b
```

Expected: No errors.

**Step 3: Commit warning modal component**

```bash
git add frontend/src/components/FollowUpWarningModal.tsx
git commit -m "feat: create FollowUpWarningModal component

- Shows current follow-up count and remaining needed
- Offers 'Add Follow-up' and 'Close Deal Anyway' options
- Includes helpful tip about sales follow-ups"
```

---

## Task 8: Add Intercept Logic to KanbanBoard

**Files:**
- Modify: `frontend/src/components/KanbanBoard.tsx`

**Step 1: Import FollowUpWarningModal and add state**

In `frontend/src/components/KanbanBoard.tsx`, add imports and state:

```typescript
import { useState } from 'react';  // should already exist
import { useNavigate } from 'react-router-dom';  // ADD THIS
import FollowUpWarningModal from './FollowUpWarningModal';  // ADD THIS
import { Deal, DealStage } from '@/types';  // should already exist

// Inside the component, add these state variables after existing ones:
const navigate = useNavigate();  // ADD THIS
const [warningDeal, setWarningDeal] = useState<Deal | null>(null);  // ADD THIS
const [pendingStageUpdate, setPendingStageUpdate] = useState<{
  dealId: number;
  newStage: DealStage;
} | null>(null);  // ADD THIS
```

**Step 2: Update handleDragEnd to intercept closed_lost**

In `frontend/src/components/KanbanBoard.tsx`, replace the `handleDragEnd` function:

```typescript
const handleDragEnd = (result: DropResult) => {
  const { destination, source, draggableId } = result;

  // Dropped outside droppable area
  if (!destination) return;

  // Dropped in same position
  if (
    destination.droppableId === source.droppableId &&
    destination.index === source.index
  ) {
    return;
  }

  // Extract deal ID from draggableId (format: "deal-123")
  const dealId = parseInt(draggableId.replace('deal-', ''));
  const newStage = destination.droppableId as DealStage;

  // Find the deal being moved
  const deal = deals.find(d => d.id === dealId);
  if (!deal) return;

  // Intercept if moving to CLOSED_LOST with insufficient follow-ups
  if (newStage === DealStage.CLOSED_LOST && deal.followup_count < 5) {
    setWarningDeal(deal);
    setPendingStageUpdate({ dealId, newStage });
    return; // Don't proceed with update yet
  }

  // Otherwise proceed with stage update
  updateStageMutation.mutate({ id: dealId, stage: newStage });
};
```

**Step 3: Add warning modal handlers**

In `frontend/src/components/KanbanBoard.tsx`, add these handler functions after `handleDragEnd`:

```typescript
const handleAddFollowUp = () => {
  if (warningDeal) {
    // Navigate to contacts page with the contact selected
    // For now, just navigate to deals page - you can enhance this later
    navigate(`/contacts`);
  }
  setWarningDeal(null);
  setPendingStageUpdate(null);
};

const handleCloseDealAnyway = () => {
  if (pendingStageUpdate) {
    updateStageMutation.mutate({
      id: pendingStageUpdate.dealId,
      stage: pendingStageUpdate.newStage,
    });
  }
  setWarningDeal(null);
  setPendingStageUpdate(null);
};

const handleCloseWarningModal = () => {
  setWarningDeal(null);
  setPendingStageUpdate(null);
};
```

**Step 4: Add warning modal to render**

In `frontend/src/components/KanbanBoard.tsx`, add the modal before the closing `</DragDropContext>`:

```typescript
return (
  <DragDropContext onDragEnd={handleDragEnd}>
    {/* Existing kanban board content */}
    <div className="relative">
      {/* ... existing code ... */}
    </div>

    {/* ADD THIS - Warning Modal */}
    {warningDeal && (
      <FollowUpWarningModal
        deal={warningDeal}
        onClose={handleCloseWarningModal}
        onAddFollowUp={handleAddFollowUp}
        onCloseDealAnyway={handleCloseDealAnyway}
      />
    )}
  </DragDropContext>
);
```

**Step 5: Verify TypeScript compilation**

Run:
```bash
cd frontend
npx tsc -b
```

Expected: No errors.

**Step 6: Test the intercept logic**

With both backend (port 8001) and frontend (port 5173) running:

1. Open http://localhost:5173/deals
2. Create a test deal or use an existing one with 0 follow-ups
3. Try dragging it to "Closed Lost" column
4. Expected: Warning modal appears
5. Click "Close Deal Anyway" - deal should move to closed_lost
6. Try dragging another deal with <5 follow-ups
7. Click "Add Follow-up" - should navigate to contacts page

**Step 7: Commit intercept logic**

```bash
git add frontend/src/components/KanbanBoard.tsx
git commit -m "feat: intercept closed_lost moves with follow-up warning

- Show warning modal if deal has <5 follow-ups
- Allow user to add follow-up or override
- Navigate to contacts when adding follow-up"
```

---

## Task 9: Enhanced Navigation to Contact with Interaction Modal

**Files:**
- Modify: `frontend/src/components/KanbanBoard.tsx`
- Modify: `frontend/src/pages/Contacts.tsx` (if needed)

**Note:** This task enhances the "Add Follow-up" flow to automatically open the add interaction modal when navigating to contacts. This is optional but provides better UX.

**Step 1: Update handleAddFollowUp with contact navigation**

In `frontend/src/components/KanbanBoard.tsx`, update the `handleAddFollowUp` function:

```typescript
const handleAddFollowUp = () => {
  if (warningDeal) {
    // Get the contact associated with this deal
    const contactId = warningDeal.contact_id;

    // Navigate to contacts page
    // TODO: Add support for auto-opening interaction modal
    navigate(`/contacts`);

    // Close the warning modal
    setWarningDeal(null);
    setPendingStageUpdate(null);
  }
};
```

**Step 2: Consider state management for auto-opening modal**

For now, this navigates to contacts page. A future enhancement could use URL params or global state to auto-open the interaction modal for the specific contact. This requires more significant changes to the Contacts page component.

**Step 3: Commit navigation enhancement**

```bash
git add frontend/src/components/KanbanBoard.tsx
git commit -m "refactor: improve follow-up navigation flow"
```

---

## Task 10: Integration Testing

**Files:**
- No file changes, testing only

**Step 1: Test full flow with real data**

With both servers running, perform end-to-end test:

1. **Create a test deal:**
   - Navigate to http://localhost:5173/deals
   - Click "Add Deal"
   - Fill in: Title "Test Deal", Contact (any), Stage "Lead"
   - Save
   - Verify: Deal card shows "🔴 0/5" badge

2. **Add interactions:**
   - Navigate to Contacts
   - Select the contact associated with test deal
   - Add 3 interactions (any type)
   - Navigate back to Deals
   - Verify: Badge now shows "🟡 3/5"

3. **Test warning modal:**
   - Drag test deal to "Closed Lost"
   - Verify: Warning modal appears
   - Verify: Modal shows "You've only followed up 3 times"
   - Click "Add Follow-up"
   - Verify: Navigates to contacts page
   - Verify: Deal did NOT move to closed_lost

4. **Test override:**
   - Navigate back to Deals
   - Drag test deal to "Closed Lost" again
   - Warning modal appears again
   - Click "Close Deal Anyway"
   - Verify: Deal moves to "Closed Lost" column
   - Verify: Modal closes

5. **Test with 5+ follow-ups:**
   - Create another test deal
   - Add 5+ interactions to its contact
   - Drag deal to "Closed Lost"
   - Verify: NO warning modal appears
   - Verify: Deal moves directly to closed_lost

**Step 2: Test edge cases**

1. Deal with exactly 5 follow-ups - should not trigger warning
2. Deal with 0 follow-ups - should show "0/5" and trigger warning
3. Moving deal to other stages - should never trigger warning
4. Badge colors: 0-2 = red, 3-4 = yellow, 5+ = green

**Step 3: Document test results**

Create a test checklist:

```bash
cat > test-results.md << 'EOF'
# Deal Follow-Up Tracking Test Results

## Test Date: $(date)

### Functional Tests
- [ ] Badge displays on all deal cards
- [ ] Badge shows correct count (0-5+)
- [ ] Badge colors: red (0-2), yellow (3-4), green (5+)
- [ ] Warning modal appears when dragging to closed_lost with <5 follow-ups
- [ ] Warning modal does NOT appear with >=5 follow-ups
- [ ] "Add Follow-up" navigates to contacts
- [ ] "Add Follow-up" cancels stage move
- [ ] "Close Deal Anyway" completes stage move
- [ ] Modal close button cancels operation
- [ ] Social media interaction type available in forms

### Integration Tests
- [ ] Follow-up count updates after adding interaction
- [ ] Follow-up count accurate across page refreshes
- [ ] Multiple deals show independent counts
- [ ] Drag-drop to other stages unaffected

### Edge Cases
- [ ] Exactly 5 follow-ups - no warning
- [ ] 0 follow-ups - shows warning
- [ ] Deal without contact (should not occur)
- [ ] Multiple interactions same day - all count

All tests passing: YES/NO
EOF
```

Fill out the checklist based on testing.

**Step 4: Commit test documentation**

```bash
git add test-results.md
git commit -m "docs: add integration test results for follow-up tracking"
```

---

## Task 11: Final Cleanup and Documentation

**Files:**
- Modify: `README.md` (if exists)
- Create: `docs/features/follow-up-tracking.md`

**Step 1: Document the feature**

Create `docs/features/follow-up-tracking.md`:

```markdown
# Deal Follow-Up Tracking

## Overview

Visual tracking of follow-up interactions for deals in the pipeline. Encourages completing 5 follow-ups before closing deals as lost.

## User Interface

### Follow-Up Badge
- Displayed on each deal card in kanban view
- Format: "X/5" with colored emoji
- Colors:
  - 🔴 Red (0-2): Needs attention
  - 🟡 Yellow (3-4): In progress
  - 🟢 Green (5+): Complete

### Warning Modal
- Appears when attempting to move deal with <5 follow-ups to "Closed Lost"
- Shows current count and remaining needed
- Options:
  - **Add Follow-up**: Navigate to contacts to log interaction
  - **Close Deal Anyway**: Proceed with closing the deal

## What Counts as a Follow-Up?

All interactions logged with the deal's associated contact after the deal was created:
- Meetings
- Phone calls
- Emails
- Notes
- Social media interactions

## Technical Details

### Backend
- `InteractionType.SOCIAL_MEDIA` enum value added
- `followup_count` computed field on deal responses
- Count calculated from `crm_interactions` where `interaction_date >= deal.created_at`

### Frontend
- `FollowUpBadge` component for visual indicator
- `FollowUpWarningModal` for soft enforcement
- Intercept logic in `KanbanBoard` for closed_lost stage moves

### Database
No schema changes required - count is computed at query time from existing interactions.

## Future Enhancements
- Customizable follow-up threshold
- Automated follow-up reminders
- Follow-up analytics and reporting
```

**Step 2: Run final TypeScript check**

```bash
cd frontend
npx tsc -b
```

Expected: No errors.

**Step 3: Run final build test**

```bash
cd frontend
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Commit documentation**

```bash
git add docs/features/follow-up-tracking.md
git commit -m "docs: add follow-up tracking feature documentation"
```

**Step 5: Push branch to remote (optional)**

```bash
git push -u origin feature/deal-followup-tracking
```

---

## Verification Checklist

Before marking complete, verify:

- [ ] Backend enum includes SOCIAL_MEDIA
- [ ] Backend API returns followup_count for all deals
- [ ] Frontend types match backend response
- [ ] Social media option in interaction forms
- [ ] Follow-up badge displays on all deal cards
- [ ] Badge colors are correct (red/yellow/green)
- [ ] Warning modal appears correctly
- [ ] Modal "Add Follow-up" button navigates
- [ ] Modal "Close Deal Anyway" button proceeds with close
- [ ] No TypeScript compilation errors
- [ ] Integration tests pass
- [ ] Documentation complete

## Known Limitations

1. "Add Follow-up" navigates to contacts page but doesn't auto-open interaction modal
2. No analytics/reporting on follow-up effectiveness
3. Threshold is hardcoded to 5 (not customizable)
4. No automated reminders for follow-ups

## Next Steps After Implementation

1. Gather user feedback on 5-follow-up threshold
2. Consider adding follow-up templates
3. Add analytics dashboard for follow-up tracking
4. Integrate with task system for scheduling follow-ups
5. Consider adding customizable threshold per deal stage
