# Deal Follow-Up Tracking Design

**Date:** 2025-11-11
**Status:** Approved
**Author:** Claude (via brainstorming session)

## Overview

Add follow-up tracking to the deals pipeline to ensure adequate contact with prospects before marking deals as closed-lost. The system will track all interactions with contacts and display progress toward a 5-follow-up minimum, with a soft warning when attempting to close deals prematurely.

## Requirements

### Functional Requirements
- Track all interactions (meetings, emails, calls, notes, social media) as follow-ups
- Display follow-up count on each deal card in the kanban board
- Show warning modal when attempting to move deal to "Closed Lost" with <5 follow-ups
- Allow user to override warning and close deal anyway
- Provide shortcut to add follow-up interaction directly from warning modal
- Count follow-ups from deal creation date onwards
- Track from Lead stage through entire deal lifecycle

### Non-Functional Requirements
- Maintain existing drag-and-drop kanban functionality
- Fast UI response (optimistic updates)
- Clear visual feedback on follow-up progress
- Minimal disruption to current workflow

## Success Criteria

1. Users can see at a glance how many follow-ups have been completed for each deal
2. Users are reminded to complete 5 follow-ups before closing deals as lost
3. Users maintain flexibility to override when necessary
4. New social media interaction type is available for tracking

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Kanban Board                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   Lead   │  │ Prospect │  │Closed Lost│              │
│  │          │  │          │  │           │              │
│  │ ┌──────┐ │  │ ┌──────┐ │  │           │              │
│  │ │Deal  │ │  │ │Deal  │ │  │           │              │
│  │ │3/5 🟡│─┼──┼─│5/5 🟢│─┼──►           │              │
│  │ └──────┘ │  │ └──────┘ │  │           │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                    │                     │
│                                    ▼                     │
│                        ┌──────────────────┐             │
│                        │FollowUpWarning   │             │
│                        │     Modal        │             │
│                        │ ┌──────────────┐ │             │
│                        │ │Add Follow-up │ │             │
│                        │ │Close Anyway  │ │             │
│                        │ └──────────────┘ │             │
│                        └──────────────────┘             │
└─────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │  Backend API         │
                    │  - Count interactions│
                    │  - Return followup   │
                    │    count with deals  │
                    └──────────────────────┘
```

### Data Model Changes

#### Backend

**New Enum Value** (`backend/app/models/crm.py`):
```python
class InteractionType(str, enum.Enum):
    MEETING = "meeting"
    EMAIL = "email"
    CALL = "call"
    NOTE = "note"
    SOCIAL_MEDIA = "social_media"  # NEW
```

**Enhanced Deal Response** (`backend/app/schemas/crm.py`):
```python
class DealResponse(DealBase):
    id: int
    created_at: datetime
    updated_at: datetime
    contact: Optional[ContactResponse] = None
    followup_count: int = 0  # NEW - computed field
```

**Follow-up Count Calculation Logic**:
- Query `crm_interactions` table
- Filter by `contact_id = deal.contact_id`
- Filter by `interaction_date >= deal.created_at`
- Count matching rows
- Include in deal response

#### Frontend

**New Interaction Type** (`frontend/src/types/index.ts`):
```typescript
export enum InteractionType {
  MEETING = "meeting",
  EMAIL = "email",
  CALL = "call",
  NOTE = "note",
  SOCIAL_MEDIA = "social_media",  // NEW
}
```

**Updated Deal Type**:
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
  followup_count: number;  // NEW
}
```

### User Flow

#### Normal Operation
1. User views kanban board
2. Each deal card shows follow-up badge (e.g., "3/5 🟡")
3. User drags deal between stages as normal
4. If moving to any stage except "Closed Lost", no interception occurs

#### Moving to Closed Lost with Insufficient Follow-ups
1. User drags deal with <5 follow-ups to "Closed Lost" column
2. System intercepts before state update
3. Warning modal appears:
   ```
   ⚠️ Insufficient Follow-ups

   You've only followed up 3 times with this prospect.
   Consider reaching out 2 more times before closing this deal.

   [Add Follow-up]  [Close Deal Anyway]
   ```
4. User chooses:
   - **Add Follow-up**: Modal closes, navigates to contact detail page, opens add interaction modal
   - **Close Deal Anyway**: Modal closes, deal moves to Closed Lost, actual_close_date is set

#### Moving to Closed Lost with Sufficient Follow-ups
1. User drags deal with >=5 follow-ups to "Closed Lost"
2. No interception, deal moves normally
3. actual_close_date is set automatically

### UI Components

#### Follow-Up Badge
**Location**: Deal card component
**Display**:
- Format: "X/5" with icon
- Colors:
  - 🔴 Red (0-2 follow-ups): "Needs attention"
  - 🟡 Yellow (3-4 follow-ups): "In progress"
  - 🟢 Green (5+ follow-ups): "Complete"
- Position: Bottom of deal card, left-aligned

**Visual Example**:
```
┌─────────────────────────┐
│ Website Redesign        │
│ Acme Corp               │
│ $5,000                  │
│                         │
│ 3/5 🟡                  │
└─────────────────────────┘
```

