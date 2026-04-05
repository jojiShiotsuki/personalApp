# Warm Leads Nurture Pipeline — Design Spec

**Date:** 2026-04-05
**Status:** Draft

---

## Problem

When a cold outreach prospect replies with interest, there is no system to track or manage the follow-up sequence after that first reply. Replied prospects currently get auto-converted to a CRM Contact + Deal immediately, skipping the nurture phase where the actual relationship-building happens.

## Solution

A dedicated "Warm Leads" tab inside OutreachHub with a 5-step nurture pipeline, time-based follow-up triggers for quiet leads, and deferred deal creation until the prospect is actually ready to close.

---

## Data Model

### `NurtureLead` table

| Field | Type | Purpose |
|-------|------|---------|
| id | Integer PK | |
| prospect_id | FK → OutreachProspect (unique, ondelete CASCADE) | Source prospect (one nurture lead per prospect) |
| contact_id | FK → Contact (nullable, ondelete SET NULL) | CRM contact, auto-created on entry |
| deal_id | FK → Deal (nullable, ondelete SET NULL) | Created on conversion, not on entry |
| campaign_id | FK → OutreachCampaign (ondelete CASCADE) | Original campaign |
| source_channel | String | Channel the prospect replied through (EMAIL, LINKEDIN, etc.) |
| current_step | Integer (1-5) | Current nurture step |
| status | Enum: ACTIVE, QUIET, LONG_TERM, CONVERTED, LOST | Pipeline status |
| quiet_since | DateTime (nullable) | When they last went quiet |
| last_action_at | DateTime | Last interaction (you or them) |
| next_followup_at | DateTime (nullable) | Calculated due date |
| followup_stage | Enum: DAY_2, DAY_5, DAY_10, LONG_TERM (nullable) | Current follow-up trigger. NULL = "on track" (green badge in UI) |
| notes | Text (nullable) | Free-form notes |
| created_at | DateTime | When they entered nurture (entry timestamp) |
| updated_at | DateTime | Last update |

**Relationships:** `step_logs` → one-to-many `NurtureStepLog` (cascade delete-orphan)

**Indexes:** `status`, `prospect_id` (unique), `campaign_id`, `followup_stage`

**Uniqueness:** One `NurtureLead` per `prospect_id`. Attempting to create a duplicate returns 409 Conflict.

### `NurtureStepLog` table

| Field | Type | Purpose |
|-------|------|---------|
| id | Integer PK | |
| nurture_lead_id | FK → NurtureLead (ondelete CASCADE, indexed) | Parent lead |
| step_number | Integer (1-5) | Which step (step name derived from constants) |
| completed_at | DateTime (nullable) | When marked done |
| notes | Text (nullable) | What was sent/done |
| created_at | DateTime | Row creation |

### Predefined Steps (constants, not user-configurable)

1. Reply with value
2. Free goodwill offer (mockup, audit, demo)
3. Deliver the free thing
4. Book a call
5. Make the offer / close

### Quiet Detection Logic

Based on days since `last_action_at` for ACTIVE leads:

| Days quiet | followup_stage | Suggested action |
|-----------|---------------|-----------------|
| 2 | DAY_2 | Quick check-in |
| 5 | DAY_5 | Add more value |
| 10 | DAY_10 | 9-word re-engagement email |
| 20+ | LONG_TERM | Status changes to LONG_TERM, content nurtures them |

Calculated by a scheduled job running every 30 minutes via APScheduler.

---

## Backend API

**Route prefix:** `/api/nurture/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/nurture/leads` | GET | List nurture leads. Filters: status, current_step, followup_stage, search |
| `/nurture/leads/{id}` | GET | Single lead with all step logs |
| `/nurture/leads` | POST | Manually create a nurture lead (rare) |
| `/nurture/leads/{id}` | PUT | Update notes, status, manual overrides |
| `/nurture/leads/{id}/complete-step` | POST | Mark current step done, advance to next step, reset quiet timer. Body: `{ notes?: string }`. If lead was QUIET or LONG_TERM, resets status to ACTIVE. |
| `/nurture/leads/{id}/log-followup` | POST | Log a follow-up action, reset quiet timer and followup_stage. Body: `{ notes?: string }`. If lead was QUIET or LONG_TERM, resets status to ACTIVE. |
| `/nurture/leads/{id}/convert` | POST | Create Deal + link Contact, set status CONVERTED. Body: `{ deal_title?: string, deal_value?: float, deal_stage?: string }`. Defaults: stage=Proposal, probability=50. |
| `/nurture/leads/{id}/mark-lost` | POST | Set status LOST. Body: `{ notes?: string }` |
| `/nurture/leads` | GET | Additional filter: `needs_followup=true` returns leads where followup_stage is not null |
| `/nurture/stats` | GET | Counts: active, needs_followup, long_term, converted |
| `/nurture/from-prospect/{prospect_id}` | POST | Entry point: creates NurtureLead + Contact from a prospect. Called by Response Outcome Modal on "Interested". Returns 409 if prospect already has a nurture lead. Body: `{ source_channel: string, notes?: string }` |

