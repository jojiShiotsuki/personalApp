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
| prospect_id | FK → OutreachProspect | Source prospect |
| contact_id | FK → Contact (nullable) | CRM contact, auto-created on entry |
| deal_id | FK → Deal (nullable) | Created on conversion, not on entry |
| campaign_id | FK → OutreachCampaign | Original campaign |
| current_step | Integer (1-5) | Current nurture step |
| status | Enum: ACTIVE, QUIET, LONG_TERM, CONVERTED, LOST | Pipeline status |
| quiet_since | DateTime (nullable) | When they last went quiet |
| last_action_at | DateTime | Last interaction (you or them) |
| next_followup_at | DateTime (nullable) | Calculated due date |
| followup_stage | Enum: DAY_2, DAY_5, DAY_10, LONG_TERM (nullable) | Current follow-up trigger |
| notes | Text (nullable) | Free-form notes |
| entered_at | DateTime | When they entered nurture |
| created_at | DateTime | Row creation |
| updated_at | DateTime | Last update |

### `NurtureStepLog` table

| Field | Type | Purpose |
|-------|------|---------|
| id | Integer PK | |
| nurture_lead_id | FK → NurtureLead | Parent lead |
| step_number | Integer (1-5) | Which step |
| step_name | String | Human-readable step name |
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
| `/nurture/leads/{id}/complete-step` | POST | Mark current step done, advance to next step, reset quiet timer |
| `/nurture/leads/{id}/log-followup` | POST | Log a follow-up action, reset quiet timer and followup_stage |
| `/nurture/leads/{id}/convert` | POST | Create Deal + link Contact, set status CONVERTED |
| `/nurture/leads/{id}/mark-lost` | POST | Set status LOST |
| `/nurture/stats` | GET | Counts: active, needs_followup, long_term, converted |

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

### Response Outcome Modal (modified)

When "Interested" is clicked:
1. Creates a `NurtureLead` at step 1 (status ACTIVE)
2. Creates a CRM `Contact` if one doesn't already exist
3. Sets `OutreachProspect.status` to CONVERTED
4. Does NOT create a Deal (deferred to nurture step 5 or manual conversion)
5. Shows toast: "Moved to Warm Leads → Reply with value"

### Existing Systems

- **OutreachProspect** — status changes to CONVERTED when entering nurture
- **Contact** — auto-created on nurture entry if not linked
- **Deal** — only created via "Convert to Deal" action in nurture
- **Experiment** — reply metadata (sentiment, response_time) still recorded as-is

---

## Migration

- New Alembic migration: creates `nurture_leads` and `nurture_step_logs` tables
- No changes to existing tables (OutreachProspect, Contact, Deal schemas unchanged)
- Response Outcome Modal behavior change is frontend-only (different API call on "Interested")
