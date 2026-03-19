# Autoresearch for Cold Email Outreach — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Author:** Claude + Joji

---

## Problem Statement

Joji runs a cold email outreach operation targeting Australian tradies (HVAC, plumbing, electrical, roofing, landscaping, building). The current workflow is manual:

1. Find a prospect's website
2. Paste a detailed audit prompt + URL into Claude browser
3. Claude audits the site, finds issues, writes a personalized cold email
4. Copy the email into the CRM's CopyEmailModal
5. Manually send from Gmail
6. Manually track replies in the multi-touch outreach system

This limits throughput to ~20 audits/day and loses structured data about what works. There is no way to track which issue types, framings, niches, or timing patterns produce the best reply rates.

**Current baseline:** ~200 emails sent over 20 days, 1 reply (0.5% reply rate). The one reply came from a "broken links + typos" angle for an HVAC prospect — a functional bug the owner could verify themselves.

---

## Solution Overview

An autonomous learning system inspired by Karpathy's autoresearch concept: audit websites, generate personalized emails, track everything, read Gmail for replies, and feed insights back to improve over time.

### The Autoresearch Loop

```
┌──────────────────────────────────────────────────────────────────┐
│                    THE AUTORESEARCH LOOP                         │
│                                                                  │
│   ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │ AUDIT   │───→│ GENERATE │───→│  SEND    │───→│  TRACK   │  │
│   │ website │    │  email   │    │ (manual) │    │ replies  │  │
│   └─────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       ↑               ↑                               │         │
│       │               │                               ↓         │
│       │          ┌──────────┐                   ┌──────────┐   │
│       │          │  LEARN   │←──────────────────│ CLASSIFY │   │
│       └──────────│ patterns │                   │  reply   │   │
│                  └──────────┘                   └──────────┘   │
│                                                                  │
│   Each cycle makes the next cycle smarter                       │
└──────────────────────────────────────────────────────────────────┘
```

### Four Components

| Component | Purpose |
|-----------|---------|
| **AI Auditor** | Headless browser visits site, takes screenshots, Claude Vision finds issues + writes email |
| **Gmail Reader** | Read-only OAuth, polls for replies from known prospects, auto-classifies sentiment |
| **Experiment Tracker** | Stores structured data on every email: issue type, angle, niche, outcome |
| **Learning Engine** | Analyzes patterns, feeds insights back into the auditor prompt |

### What Stays Manual

- Sending emails (copy from app, paste into Gmail)
- Reviewing every AI-generated email before sending
- Closing deals after a prospect converts

---

## Component 1: AI Website Auditor

### How It Works

```
Prospect in queue (has website URL)
        │
        ▼
┌─────────────────────────────────┐
│ PASS 1: Screenshot & Extract    │
│                                 │
│ 1. Playwright launches headless │
│    Chromium                     │
│ 2. Navigate to prospect URL     │
│ 3. Wait for network idle +      │
│    minimum 3 seconds            │
│ 4. Full-page screenshot         │
│    (desktop 1440px)             │
│ 5. Resize to mobile (375px),    │
│    screenshot again             │
│ 6. Extract all visible text     │
│ 7. Extract all links + where    │
│    they point (href map)        │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ CLAUDE VISION ANALYSIS          │
│                                 │
│ Send to Sonnet 4.6:            │
│ - Desktop screenshot            │
│ - Mobile screenshot             │
│ - Extracted text                │
│ - Link map                      │
│ - Audit prompt                  │
│ - Learning context (if any)     │
│                                 │
│ Returns structured JSON:        │
│ {                               │
│   issue_type,                   │
│   issue_detail,                 │
│   secondary_issue,              │
│   secondary_detail,             │
│   confidence,                   │
│   needs_verification,           │
│   verify_actions,               │
│   subject,                      │
│   body,                         │
│   word_count,                   │
│   site_quality                  │
│ }                               │
└─────────────┬───────────────────┘
              │
              ▼
        needs_verification?
        ┌─── no ───→ Store draft, ready for review
        │
       yes
        │
        ▼
┌─────────────────────────────────┐
│ PASS 2: Interactive Verify      │
│                                 │
│ 1. Playwright clicks flagged    │
│    elements                     │
│ 2. Screenshots each destination │
│ 3. Claude confirms or rejects   │
│ 4. If rejected → re-audit with  │
│    corrected context            │
└─────────────┬───────────────────┘
              │
              ▼
        Store final draft, ready for review
```

