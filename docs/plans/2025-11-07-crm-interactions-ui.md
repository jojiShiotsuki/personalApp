# CRM Interactions UI Feature Design
**Date:** 2025-11-07
**Status:** Approved for Implementation

## Overview

Add interaction tracking UI to the Contacts page, completing the CRM system's relationship management capabilities. This feature enables users to log and view meetings, emails, calls, and notes for each contact.

## Context

**Current State:**
- Backend API for interactions is fully implemented (models, CRUD routes)
- Frontend types and API client exist
- Contacts page has grid layout with create/edit/delete functionality
- No UI exists for viewing or creating interactions

**Missing Piece:**
Success Criterion #6 from MVP requirements: "Can add interactions to contacts"

## Design Decision: Modal-Based Approach

**Selected Approach:** Modal Detail View (Approach 2)

**Alternatives Considered:**
1. **In-Card Timeline** - Too cramped for multiple interactions
2. **Dedicated Contact Detail Page** - Breaks current modal-based pattern, adds navigation complexity

**Rationale:**
- Matches existing UI patterns (all CRUD operations use modals)
- Provides sufficient space for interaction timeline
- Keeps users in flow without page navigation
- Simpler to implement than dedicated page route

## Architecture

### Component Structure

```
Contacts.tsx (modified)
├── ContactCard (existing - add "View Details" button)
├── ContactDetailModal (NEW)
│   ├── Contact info panel (left 300px)
│   ├── Interaction timeline (right 600px)
│   └── "Add Interaction" button
└── AddInteractionModal (NEW - nested modal)
    └── Interaction form
```

### State Management

**New State in Contacts.tsx:**
```typescript
const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
```

**Query Keys:**
- `['interactions', contactId]` - Interactions for specific contact
- `['contacts']` - Contact list (unchanged)

### Data Flow

**User Flow:**
1. Click "View Details" on contact card
2. `ContactDetailModal` opens, fetches interactions via `useQuery(['interactions', contact.id])`
3. Timeline renders interactions chronologically (newest first)
4. Click "Add Interaction" → `AddInteractionModal` opens (nested)
5. Submit form → mutation invalidates queries → timeline auto-updates
6. Modal closes → user sees updated timeline

## UI Components

### ContactDetailModal

**Layout:**
- Modal width: ~900px (wider than current 500px modals)
- Two-column split layout
- Full-height with scrollable sections

**Left Column (300px):**
- Contact summary card
  - Name with status badge
  - Email, phone, company icons + text
  - Notes section (if present)
  - "Edit Contact" button at bottom

**Right Column (600px):**
- Header: "Interaction History" + "Add Interaction" button (blue, top-right)
- Timeline component:
  - Vertical timeline line with dots
  - Each interaction shows:
    - Type icon (colored: Meeting=blue, Email=green, Call=orange, Note=gray)
    - Subject (bold)
    - Relative timestamp ("2 hours ago", "Yesterday", "Jan 15")
    - Notes preview (collapsed by default, expandable)
  - Sorted newest first
  - Scrollable if >8 interactions

**Empty State:**
"No interactions yet. Add your first interaction to track this relationship."

### AddInteractionModal

**Form Fields:**
1. **Type** (required)
   - Dropdown: Meeting, Email, Call, Note
   - Default: Meeting

2. **Subject** (optional)
   - Text input
   - Placeholder: "e.g., Q1 Planning Call"

3. **Date & Time** (required)
   - `datetime-local` input
   - Default: current date/time

4. **Notes** (optional)
   - Textarea (5 rows)
   - Placeholder: "Discussion points, outcomes, follow-ups..."

**Behavior:**
- Opens centered over dimmed `ContactDetailModal` (z-index: 60)
- ESC or backdrop click → closes, returns to detail modal
- Submit → creates interaction, refetches timeline, closes
- Validation: Type + Date required

**Mutation Handling:**
```typescript
const createMutation = useMutation({
  mutationFn: (interaction: InteractionCreate) => interactionApi.create(interaction),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['interactions', selectedContact.id] });
    setIsAddInteractionOpen(false);
  },
});
```

## Contacts.tsx Modifications

### Contact Card Updates

**Current Button Layout:**
```
[Edit] [Delete]
```

**New Button Layout:**
```
[View Details] [Edit] [Delete]
```

