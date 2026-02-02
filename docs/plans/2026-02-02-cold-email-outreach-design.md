# Cold Email Outreach System Design

## Overview

A high-efficiency cold email outreach system for reaching agencies at scale. Designed for speed and volume with manual Gmail sending.

**Workflow:** Scrape agencies → CSV import → work through daily queue → track responses → convert interested leads to deals

## Data Model

### OutreachCampaign

```python
OutreachCampaign
├── id: int (primary key)
├── name: str (e.g., "Web Design Agencies - Jan 2025")
├── status: "active" | "archived"
├── step_1_delay: int (days, default 0)
├── step_2_delay: int (days, default 3)
├── step_3_delay: int (days, default 5)
├── step_4_delay: int (days, default 7)
├── step_5_delay: int (days, default 7)
├── created_at: datetime
├── updated_at: datetime
└── prospects[] (one-to-many)
```

### OutreachProspect

```python
OutreachProspect
├── id: int (primary key)
├── campaign_id: int (foreign key)
├── agency_name: str
├── contact_name: str (nullable)
├── email: str
├── website: str (nullable)
├── niche: str (nullable)
├── custom_fields: JSON (any extra scraped data)
├── status: "queued" | "in_sequence" | "replied" | "not_interested" | "converted"
├── current_step: int (1-5, which email in sequence)
├── next_action_date: date (when to send next email)
├── last_contacted_at: datetime (nullable)
├── response_type: "interested" | "not_interested" | "other" (nullable)
├── notes: text (nullable)
├── created_at: datetime
└── updated_at: datetime
```

### OutreachTemplate

```python
OutreachTemplate
├── id: int (primary key)
├── campaign_id: int (foreign key)
├── step_number: int (1-5)
├── subject: str (with variables)
├── body: text (with variables)
├── created_at: datetime
└── updated_at: datetime
```

### Template Variables

- `{agency_name}` → "Smith Digital Agency"
- `{contact_name}` → "John" (falls back to agency_name if null)
- `{niche}` → "Web Design"
- `{website}` → "smithdigital.com"

## User Interface

### Page Structure

```
Cold Outreach Page
├── Header
│   ├── Campaign selector dropdown
│   ├── "New Campaign" button
│   ├── "Import CSV" button
│   └── Stats bar (to contact today | sent | response rate | converted)
├── Tabs
│   ├── Today (default) - prospects needing action today
│   ├── All Prospects - full list with filters
│   └── Replied - responses to process
└── Queue/List area
```

### Campaign Stats Bar

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  To Contact  │   Sent       │   Replied    │   Converted  │
│     12       │     84       │     19       │      7       │
│   today      │   total      │   23% rate   │   $12,400    │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Today Queue

Fast, scannable list optimized for speed:

```
┌─────────────────────────────────────────────────────────┐
│ 🟢 Smith Digital Agency          Step 1 (Initial)      │
│    john@smithdigital.com         Web Design            │
│    [Copy Email]  [Mark Sent]  [Skip]                   │
├─────────────────────────────────────────────────────────┤
│ 🔵 Creative Starter Co           Step 3 (Follow-up)    │
│    hello@creativestarter.io      Marketing             │
│    [Copy Email]  [Mark Sent]  [Skip]  [They Replied]   │
├─────────────────────────────────────────────────────────┤
│ 🔵 Bolt Media                    Step 5 (Final)        │
│    contact@boltmedia.com         Social Media          │
│    [Copy Email]  [Mark Sent]  [No Response - Archive]  │
└─────────────────────────────────────────────────────────┘
```

**Color coding:**
- 🟢 Green dot = New prospect (Step 1)
- 🔵 Blue dot = Follow-up (Steps 2-5)

### Copy Email Modal

Appears when clicking "Copy Email":

```
┌─────────────────────────────────────────────────────────┐
│  Email to: john@smithdigital.com           [Copy Email] │
├─────────────────────────────────────────────────────────┤
│  Subject: Quick question for Smith Digital Agency       │
│                                            [Copy Subj]  │
├─────────────────────────────────────────────────────────┤
│  Hey John,                                              │
│                                                         │
│  I came across Smith Digital Agency and love what       │
│  you're doing in the web design space...                │
│                                                         │
│  [Full template with variables filled in]               │
│                                            [Copy Body]  │
├─────────────────────────────────────────────────────────┤
│  [Copy All & Mark Sent]                    [Cancel]     │
└─────────────────────────────────────────────────────────┘
```

**"Copy All & Mark Sent"** = Copies email + subject, marks sent, schedules next follow-up, advances to next prospect.

### Response Outcome Modal

Appears when clicking "They Replied":