### Audit Prompt

The base audit prompt is Joji's existing prompt (stored in the Settings tab, editable). It covers:

- **Role:** Cold email copywriter for an Australian WordPress developer targeting tradies
- **Core principle:** The prospect must be able to open their own website and SEE the problem
- **Research process:** Quick site scan (homepage), then Google presence check, speed as last resort
- **Accuracy rules:** Every claim verified by browsing, exact numbers only
- **Writing rules:** Under 80 words, Australian English, no jargon, no bullet points, max one line of dry humour
- **Email format:** Subject under 8 words, G'day greeting, problem → cost → Loom offer → sign-off

The system appends a `<learning_context>` block (see Learning Engine section) with data-driven insights about which issue types and framings perform best.

### Key Behaviors

- **`site_quality: "good"`** — If the site is genuinely good, no email is generated. Prospect is marked as skipped with a reason.
- **`confidence`** — "high" / "medium" / "low". Low confidence audits are flagged in the review queue.
- **Batch mode** — "Audit All Queued" processes all prospects with a website URL that haven't been audited yet. Runs in the background.
- **Re-audit** — If the user rejects an audit, they provide a reason ("section wasn't blank, it loaded slowly"). The system stores this feedback for the learning engine.

### API Model

- **Audits:** Claude Sonnet 4.6 (vision)
- **Cost:** ~$0.025 per audit (Pass 1), ~$0.04 with Pass 2

### Backend

**New service:** `backend/app/services/audit_service.py`
- `audit_website(prospect_id)` — Single audit
- `batch_audit(campaign_id)` — Audit all queued prospects
- `verify_findings(audit_id, actions)` — Pass 2 interactive verification

**New routes:** `backend/app/routes/autoresearch.py`
```
POST /api/autoresearch/audit/{prospect_id}       — Audit single prospect
POST /api/autoresearch/audit/batch/{campaign_id}  — Audit all queued in campaign
GET  /api/autoresearch/audits/{prospect_id}       — Get audit results
PUT  /api/autoresearch/audits/{audit_id}/reject   — Reject bad audit + feedback
```

**New model:** `backend/app/models/autoresearch.py`
```python
class AuditResult:
    id: int
    prospect_id: int (FK)
    campaign_id: int (FK)

    # Audit findings
    issue_type: str
    issue_detail: str
    secondary_issue: str | None
    secondary_detail: str | None
    confidence: str  # high, medium, low
    site_quality: str  # good, medium, poor
    needs_verification: bool
    pass_2_completed: bool

    # Generated email
    generated_subject: str
    generated_body: str
    word_count: int

    # Screenshots stored as file paths
    desktop_screenshot_path: str
    mobile_screenshot_path: str
    verification_screenshots: JSON | None

    # Review status
    status: str  # pending_review, approved, rejected, skipped
    rejection_reason: str | None
    was_edited: bool
    edited_subject: str | None
    edited_body: str | None

    # Metadata
    audit_duration_seconds: float
    model_used: str
    tokens_used: int
    created_at: datetime
```

---

## Component 2: Gmail Read-Only Integration

### Setup Flow

1. User clicks "Connect Gmail" on the Autoresearch Settings tab
2. Backend generates Google OAuth consent URL (read-only scope)
3. User authorizes in Google's consent screen
4. Backend receives callback, stores encrypted refresh token
5. Polling begins automatically

### Polling Loop (every 5 minutes)

