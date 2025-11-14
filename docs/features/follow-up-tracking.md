# Deal Follow-Up Tracking

## Overview

Visual tracking of follow-up interactions for deals in the pipeline. Encourages completing 5 follow-ups before closing deals as lost through a soft warning system.

## User Interface

### Follow-Up Badge
- Displayed on each deal card in kanban view
- Format: "X/5" with colored emoji
- Colors:
  - 🔴 Red (0-2): Needs attention
  - 🟡 Yellow (3-4): In progress
  - 🟢 Green (5+): Complete
- Updates in real-time as interactions are added

### Warning Modal
- Appears when attempting to move deal with <5 follow-ups to "Closed Lost"
- Shows current count and remaining needed
- Includes helpful tip about sales best practices
- Options:
  - **Add Follow-up**: Navigate to contacts and auto-open interaction modal
  - **Close Deal Anyway**: Proceed with closing the deal
  - **Close (X)**: Cancel the operation

## What Counts as a Follow-Up?

All interactions logged with the deal's associated contact **after the deal was created**:
- Meetings
- Phone calls
- Emails
- Notes
- Social media interactions (new!)

### Important Notes
- Only interactions created after the deal creation date count
- All interaction types count equally
- Deleting interactions decreases the count
- Multiple interactions on the same day all count separately

## User Workflow

### Normal Operation
1. Create a deal for a contact
2. Deal card shows follow-up badge (initially "🔴 0/5")
3. Add interactions through the contact detail page
4. Badge updates automatically to reflect progress
5. When ready with 5+ follow-ups, move deal to any stage freely

### Insufficient Follow-ups Scenario
1. User attempts to drag deal with <5 follow-ups to "Closed Lost"
2. Warning modal intercepts the operation
3. User can choose to:
   - Add more follow-ups (navigates to contacts, opens interaction modal)
   - Override and close anyway (proceeds with stage change)
   - Cancel (closes modal, no change)

## Technical Details

### Backend
- `InteractionType.SOCIAL_MEDIA` enum value added (`backend/app/models/crm.py`)
- `followup_count` computed field on deal responses (`backend/app/schemas/crm.py`)
- Count calculated from `crm_interactions` where `interaction_date >= deal.created_at`
- Implemented via SQLAlchemy subquery for efficient querying (`backend/app/routes/crm.py`)

### Frontend
- `FollowUpBadge` component (`frontend/src/components/FollowUpBadge.tsx`)
  - Reusable badge with color-coded progress indicators
- `FollowUpWarningModal` component (`frontend/src/components/FollowUpWarningModal.tsx`)
  - Modal dialog for warning and user choice
- Intercept logic in `KanbanBoard` (`frontend/src/components/KanbanBoard.tsx`)
  - Checks followup_count before allowing closed_lost stage moves
  - Passes navigation state to auto-open interaction modal
- Auto-open logic in `Contacts` page (`frontend/src/pages/Contacts.tsx`)
  - Receives navigation state and opens interaction modal for specific contact

### Database
No schema changes required - count is computed at query time from existing interactions table.

## Configuration

### Threshold
Currently hardcoded to 5 follow-ups. This was chosen based on sales best practices indicating most conversions require 5-7 touchpoints.

### Enforcement
Soft warning approach - users can always override if needed. This maintains flexibility while encouraging best practices.

## Performance Considerations

- Follow-up count is computed, not stored (ensures data consistency)
- Efficient JOIN query avoids N+1 problem when loading multiple deals
- Optimistic updates in UI maintain responsiveness

## Future Enhancements

### Planned Features
1. **Customizable threshold**: Allow users to configure minimum follow-ups (default: 5)
2. **Automated reminders**: Send notifications for follow-up tasks
3. **Follow-up templates**: Quick templates for common follow-up messages
4. **Analytics dashboard**: Track average follow-ups before close (won vs lost)
5. **Follow-up scheduling**: Integrate with task system to schedule follow-up tasks
6. **Smart suggestions**: AI-powered suggestions for best follow-up timing/method

### Known Limitations
1. Threshold is hardcoded (not customizable per user/workspace)
2. No analytics or reporting on follow-up effectiveness
3. No automated reminders for follow-ups
4. All interaction types weighted equally (no priority system)

## Testing

See `test-results.md` for the comprehensive test checklist.

### Manual Testing
1. Create test deal with 0 follow-ups
2. Verify badge shows "🔴 0/5"
3. Add 3 interactions
4. Verify badge shows "🟡 3/5"
5. Try to close deal - warning appears
6. Add 2 more interactions
7. Verify badge shows "🟢 5/5"
8. Close deal - no warning

## Deployment Notes

1. Deploy backend changes first (followup_count is optional field)
2. Test API returns correct counts
3. Deploy frontend changes
4. Monitor for issues
5. Gather user feedback on threshold and UX

## Support

### Common Issues

**Q: Badge not updating after adding interaction**
A: Refresh the deals page. The count updates on page load via API call.

**Q: Modal not appearing when closing deal**
A: Check browser console for errors. Ensure deal has valid contact_id.

**Q: Count seems incorrect**
A: Only interactions after deal creation date count. Check interaction timestamps.

**Q: Can I change the threshold from 5?**
A: Not currently - it's hardcoded. This is planned as a future enhancement.

## Related Files

### Backend
- `backend/app/models/crm.py`: InteractionType enum
- `backend/app/schemas/crm.py`: DealResponse with followup_count
- `backend/app/routes/crm.py`: Follow-up count calculation logic

### Frontend
- `frontend/src/components/FollowUpBadge.tsx`: Badge component
- `frontend/src/components/FollowUpWarningModal.tsx`: Warning modal
- `frontend/src/components/KanbanBoard.tsx`: Intercept logic
- `frontend/src/pages/Contacts.tsx`: Auto-open interaction modal
- `frontend/src/types/index.ts`: Type definitions

### Documentation
- `docs/plans/2025-11-11-deal-followup-tracking-design.md`: Original design document
- `docs/plans/2025-11-11-deal-followup-tracking.md`: Implementation plan
- `test-results.md`: Test checklist and results

## Changelog

### 2025-11-11 - Initial Release
- Added follow-up badge to deal cards
- Added warning modal for insufficient follow-ups
- Added social media interaction type
- Auto-open interaction modal when navigating from warning
- Comprehensive test suite and documentation