```
┌─────────────────────────────────────────────────────────┐
│  Smith Digital Agency replied!                          │
├─────────────────────────────────────────────────────────┤
│  What was the outcome?                                  │
│                                                         │
│  [🎉 Interested]  [👎 Not Interested]  [💬 Other]       │
├─────────────────────────────────────────────────────────┤
│  Notes (optional):                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Wants a call next Tuesday                       │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                                          [Save]         │
└─────────────────────────────────────────────────────────┘
```

**Outcomes:**
- **Interested** → Creates Contact + Deal, removes from queue
- **Not Interested** → Archives prospect, keeps for stats
- **Other** → Add notes, optionally snooze to future date

## CSV Import Flow

1. Click "Import CSV" button
2. Drag & drop or select CSV file
3. Column mapping screen:
   - Left side: CSV column headers
   - Right side: Dropdown to map to fields (agency_name, contact_name, email, website, niche, skip)
4. Preview first 5 rows with mapped data
5. Click "Import"
6. All prospects created with:
   - status = "queued"
   - current_step = 1
   - next_action_date = today

## Sequence Logic

### Default Timing

```
Step 1 (Initial)      → Immediate (next_action_date = today)
Step 2 (Follow-up 1)  → 3 days after Step 1
Step 3 (Follow-up 2)  → 5 days after Step 2
Step 4 (Follow-up 3)  → 7 days after Step 3
Step 5 (Final)        → 7 days after Step 4
```

### On "Mark Sent"

1. Update `last_contacted_at` = now
2. Update `status` = "in_sequence"
3. Increment `current_step`
4. If current_step <= 5: Set `next_action_date` = today + step delay
5. If current_step > 5: Set `status` = "not_interested" (no response after 5 emails)

### On "They Replied" → Interested

1. Create Contact:
   - name = agency_name
   - email = email
   - company = agency_name
   - source = "Cold Outreach"
   - notes = "Campaign: {campaign_name}, Niche: {niche}"
   - status = LEAD

2. Create Deal:
   - contact_id = new contact's ID
   - title = "{agency_name} - Cold Outreach"
   - stage = LEAD
   - probability = 10

3. Create Interaction:
   - contact_id = new contact's ID
   - type = EMAIL
   - subject = "Cold outreach response"
   - notes = prospect notes

4. Update prospect:
   - status = "converted"
   - response_type = "interested"

## API Endpoints

### Campaigns

```
GET    /api/outreach/campaigns              - List all campaigns
POST   /api/outreach/campaigns              - Create campaign
GET    /api/outreach/campaigns/{id}         - Get campaign with stats
PUT    /api/outreach/campaigns/{id}         - Update campaign
DELETE /api/outreach/campaigns/{id}         - Delete campaign
```

### Prospects

```
GET    /api/outreach/campaigns/{id}/prospects           - List prospects (with filters)
GET    /api/outreach/campaigns/{id}/prospects/today     - Get today's queue
POST   /api/outreach/campaigns/{id}/prospects           - Create single prospect
POST   /api/outreach/campaigns/{id}/prospects/import    - Bulk CSV import
PUT    /api/outreach/prospects/{id}                     - Update prospect
POST   /api/outreach/prospects/{id}/mark-sent           - Mark email sent
POST   /api/outreach/prospects/{id}/mark-replied        - Record response + outcome
DELETE /api/outreach/prospects/{id}                     - Delete prospect
```

### Templates

```
GET    /api/outreach/campaigns/{id}/templates           - Get all templates for campaign
POST   /api/outreach/campaigns/{id}/templates           - Create/update template
DELETE /api/outreach/templates/{id}                     - Delete template
```

### Stats

```
GET    /api/outreach/campaigns/{id}/stats               - Get campaign statistics
```

## Campaign Settings

Accessible via settings icon:

- Edit campaign name
- Adjust follow-up delays (days between each step)
- Archive campaign (hides from dropdown, preserves data)
- Delete campaign (removes all data)

## File Structure

### Backend

```
backend/app/
├── models/
│   └── outreach.py  (add new models)
├── schemas/
│   └── outreach.py  (add new schemas)
└── routes/
    └── outreach.py  (extend with new endpoints)
```

### Frontend

```
frontend/src/
├── pages/
│   └── ColdOutreach.tsx  (new page, keep existing Outreach.tsx for DM scripts)
├── components/
│   ├── CsvImportModal.tsx
│   ├── CopyEmailModal.tsx
│   ├── ResponseOutcomeModal.tsx
│   └── CampaignSettings.tsx
└── lib/
    └── api.ts  (add new API functions)
```

## Navigation

Add "Cold Outreach" to sidebar, separate from existing "DM Scripts" (Outreach.tsx).

```
Sidebar:
├── Dashboard
├── Contacts
├── Deals
├── Cold Outreach  ← NEW
├── DM Scripts     ← Existing Outreach.tsx
├── Tasks
└── ...
```