```
1. Fetch new emails since last check (inbox + sent)
2. For each incoming email:
   - Match sender address to known prospect emails
   - If match found:
     a. Extract reply body
     b. Send to Claude Haiku for classification
     c. Update prospect status
     d. Log to experiment tracker
3. For each sent email:
   - Match recipient to known prospect emails
   - Record sent timestamp (closes gap between "copied" and "actually sent")
```

### Reply Classification

Claude Haiku classifies each reply into:

```json
{
  "sentiment": "positive | neutral | negative",
  "category": "interested | curious | not_interested | stop | out_of_office | bounce",
  "wants_loom": true,
  "wants_call": false,
  "forwarded_internally": true,
  "key_quote": "extracted key sentence",
  "suggested_action": "Send Loom video audit"
}
```

| Category | Auto-action |
|----------|-------------|
| `interested` | Mark REPLIED, notify user |
| `curious` | Mark REPLIED, notify user |
| `not_interested` | Mark NOT_INTERESTED |
| `stop` | Mark NOT_INTERESTED, flag for removal |
| `out_of_office` | No status change, log it |
| `bounce` | Mark SKIPPED, flag bad email |

### Reply Data Tracked

- `reply_received_at` — timestamp
- `response_time_minutes` — time between send and reply
- `which_step_triggered_reply` — step 1, 2, 3... of the sequence
- `sentiment` — positive, neutral, negative
- `category` — interested, curious, not_interested, etc.
- `forwarded_internally` — boolean (like Scott forwarding to Beau)
- `full_reply_text` — stored for learning engine

### Gmail Scopes

```
gmail.readonly    — Read inbox + sent folder
gmail.labels      — Optional: auto-label processed emails
```

No `gmail.send` scope. The system never sends on the user's behalf.

### Security

- Refresh token encrypted at rest in database
- Access token never stored (generated fresh from refresh token)
- User can disconnect anytime (revokes token)

### Backend

**New service:** `backend/app/services/gmail_service.py`
- `get_auth_url()` — Generate OAuth consent URL
- `handle_callback(code)` — Exchange code for tokens, store encrypted
- `poll_inbox()` — Fetch new emails, match to prospects
- `classify_reply(text)` — Claude Haiku classification
- `match_sent_emails()` — Match outbox to prospects

**New routes added to:** `backend/app/routes/autoresearch.py`
```
GET  /api/autoresearch/gmail/auth-url   — Get OAuth consent URL
POST /api/autoresearch/gmail/callback   — Handle OAuth callback
GET  /api/autoresearch/gmail/status     — Connection status, last poll time
POST /api/autoresearch/gmail/poll       — Manual trigger poll
```

**New models added to:** `backend/app/models/autoresearch.py`
```python
class GmailToken:
    id: int
    email_address: str
    encrypted_refresh_token: str
    last_poll_at: datetime
    last_history_id: str  # Gmail history ID for incremental fetch
    is_active: bool
    created_at: datetime

class EmailMatch:
    id: int
    prospect_id: int (FK)
    experiment_id: int (FK, nullable)
    gmail_message_id: str
    direction: str  # inbound, outbound
    from_email: str
    to_email: str
    subject: str
    body_text: str
    received_at: datetime

    # Classification (inbound only)
    sentiment: str | None
    category: str | None
    wants_loom: bool | None
    wants_call: bool | None
    forwarded_internally: bool | None
    key_quote: str | None
    suggested_action: str | None

    created_at: datetime
```

---

## Component 3: Experiment Tracker

### Purpose

Every email sent is an experiment. The tracker stores structured data connecting the audit, the email, the prospect context, and the outcome.

### Data Model