#### Follow-Up Warning Modal
**Trigger**: Attempt to move deal with <5 follow-ups to "Closed Lost"
**Content**:
- Warning icon and title
- Current follow-up count
- Suggestion to complete remaining follow-ups
- Two action buttons

**Behavior**:
- Blocks stage update until user makes choice
- "Add Follow-up" button:
  - Closes modal
  - Cancels the stage update
  - Navigates to contact detail (`/contacts` with selected contact)
  - Opens add interaction modal
- "Close Deal Anyway" button:
  - Closes modal
  - Proceeds with stage update to closed_lost
  - Sets actual_close_date

## Implementation Phases

### Phase 1: Backend Foundation
1. Add `SOCIAL_MEDIA` to InteractionType enum
2. Create database migration if needed (ALTER TABLE for enum)
3. Update interaction schemas to support new type
4. Add follow-up count calculation to deal queries
5. Update DealResponse schema with followup_count field
6. Test API endpoint returns correct counts

### Phase 2: Frontend Data Layer
1. Update TypeScript InteractionType enum
2. Update Deal type with followup_count field
3. Update API client types
4. Add social media option to interaction forms

### Phase 3: Visual Indicator
1. Create or update DealCard component with follow-up badge
2. Implement color-coding logic (red/yellow/green)
3. Test badge displays correctly on all deal cards

### Phase 4: Intercept Logic
1. Create FollowUpWarningModal component
2. Add interception logic to KanbanBoard onDragEnd handler
3. Implement "Add Follow-up" navigation flow
4. Implement "Close Deal Anyway" override
5. Test modal appears only when appropriate

### Phase 5: Integration Testing
1. Test end-to-end: create deal → add interactions → attempt close
2. Verify counts update in real-time
3. Test edge cases (exactly 5 follow-ups, 0 follow-ups)
4. Verify navigation flow from warning modal works
5. Test override functionality

## Technical Considerations

### Performance
- Follow-up count calculation happens at query time
- Use JOIN query to avoid N+1 problem when fetching multiple deals
- Consider caching if performance becomes an issue with many deals
- Optimistic updates maintain UI responsiveness

### Data Consistency
- Interaction dates must be >= deal created_at to count
- Follow-up count is computed, not stored (ensures consistency)
- Deal stage update and actual_close_date update are atomic

### Edge Cases
1. **Deal with no contact**: Should not occur (contact_id is required), but handle gracefully
2. **Interactions created before deal**: Only count interactions after deal creation
3. **Deal moved away from closed_lost then back**: Count should remain accurate
4. **Multiple interactions on same day**: All count separately
5. **User deletes interactions**: Count decreases automatically (computed field)

## Alternative Approaches Considered

### Option 1: Follow-up Checklist in Deal Detail (Rejected)
**Pros**: More structured, could track specific follow-up tasks
**Cons**: Requires opening deal to see status, more UI complexity
**Reason for rejection**: Less visible, interrupts kanban workflow

### Option 2: Automated Stage Progression Rules (Rejected)
**Pros**: Enforces discipline strictly
**Cons**: Too rigid, removes user flexibility
**Reason for rejection**: User wanted soft warning, not hard enforcement

### Option 3: Store follow-up count in database (Rejected)
**Pros**: Faster queries
**Cons**: Data duplication, sync issues, more complex updates
**Reason for rejection**: Computed field ensures consistency, performance is adequate

## Testing Strategy

### Unit Tests
- Backend: Test followup_count calculation with various interaction scenarios
- Frontend: Test badge color logic for different counts
- Frontend: Test modal display logic

### Integration Tests
- Test full drag-drop flow with warning
- Test "Add Follow-up" navigation
- Test override functionality
- Test count updates after adding/removing interactions

### Manual Testing Checklist
- [ ] Badge displays on all deal cards
- [ ] Colors are correct (red/yellow/green)
- [ ] Modal appears when dragging to closed_lost with <5 follow-ups
- [ ] Modal does not appear with >=5 follow-ups
- [ ] "Add Follow-up" navigates correctly
- [ ] "Close Deal Anyway" proceeds with close
- [ ] Social media interaction type appears in forms
- [ ] Count updates after adding interaction
- [ ] Count updates after deleting interaction

## Future Enhancements

1. **Customizable threshold**: Allow user to configure minimum follow-ups (default: 5)
2. **Follow-up reminders**: Automated reminders to follow up based on time since last interaction
3. **Follow-up templates**: Quick templates for common follow-up messages
4. **Analytics**: Track average follow-ups before close (won vs lost)
5. **Follow-up scheduling**: Integrate with task system to schedule follow-up tasks
6. **Smart suggestions**: AI-powered suggestions for best follow-up timing/method

## Migration Notes

- New InteractionType enum value requires database migration
- Existing deals automatically get followup_count computed from existing interactions
- No data migration needed (computed field)
- Backwards compatible: old clients without followup_count will still work

## Rollout Plan

1. Deploy backend changes first (followup_count is optional field)
2. Test API returns correct counts
3. Deploy frontend changes
4. Monitor for issues
5. Gather user feedback on threshold and UX