- All buttons same width, same styling
- "View Details" uses gray background (matches "Edit")
- Clicking "View Details" sets `selectedContact`

### Modal Rendering Logic

```typescript
{selectedContact && (
  <ContactDetailModal
    contact={selectedContact}
    onClose={() => setSelectedContact(null)}
    onAddInteraction={() => setIsAddInteractionOpen(true)}
  />
)}

{isAddInteractionOpen && selectedContact && (
  <AddInteractionModal
    contactId={selectedContact.id}
    onClose={() => setIsAddInteractionOpen(false)}
  />
)}
```

## Technical Details

### Query Configuration

```typescript
// In ContactDetailModal
const { data: interactions = [], isLoading } = useQuery({
  queryKey: ['interactions', contact.id],
  queryFn: () => interactionApi.getAll(contact.id),
});
```

### Icon Mapping

```typescript
const interactionIcons = {
  [InteractionType.MEETING]: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100' },
  [InteractionType.EMAIL]: { icon: Mail, color: 'text-green-600', bg: 'bg-green-100' },
  [InteractionType.CALL]: { icon: Phone, color: 'text-orange-600', bg: 'bg-orange-100' },
  [InteractionType.NOTE]: { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
};
```

### Timestamp Formatting

Use `date-fns` for relative time:
```typescript
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

const formatInteractionDate = (date: string) => {
  const d = parseISO(date);
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, yyyy');
};
```

## Error Handling

**Scenarios:**
1. **Network failure during create** → Show error message in modal (red text below form)
2. **Contact deleted while detail modal open** → Modal closes, contact removed from list
3. **Invalid form submission** → Browser HTML5 validation + manual checks
4. **Empty interactions list** → Show empty state with helpful message

**No Toast Notifications Yet:** Error messages display inline in modals for now. Toast system will be added in separate feature.

## Testing Strategy

### Manual Test Cases

**Basic Flows:**
1. ✅ Open contact detail → timeline loads correctly
2. ✅ Add interaction with all fields → appears immediately
3. ✅ Add interaction with only required fields → displays minimal info correctly
4. ✅ Interactions display in chronological order (newest first)
5. ✅ Timeline scrolls for 10+ interactions

**Modal Behavior:**
6. ✅ Press ESC on detail modal → closes
7. ✅ Press ESC on add interaction modal → returns to detail modal (not contact list)
8. ✅ Click backdrop → closes appropriate modal
9. ✅ Nested modals dim correctly (detail modal dims when add modal opens)

**Edge Cases:**
10. ✅ Delete contact with interactions → cascade delete works (backend handles)
11. ✅ Network error during create → error displays, modal stays open
12. ✅ Empty notes field → interaction creates successfully
13. ✅ Long notes text → displays with proper wrapping/truncation

### API Integration

**Endpoints Used:**
- `GET /api/crm/interactions?contact_id={id}` - Fetch timeline
- `POST /api/crm/interactions` - Create interaction
- (Future: `PUT`, `DELETE` for edit/delete functionality)

**Backend Requirements:** None - API already complete and tested.

## Implementation Checklist

- [ ] Create `ContactDetailModal.tsx` component
  - [ ] Two-column layout with contact info + timeline
  - [ ] Fetch interactions query
  - [ ] Timeline component with icons and formatting
  - [ ] Empty state
  - [ ] "Add Interaction" button

- [ ] Create `AddInteractionModal.tsx` component
  - [ ] Form with type, subject, date, notes fields
  - [ ] Form validation
  - [ ] Create mutation with error handling
  - [ ] Z-index layering over detail modal

- [ ] Modify `Contacts.tsx`
  - [ ] Add "View Details" button to contact cards
  - [ ] Add state: `selectedContact`, `isAddInteractionOpen`
  - [ ] Conditional rendering of both modals

- [ ] Test complete user flow
  - [ ] All test cases from Testing Strategy section

## Success Criteria

✅ Feature complete when:
1. User can view all interactions for a contact
2. User can create new interactions (all 4 types)
3. Interactions display chronologically with proper formatting
4. Modal UX matches existing patterns
5. No console errors or visual bugs
6. Build passes with no TypeScript errors

## Future Enhancements (Post-MVP)

- Edit/delete interactions from timeline
- Filter interactions by type
- Search interactions by keyword
- Interaction count badge on contact cards
- Rich text editor for notes
- Attachment support (files, links)
- Export interaction history per contact