### Scheduler Job

- `nurture_followup_check_job` added to existing APScheduler
- Runs every 30 minutes
- For each ACTIVE lead: calculates days since `last_action_at`
- Updates `next_followup_at`, `followup_stage`
- If 20+ days → auto-sets status to LONG_TERM

---

## Frontend UI

### Location

New "Warm Leads" tab in OutreachHub, between Multi-Touch and DM Scripts tabs.

### Top Stats Bar (4 cards)

- **Active** — leads in nurture steps 1-5
- **Needs Follow-up** — overdue follow-ups (red highlight if > 0)
- **Long-term** — moved to content nurture (20+ days quiet)
- **Converted** — successfully created a deal

### Main View: Kanban Pipeline

5 columns, one per nurture step:

```
| Reply with   | Free goodwill | Deliver the  | Book a     | Make the    |
| value        | offer         | free thing   | call       | offer/close |
```

### Lead Cards

Each card displays:
- Contact name + company
- Source campaign + channel
- Days in current step
- Follow-up urgency badge:
  - Green "On track" — no follow-up needed
  - Yellow "Check-in due" — DAY_2 or DAY_5
  - Red "Re-engage" — DAY_10
  - Gray "Long-term" — 20+ days
- "Complete Step" button (advances to next column)

### Card Click → Slide-out Detail Panel

- Full timeline: all completed steps with dates and notes
- Current step highlighted
- "Mark Step Complete" button with notes field
- "Mark Quiet" / "Mark Lost" actions
- "Convert to Deal" button
- Link back to original prospect/campaign

### Follow-up Section

Below the kanban (or toggleable):
- List of all leads needing follow-up, sorted by urgency
- Shows: name, follow-up trigger (Day 2/5/10), due date, suggested action
- "Done" button to log the follow-up and reset quiet timer

### No auto-task creation

Follow-up reminders live entirely within the Warm Leads tab. No tasks are auto-created on the Tasks page.

---

## Integration Points

### Response Outcome Modal (modified — backend + frontend change)

The existing `mark_replied` endpoint currently creates both a Contact and Deal on INTERESTED. This must be changed.

**Backend change:** Modify `mark_replied` to NOT create a Deal when response_type is INTERESTED. Instead, the frontend calls `POST /nurture/from-prospect/{prospect_id}` which:
1. Creates a `NurtureLead` at step 1 (status ACTIVE)
2. Creates a CRM `Contact` if one doesn't already exist (via existing logic)
3. Sets `OutreachProspect.status` to CONVERTED
4. Records `source_channel` from the prospect's last step channel type
5. Does NOT create a Deal (deferred to "Convert to Deal" in nurture)

**Frontend change:** On "Interested" click:
1. Call `mark_replied` (which now skips Deal creation for INTERESTED)
2. Call `POST /nurture/from-prospect/{prospect_id}`
3. Show toast: "Moved to Warm Leads -> Reply with value"
4. If 409 (already exists), show toast: "Already in Warm Leads" and navigate to existing nurture lead

### Re-engagement from LONG_TERM

When a long-term lead re-engages (you log a follow-up or complete a step), the `complete-step` and `log-followup` endpoints automatically reset:
- `status` → ACTIVE
- `followup_stage` → NULL
- `quiet_since` → NULL
- `last_action_at` → now

### Existing Systems

- **OutreachProspect** — status changes to CONVERTED when entering nurture
- **Contact** — auto-created on nurture entry if not linked
- **Deal** — only created via "Convert to Deal" action in nurture (defaults: stage=Proposal, probability=50)
- **Experiment** — reply metadata (sentiment, response_time) still recorded as-is

### Existing CONVERTED prospects

Prospects already converted to Contact + Deal via the old flow are left as-is. No retroactive import into the nurture pipeline. The new flow only applies going forward.

---

## Frontend Tab Order

Tabs in OutreachHub: DM Scripts, LinkedIn Campaigns, Multi-Touch, **Warm Leads** (appended at end, since warm leads come after cold outreach).

---

## Migration

- New Alembic migration: creates `nurture_leads` and `nurture_step_logs` tables with indexes
- Backend change to `mark_replied` endpoint: skip Deal creation for INTERESTED responses
- New `/api/nurture/` route file
- Frontend: new WarmLeadsTab component + updated ResponseOutcomeModal