```python
class Experiment:
    id: int
    prospect_id: int (FK)
    campaign_id: int (FK)
    audit_id: int (FK)

    # Audit data (denormalized for query performance)
    issue_type: str
    issue_detail: str
    secondary_issue: str | None
    secondary_detail: str | None
    confidence: str
    site_quality: str
    pass_2_triggered: bool

    # Email data
    subject: str
    body: str
    word_count: int
    was_edited: bool
    edit_type: str | None  # minor_tweak, rewrite, subject_only

    # Prospect context (denormalized)
    niche: str
    city: str
    state: str
    company: str

    # Send data
    sent_at: datetime | None
    day_of_week: str | None
    step_number: int

    # Outcome (updated by Gmail integration)
    replied: bool
    reply_at: datetime | None
    response_time_minutes: int | None
    sentiment: str | None
    category: str | None
    forwarded_internally: bool | None
    full_reply_text: str | None

    # Conversion tracking (linked to CRM)
    converted_to_call: bool
    converted_to_client: bool
    deal_id: int | None (FK)
    deal_value: float | None

    created_at: datetime
    updated_at: datetime
```

### Issue Type Taxonomy

```
FUNCTIONAL BUGS
  broken_links        — Buttons/links go to wrong pages
  broken_forms        — Contact forms don't work
  dead_pages          — 404s, missing pages

EMBARRASSING
  placeholder_text    — Lorem ipsum, "Your Heading Here"
  typos               — Misspellings in prominent places
  duplicate_content   — Same text copy-pasted across sections

TRUST
  frozen_reviews      — Review widget stuck on old date
  no_reviews          — Zero testimonials or social proof
  no_real_photos      — Stock photos only, no completed work

USABILITY
  no_contact_visible  — No phone/quote button without scrolling
  poor_mobile         — Broken on phone
  popup_blocking      — Chat widget or form covering content
  wall_of_text        — Homepage reads like an essay

DESIGN
  outdated_design     — Looks 5-10 years old
  cluttered_layout    — Too many sections, overwhelming

PERFORMANCE
  slow_load           — 5+ seconds to load

SEARCH
  invisible_on_google — Business name only, no trade/city
  vague_heading       — "Welcome to our website"
```

### Analytics Endpoints

```
GET /api/autoresearch/experiments                   — List with filters
GET /api/autoresearch/analytics/overview             — Aggregate stats
GET /api/autoresearch/analytics/by-issue-type        — Reply rate by issue type
GET /api/autoresearch/analytics/by-niche             — Reply rate by niche
GET /api/autoresearch/analytics/by-timing            — Reply rate by day/time
GET /api/autoresearch/analytics/trends               — Performance over time
```

### CRM Deal Linkage

When a prospect is marked INTERESTED in the existing outreach system, a Contact + Deal is auto-created. The experiment tracker links to that deal:

```
Prospect INTERESTED → Deal created → deal_id stored on experiment
Deal moves to "Closed Won" → experiment.converted_to_client = true, deal_value = $X
```

This enables revenue attribution: "broken_links emails generate $X revenue per 100 sent."

---

## Component 4: Learning Engine

### How It Works

The learning engine runs:
- **Every 50 new experiments logged**
- **Weekly summary (Sunday night)**
- **On demand ("Refresh Insights" button)**

### Process

```
Step 1: AGGREGATE
  Pull all experiment data, calculate reply rates
  by every dimension (issue type, niche, timing,
  word count, edited vs unedited, etc.)

Step 2: ANALYZE (Claude Sonnet 4.6)
  Send aggregated stats to Claude:
  "Here are my outreach results. What patterns
   do you see? What should I do differently?"

Step 3: GENERATE INSIGHTS
  Structured insights with confidence levels

Step 4: UPDATE AUDIT CONTEXT
  Inject top insights into the audit prompt
  so the next batch of audits is smarter
```

### Insight Format

```json
{
  "insight": "Functional bugs get 3x the reply rate of visual issues",
  "confidence": "high",
  "sample_size": 85,
  "recommendation": "Lead with functional bugs when multiple issues found",
  "applies_to": "all_niches"
}
```

### Confidence Thresholds

| Confidence | Sample Size | System Behavior |
|-----------|-------------|-----------------|
| **High** | 50+ experiments | Auto-applied to audit prompt |
| **Medium** | 20-49 experiments | Shown on dashboard, applied with note |
| **Low** | Under 20 | Shown on dashboard only, not applied |

### Learning Context Block

Appended to the audit prompt dynamically:

```
<learning_context>
Based on {total_experiments} emails sent with {total_replies} replies:

PRIORITIZE these issue types (by reply rate):
1. broken_links — 5.2% reply rate (n=58)
2. broken_forms — 4.8% reply rate (n=21)
...

AVOID leading with:
- outdated_design — 0.8% reply rate (n=120)

FOR THIS SPECIFIC NICHE ({niche}):
- HVAC responds best to: broken_links, typos

STYLE INSIGHTS:
- Keep under 65 words when possible
- Including a secondary issue boosts reply rate ~30%
- Specific numbers outperform vague descriptions
</learning_context>
```

### Audit Accuracy Learning

When the user rejects an audit, the system stores the correction:

```json
{
  "rejection_reason": "Section appeared blank but was slow-loading",
  "site_characteristic": "Heavy JavaScript, lazy-loaded sections",
  "correction": "Wait longer for JS-heavy sites"
}
```

After enough rejections of the same type, the system adjusts (e.g., extra wait time for JS-heavy sites, lower confidence when flagging "blank sections").

### Backend

**New service:** `backend/app/services/learning_service.py`
- `generate_insights()` — Aggregate + analyze + store
- `get_learning_context(niche)` — Build dynamic prompt block
- `should_refresh()` — Check if 50 new experiments since last refresh

**New routes added to:** `backend/app/routes/autoresearch.py`
```
GET  /api/autoresearch/insights                 — Current active insights
POST /api/autoresearch/insights/refresh         — Trigger re-analysis
GET  /api/autoresearch/insights/history         — How insights evolved
GET  /api/autoresearch/learning-context/{niche} — Generated context block
```

**New model:**
```python
class Insight:
    id: int
    insight: str
    confidence: str  # high, medium, low
    sample_size: int
    recommendation: str
    applies_to: str  # niche name or "all_niches"
    is_active: bool
    created_at: datetime
    superseded_by: int | None (FK to newer insight)
```

---

## Frontend: Autoresearch Page

### Sidebar Entry

New page in the sidebar with a beaker/flask icon, positioned after Outreach Hub:

```
Dashboard
Contacts
Deals
Projects
Tasks
Time Tracking
Goals
Sprint
Outreach Hub
Autoresearch    ← NEW
```

### Four Tabs

#### Tab 1: Audits

Daily workspace for reviewing AI-generated emails.

- **Audit queue** showing all pending reviews, sorted by confidence (high first)
- **Each card shows:** prospect name, company, niche, city, issue type, confidence badge, generated subject + body, word count
- **Actions:** Approve & Copy (copies email, creates experiment), Edit (tracked), Reject (with reason), View Screenshots, Skip
- **Batch controls:** "Audit All Queued" button, campaign filter, status filter
- **Skipped sites:** shown at bottom with reason ("site quality: good")

#### Tab 2: Insights

Learning engine dashboard showing what the system has learned.

- **Top performing issue types** — table with sent count, reply count, rate, confidence bar
- **By niche** — table with best issue type per niche
- **By day of week** — bar chart showing reply rate per day
- **Active insights** — list with confidence badges and recommendations
- **Refresh Insights** button

#### Tab 3: Experiments

Raw experiment log ("results.tsv").

- **Filterable table:** campaign, niche, issue type, outcome, date range
- **Columns:** company, issue type, sent date, reply time, outcome (icons)
- **Expandable rows:** full audit details, email sent, reply text, screenshots
- **Pagination** for large datasets

#### Tab 4: Settings

Configuration and connections.

- **Gmail connection:** status, connect/disconnect, last poll time
- **AI model selection:** audit model, reply classifier, learning engine
- **Audit settings:** min page load wait, enable Pass 2, max batch size
- **Audit prompt:** full editable text area with the base prompt
- **Cost tracker:** this month spend, avg per audit, daily average

---

## Build Phases

### Phase 1: AI Website Auditor (~2-3 days)

**Backend:**
- Playwright service (headless Chrome, screenshots, text extraction)
- Audit service (Claude Vision API with audit prompt)
- Audit endpoints (single + batch)
- AuditResult model + Alembic migration

**Frontend:**
- Autoresearch page with sidebar entry
- Audits tab (review queue with approve/edit/reject/copy flow)
- Screenshot viewer modal
- Settings tab (audit prompt editor, basic config)

**Result:** Stop using Claude browser. 50 audits generated, review in the morning.

### Phase 2: Experiment Tracker (~1-2 days)

**Backend:**
- Experiment model + Alembic migration
- Auto-create experiment when audit approved & copied
- Issue type taxonomy as enum
- Analytics endpoints

**Frontend:**
- Experiments tab (filterable log)
- Basic stats bar (total sent, reply rate, best issue type)

**Result:** Every email has structured data. Start seeing which angles work.

### Phase 3: Gmail Read-Only Integration (~2-3 days)

**Backend:**
- Google OAuth flow (consent URL, callback, encrypted token storage)
- Gmail polling service (every 5 min background task)
- Reply matching + classification (Claude Haiku)
- Sent email matching
- GmailToken + EmailMatch models + migration

**Frontend:**
- Settings tab: Connect Gmail button, status, disconnect
- Reply indicators on Audits tab
- Auto-populated outcome data in Experiments tab

**Result:** No more manual "mark replied." Auto-detect and classify every reply.

### Phase 4: Insights & Learning Engine (~1-2 days)

**Backend:**
- Aggregation queries across experiments
- Claude analysis of patterns
- Insight generation + storage
- Learning context builder (dynamic prompt appendix)
- Auto-refresh triggers (every 50 experiments, weekly)

**Frontend:**
- Insights tab (charts, tables, active insights with confidence)
- Learning context preview

**Result:** System tells you what's working and makes the next batch smarter.

### Phase 5: Polish & Settings (~1 day)

- Model selection UI
- Cost tracking
- Edge case handling (bot-blocked sites, timeouts, captchas)
- Batch scheduling options

**Total: ~8-11 days. Value from day 3.**

---

## Cost Estimate

At 50 audits/day on Claude Sonnet 4.6:

| Item | Monthly Cost |
|------|-------------|
| AI Auditor (Sonnet 4.6) | $37.50 |
| Pass 2 verification (~20% of audits) | $6.00 |
| Reply classifier (Haiku 4.5) | $1.50 |
| Learning engine refreshes | $0.20 |
| Gmail API | Free |
| Playwright/Chromium | Free (runs on existing server) |
| **Total** | **~$45/month** |

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI model for audits | Claude Sonnet 4.6 | Best balance of vision quality + natural writing + cost |
| AI model for reply classification | Claude Haiku 4.5 | Simple classification task, 5x cheaper |
| Browser automation | Playwright (Python) | Already proven in the codebase ecosystem, headless Chromium |
| Page load strategy | Wait for network idle + 3s minimum | Prevents false "blank section" findings |
| Pass 2 verification | On-demand, only when Claude flags uncertainty | Saves time/cost on 80% of audits |
| Gmail integration | Read-only OAuth | No sending scope, minimal permissions |
| Token storage | Encrypted in database | Standard security practice |
| Screenshot storage | Local filesystem (backend/screenshots/) | Simple, no external storage needed |
| Experiment data | Denormalized from audit + prospect | Faster analytics queries, no complex joins |
| Learning confidence | 50+ sample = high, 20-49 = medium, <20 = low | Prevents overreacting to small samples |

---

## Future Expansion

The Autoresearch page is designed as a dedicated system that could expand beyond outreach:

- **A/B testing:** Same issue, two different framings — track which converts better
- **Send automation:** When ready, add Gmail send scope to send directly from the app
- **Multi-niche support:** Different audit prompts per niche (tradies, dentists, restaurants)
- **Competitor analysis:** Track competitor cold email patterns
- **Apply to other CRM features:** Autoresearch loop for deal follow-ups, task prioritization, etc.
