# Autoresearch Cold Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous learning system that audits prospect websites via headless browser + Claude Vision, tracks experiments, reads Gmail for replies, and feeds insights back to improve cold email performance over time.

**Architecture:** FastAPI backend adds 4 new services (audit, gmail, experiment, learning) behind a single `/api/autoresearch/` router. Playwright captures screenshots, Claude Sonnet 4.6 analyzes them and generates emails. Gmail read-only OAuth polls for replies. APScheduler handles background polling. React frontend adds a dedicated Autoresearch page with 4 tabs.

**Tech Stack:** Playwright (headless Chromium), Anthropic Claude API (vision), Google Gmail API (read-only OAuth), APScheduler, cryptography (Fernet), React + TanStack Query + TailwindCSS.

**Spec:** `docs/superpowers/specs/2026-03-19-autoresearch-cold-email-design.md`

---

## File Structure

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `backend/app/models/autoresearch.py` | SQLAlchemy models: AuditResult, Experiment, GmailToken, EmailMatch, Insight, AutoresearchSettings |
| `backend/app/schemas/autoresearch.py` | Pydantic schemas for all autoresearch request/response types |
| `backend/app/routes/autoresearch.py` | All `/api/autoresearch/*` endpoints |
| `backend/app/services/audit_service.py` | Playwright browser automation + Claude Vision audit logic |
| `backend/app/services/gmail_service.py` | Google OAuth, inbox polling, reply matching + classification |
| `backend/app/services/experiment_service.py` | Experiment CRUD + analytics aggregation queries |
| `backend/app/services/learning_service.py` | Insight generation, learning context builder |
| `backend/app/services/scheduler_service.py` | APScheduler setup, job management |

### Backend — Modified Files

| File | Change |
|------|--------|
| `backend/requirements.txt` | Add: playwright, apscheduler>=3.10<4.0, cryptography, google-auth, google-auth-oauthlib, google-api-python-client |
| `backend/app/main.py` | Register autoresearch router, start scheduler on startup |
| `backend/app/models/__init__.py` | Import + re-export autoresearch models |
| `backend/app/database/connection.py` | Add WAL mode pragma to existing SQLite listener |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/pages/Autoresearch.tsx` | Main page with 4 tabs (Audits, Insights, Experiments, Settings) |
| `frontend/src/components/autoresearch/AuditsTab.tsx` | Audit review queue UI |
| `frontend/src/components/autoresearch/InsightsTab.tsx` | Learning dashboard with charts |
| `frontend/src/components/autoresearch/ExperimentsTab.tsx` | Experiment log table |
| `frontend/src/components/autoresearch/SettingsTab.tsx` | Gmail connection, model config, prompt editor |
| `frontend/src/components/autoresearch/AuditCard.tsx` | Single audit review card (approve/edit/reject/copy) |
| `frontend/src/components/autoresearch/ScreenshotModal.tsx` | Full-screen screenshot viewer |
| `frontend/src/components/autoresearch/BatchProgress.tsx` | Progress bar for batch audits |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `/autoresearch` route |
| `frontend/src/components/Layout.tsx` | Add Autoresearch sidebar entry |
| `frontend/src/lib/api.ts` | Add `autoresearchApi` object |
| `frontend/src/types/index.ts` | Add autoresearch TypeScript types + enums |

### Alembic Migration

| File | Change |
|------|--------|
| `backend/alembic/versions/xxx_add_autoresearch_tables.py` | Create audit_results, experiments, gmail_tokens, email_matches, insights tables |

---

## Phase 1: AI Website Auditor

### Task 1: Install Dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add new dependencies to requirements.txt**

Add these lines to `backend/requirements.txt`:

```
playwright>=1.40.0
apscheduler>=3.10.0,<4.0
cryptography>=42.0.0
google-auth>=2.25.0
google-auth-oauthlib>=1.2.0
google-api-python-client>=2.100.0
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd backend && venv/Scripts/pip install -r requirements.txt
```

- [ ] **Step 3: Install Playwright Chromium**

Run:
```bash
cd backend && venv/Scripts/playwright install chromium
```

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add autoresearch dependencies (playwright, apscheduler, gmail api)"
```

---

### Task 2: Database Models

**Files:**
- Create: `backend/app/models/autoresearch.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/database/connection.py`

- [ ] **Step 1: Create autoresearch models**

Create `backend/app/models/autoresearch.py`:

```python
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Enum, ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class AuditResult(Base):
    __tablename__ = "audit_results"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)

    # Audit findings
    issue_type = Column(String, nullable=True)  # broken_links, typos, etc.
    issue_detail = Column(Text, nullable=True)
    secondary_issue = Column(String, nullable=True)
    secondary_detail = Column(Text, nullable=True)
    confidence = Column(String, default="medium")  # high, medium, low
    site_quality = Column(String, default="medium")  # good, medium, poor
    needs_verification = Column(Boolean, default=False)
    pass_2_completed = Column(Boolean, default=False)

    # Generated email
    generated_subject = Column(String, nullable=True)
    generated_body = Column(Text, nullable=True)
    word_count = Column(Integer, nullable=True)

    # Screenshots (base64 encoded for production, file path for local)
    desktop_screenshot = Column(Text, nullable=True)  # base64 or path
    mobile_screenshot = Column(Text, nullable=True)  # base64 or path
    verification_screenshots = Column(JSON, nullable=True)

    # Review status
    status = Column(String, default="pending_review")  # pending_review, approved, rejected, skipped
    rejection_reason = Column(Text, nullable=True)
    was_edited = Column(Boolean, default=False)
    edited_subject = Column(String, nullable=True)
    edited_body = Column(Text, nullable=True)

    # Metadata
    audit_duration_seconds = Column(Float, nullable=True)
    model_used = Column(String, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    ai_cost_estimate = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    experiment = relationship("Experiment", back_populates="audit", uselist=False)


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    audit_id = Column(Integer, ForeignKey("audit_results.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="draft")  # draft, sent, replied, no_reply, bounced

    # Audit data (denormalized, point-in-time snapshot)
    issue_type = Column(String, nullable=True, index=True)
    issue_detail = Column(Text, nullable=True)
    secondary_issue = Column(String, nullable=True)
    secondary_detail = Column(Text, nullable=True)
    confidence = Column(String, nullable=True)
    site_quality = Column(String, nullable=True)
    pass_2_triggered = Column(Boolean, default=False)

    # Email data (final sent version)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    word_count = Column(Integer, nullable=True)
    was_edited = Column(Boolean, default=False)
    edit_type = Column(String, nullable=True)  # minor_tweak, rewrite, subject_only

    # Prospect context (denormalized, point-in-time snapshot)
    niche = Column(String, nullable=True, index=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    company = Column(String, nullable=True)

    # Send data
    sent_at = Column(DateTime, nullable=True)
    day_of_week = Column(String, nullable=True)
    step_number = Column(Integer, default=1)

    # Outcome (updated by Gmail integration)
    replied = Column(Boolean, default=False)
    reply_at = Column(DateTime, nullable=True)
    response_time_minutes = Column(Integer, nullable=True)
    sentiment = Column(String, nullable=True)
    category = Column(String, nullable=True)
    forwarded_internally = Column(Boolean, nullable=True)
    full_reply_text = Column(Text, nullable=True)

    # Conversion tracking
    converted_to_call = Column(Boolean, default=False)
    converted_to_client = Column(Boolean, default=False)
    deal_id = Column(Integer, ForeignKey("deals.id", ondelete="SET NULL"), nullable=True)
    deal_value = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    audit = relationship("AuditResult", back_populates="experiment")


class GmailToken(Base):
    __tablename__ = "gmail_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    email_address = Column(String, nullable=False)
    encrypted_refresh_token = Column(Text, nullable=False)
    last_poll_at = Column(DateTime, nullable=True)
    last_history_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailMatch(Base):
    __tablename__ = "email_matches"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=False, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True, index=True)
    gmail_message_id = Column(String, nullable=False, unique=True)
    direction = Column(String, nullable=False)  # inbound, outbound
    from_email = Column(String, nullable=False)
    to_email = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    body_text = Column(Text, nullable=True)
    received_at = Column(DateTime, nullable=False)

    # Classification (inbound only)
    sentiment = Column(String, nullable=True)
    category = Column(String, nullable=True)
    wants_loom = Column(Boolean, nullable=True)
    wants_call = Column(Boolean, nullable=True)
    forwarded_internally = Column(Boolean, nullable=True)
    key_quote = Column(String, nullable=True)
    suggested_action = Column(String, nullable=True)
    classification_cost = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, index=True)
    insight = Column(Text, nullable=False)
    confidence = Column(String, nullable=False)  # high, medium, low
    sample_size = Column(Integer, nullable=False)
    recommendation = Column(Text, nullable=True)
    applies_to = Column(String, default="all_niches")
    is_active = Column(Boolean, default=True)
    experiment_count_at_refresh = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    superseded_by = Column(Integer, ForeignKey("insights.id", ondelete="SET NULL"), nullable=True)


class AutoresearchSettings(Base):
    __tablename__ = "autoresearch_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    audit_prompt = Column(Text, nullable=True)  # User's base audit prompt
    audit_model = Column(String, default="claude-sonnet-4-6-20250514")
    classifier_model = Column(String, default="claude-haiku-4-5-20251001")
    learning_model = Column(String, default="claude-sonnet-4-6-20250514")
    min_page_load_wait = Column(Integer, default=3)
    enable_pass_2 = Column(Boolean, default=True)
    max_batch_size = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 2: Update models __init__.py**

Add to `backend/app/models/__init__.py`:

```python
from app.models.autoresearch import (
    AuditResult,
    Experiment,
    GmailToken,
    EmailMatch,
    Insight,
    AutoresearchSettings,
)
```

- [ ] **Step 3: Add WAL mode to existing SQLite pragma**

In `backend/app/database/connection.py`, find the existing `set_sqlite_pragma` listener and merge WAL mode into it:

```python
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()
```

- [ ] **Step 4: Create Alembic migration**

Run:
```bash
cd backend && venv/Scripts/alembic revision --autogenerate -m "add autoresearch tables"
```

Review the generated migration file, then:
```bash
cd backend && venv/Scripts/alembic upgrade head
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/autoresearch.py backend/app/models/__init__.py backend/app/database/connection.py backend/alembic/versions/
git commit -m "feat: add autoresearch database models and migration"
```

---

### Task 3: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/autoresearch.py`

- [ ] **Step 1: Create autoresearch schemas**

Create `backend/app/schemas/autoresearch.py`:

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# --- Audit Schemas ---

class AuditRequest(BaseModel):
    """Request to audit a single prospect's website."""
    pass  # prospect_id comes from URL path


class AuditResultResponse(BaseModel):
    id: int
    prospect_id: int
    campaign_id: int
    issue_type: Optional[str] = None
    issue_detail: Optional[str] = None
    secondary_issue: Optional[str] = None
    secondary_detail: Optional[str] = None
    confidence: str
    site_quality: str
    needs_verification: bool
    pass_2_completed: bool
    generated_subject: Optional[str] = None
    generated_body: Optional[str] = None
    word_count: Optional[int] = None
    desktop_screenshot: Optional[str] = None  # base64
    mobile_screenshot: Optional[str] = None  # base64
    status: str
    rejection_reason: Optional[str] = None
    was_edited: bool
    edited_subject: Optional[str] = None
    edited_body: Optional[str] = None
    audit_duration_seconds: Optional[float] = None
    ai_cost_estimate: Optional[float] = None
    created_at: datetime

    # Prospect info (joined)
    prospect_name: Optional[str] = None
    prospect_company: Optional[str] = None
    prospect_niche: Optional[str] = None
    prospect_city: Optional[str] = None
    prospect_email: Optional[str] = None

    class Config:
        from_attributes = True


class AuditApproveRequest(BaseModel):
    """Approve an audit and optionally edit the email."""
    edited_subject: Optional[str] = None
    edited_body: Optional[str] = None


class AuditRejectRequest(BaseModel):
    """Reject an audit with a reason."""
    rejection_reason: str


class BatchAuditResponse(BaseModel):
    batch_id: str
    total: int
    message: str


class BatchProgressResponse(BaseModel):
    batch_id: str
    completed: int
    total: int
    errors: int
    current_prospect: Optional[str] = None
    is_complete: bool
    is_cancelled: bool


# --- Experiment Schemas ---

class ExperimentResponse(BaseModel):
    id: int
    prospect_id: int
    campaign_id: int
    audit_id: int
    status: str
    issue_type: Optional[str] = None
    issue_detail: Optional[str] = None
    secondary_issue: Optional[str] = None
    confidence: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    word_count: Optional[int] = None
    was_edited: bool
    niche: Optional[str] = None
    city: Optional[str] = None
    company: Optional[str] = None
    sent_at: Optional[datetime] = None
    day_of_week: Optional[str] = None
    step_number: int
    replied: bool
    reply_at: Optional[datetime] = None
    response_time_minutes: Optional[int] = None
    sentiment: Optional[str] = None
    category: Optional[str] = None
    converted_to_call: bool
    converted_to_client: bool
    deal_value: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExperimentListResponse(BaseModel):
    experiments: list[ExperimentResponse]
    total_count: int
    page: int
    page_size: int


# --- Analytics Schemas ---

class IssueTypeStats(BaseModel):
    issue_type: str
    sent: int
    replied: int
    reply_rate: float
    confidence: str  # Based on sample size


class NicheStats(BaseModel):
    niche: str
    sent: int
    replied: int
    reply_rate: float
    best_issue_type: Optional[str] = None


class TimingStats(BaseModel):
    day_of_week: str
    sent: int
    replied: int
    reply_rate: float


class AnalyticsOverview(BaseModel):
    total_experiments: int
    total_sent: int
    total_replied: int
    overall_reply_rate: float
    best_issue_type: Optional[str] = None
    best_niche: Optional[str] = None
    avg_response_time_minutes: Optional[float] = None
    total_ai_cost: float


class AnalyticsByIssueType(BaseModel):
    stats: list[IssueTypeStats]


class AnalyticsByNiche(BaseModel):
    stats: list[NicheStats]


class AnalyticsByTiming(BaseModel):
    stats: list[TimingStats]


# --- Insight Schemas ---

class InsightResponse(BaseModel):
    id: int
    insight: str
    confidence: str
    sample_size: int
    recommendation: Optional[str] = None
    applies_to: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Gmail Schemas ---

class GmailAuthUrlResponse(BaseModel):
    auth_url: str


class GmailStatusResponse(BaseModel):
    is_connected: bool
    email_address: Optional[str] = None
    last_poll_at: Optional[datetime] = None
    is_active: bool


class EmailMatchResponse(BaseModel):
    id: int
    prospect_id: int
    direction: str
    from_email: str
    to_email: str
    subject: Optional[str] = None
    body_text: Optional[str] = None
    received_at: datetime
    sentiment: Optional[str] = None
    category: Optional[str] = None
    key_quote: Optional[str] = None
    suggested_action: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Settings Schemas ---

class AutoresearchSettingsResponse(BaseModel):
    audit_prompt: Optional[str] = None
    audit_model: str
    classifier_model: str
    learning_model: str
    min_page_load_wait: int
    enable_pass_2: bool
    max_batch_size: int
    # Gmail status (joined)
    gmail_connected: bool
    gmail_email: Optional[str] = None
    # Cost tracking
    monthly_cost: float
    total_audits: int

    class Config:
        from_attributes = True


class AutoresearchSettingsUpdate(BaseModel):
    audit_prompt: Optional[str] = None
    audit_model: Optional[str] = None
    classifier_model: Optional[str] = None
    learning_model: Optional[str] = None
    min_page_load_wait: Optional[int] = None
    enable_pass_2: Optional[bool] = None
    max_batch_size: Optional[int] = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/autoresearch.py
git commit -m "feat: add autoresearch Pydantic schemas"
```

---

### Task 4: Playwright Audit Service

**Files:**
- Create: `backend/app/services/audit_service.py`

This is the core service that visits websites, takes screenshots, and sends them to Claude Vision.

- [ ] **Step 1: Create the audit service**

Create `backend/app/services/audit_service.py`:

```python
import asyncio
import base64
import json
import logging
import os
import time
from datetime import datetime
from typing import Optional

import anthropic
from anthropic import AsyncAnthropic
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# Default audit prompt (user can override in settings)
DEFAULT_AUDIT_PROMPT = """<role>
You are a cold email copywriter for an Australian WordPress developer named Joji who works with tradies (HVAC, plumbing, electrical, roofing, landscaping, building). You will analyze a prospect's website screenshots and extracted data, find ONE or TWO real problems, and write a short cold email.
</role>

<task>
Analyze the homepage screenshots (desktop and mobile) and the extracted text/links. Find the biggest problem costing them customers. Write a cold email under 80 words.
</task>

<core_principle>
The prospect is a tradie. They care about ONE thing: is my website helping me get more jobs, or is it turning customers away?

Every problem you flag must pass this test: "If I told this tradie about this problem face to face, would they immediately understand why it matters?"

PROBLEMS THAT LAND (tradie gets it instantly):
- Buttons/links going to wrong pages
- Placeholder text or typos
- No phone number visible without scrolling
- Site looks 10 years old
- Reviews widget frozen on old dates
- On a phone the site is impossible to use
- Popup covering content

NEVER lead with: alt text, meta descriptions, schema markup, image formats, HTTP requests, render-blocking resources, or any invisible code issue.
</core_principle>

<output_format>
Return ONLY valid JSON with these fields:
{
  "issue_type": "broken_links|broken_forms|dead_pages|placeholder_text|typos|duplicate_content|frozen_reviews|no_reviews|no_real_photos|no_contact_visible|poor_mobile|popup_blocking|wall_of_text|outdated_design|cluttered_layout|slow_load|invisible_on_google|vague_heading",
  "issue_detail": "1-2 sentences describing the specific problem found",
  "secondary_issue": "same enum or null",
  "secondary_detail": "1-2 sentences or null",
  "confidence": "high|medium|low",
  "needs_verification": true/false,
  "verify_actions": ["click Learn More button under Residential"] or null,
  "subject": "Under 8 words, factual",
  "body": "G'day {name}, ... Cheers,\\nJoji Shiotsuki | Joji Web Solutions | jojishiotsuki.com\\n\\nNot interested? Just reply \\"stop\\" and I won't email again.",
  "word_count": 74,
  "site_quality": "good|medium|poor"
}

If the site is genuinely good, return:
{
  "site_quality": "good",
  "issue_type": null,
  "subject": null,
  "body": null,
  "skip_reason": "Site is well-designed with clear contact info and recent reviews"
}
</output_format>"""


class AuditService:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    async def capture_screenshots(
        self, url: str, min_wait: int = 3
    ) -> dict:
        """Visit a URL with Playwright, capture desktop + mobile screenshots and extract data."""
        start_time = time.time()
        result = {
            "desktop_screenshot": None,
            "mobile_screenshot": None,
            "extracted_text": "",
            "link_map": [],
            "error": None,
        }

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)

                # Desktop screenshot (1440px wide)
                desktop_page = await browser.new_page(viewport={"width": 1440, "height": 900})
                try:
                    await desktop_page.goto(url, wait_until="networkidle", timeout=30000)
                except Exception:
                    # Fallback: wait for load event if networkidle times out
                    try:
                        await desktop_page.goto(url, wait_until="load", timeout=30000)
                    except Exception as e:
                        result["error"] = f"Failed to load page: {str(e)}"
                        await browser.close()
                        return result

                # Wait minimum seconds for JS rendering
                await asyncio.sleep(min_wait)

                # Scroll to bottom to trigger lazy loading
                await desktop_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(1)
                await desktop_page.evaluate("window.scrollTo(0, 0)")
                await asyncio.sleep(0.5)

                # Take full-page desktop screenshot
                desktop_bytes = await desktop_page.screenshot(full_page=True, type="png")
                result["desktop_screenshot"] = base64.b64encode(desktop_bytes).decode("utf-8")

                # Extract visible text
                result["extracted_text"] = await desktop_page.evaluate(
                    "() => document.body.innerText.substring(0, 5000)"
                )

                # Extract link map
                result["link_map"] = await desktop_page.evaluate("""
                    () => Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
                        text: a.innerText.trim().substring(0, 100),
                        href: a.href,
                        visible: a.offsetParent !== null
                    }))
                """)

                await desktop_page.close()

                # Mobile screenshot (375px wide)
                mobile_page = await browser.new_page(viewport={"width": 375, "height": 812})
                try:
                    await mobile_page.goto(url, wait_until="networkidle", timeout=30000)
                except Exception:
                    await mobile_page.goto(url, wait_until="load", timeout=15000)

                await asyncio.sleep(min_wait)
                mobile_bytes = await mobile_page.screenshot(full_page=True, type="png")
                result["mobile_screenshot"] = base64.b64encode(mobile_bytes).decode("utf-8")

                await mobile_page.close()
                await browser.close()

        except Exception as e:
            result["error"] = f"Browser error: {str(e)}"
            logger.error(f"Screenshot capture failed for {url}: {e}")

        result["duration_seconds"] = round(time.time() - start_time, 1)
        return result

    async def analyze_with_claude(
        self,
        screenshots: dict,
        prospect_name: str,
        prospect_company: str,
        prospect_niche: str,
        prospect_city: str,
        audit_prompt: str,
        learning_context: Optional[str] = None,
    ) -> dict:
        """Send screenshots + data to Claude Vision for analysis."""
        # Build message content
        content = []

        # Add desktop screenshot
        if screenshots.get("desktop_screenshot"):
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": screenshots["desktop_screenshot"],
                },
            })
            content.append({"type": "text", "text": "Above: Desktop screenshot (1440px wide)"})

        # Add mobile screenshot
        if screenshots.get("mobile_screenshot"):
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": screenshots["mobile_screenshot"],
                },
            })
            content.append({"type": "text", "text": "Above: Mobile screenshot (375px wide)"})

        # Add extracted text and links
        text_context = f"""
Extracted text from homepage (first 5000 chars):
{screenshots.get('extracted_text', 'N/A')}

Link map (visible links and their destinations):
{json.dumps(screenshots.get('link_map', []), indent=2)[:3000]}

Prospect info:
- Name: {prospect_name}
- Company: {prospect_company}
- Trade/Niche: {prospect_niche}
- City: {prospect_city}
"""
        if learning_context:
            text_context += f"\n{learning_context}"

        content.append({"type": "text", "text": text_context})

        # Call Claude Vision
        start_time = time.time()
        response = await self.client.messages.create(
            model=os.getenv("AUTORESEARCH_AUDIT_MODEL", "claude-sonnet-4-6-20250514"),
            max_tokens=1000,
            system=audit_prompt,
            messages=[{"role": "user", "content": content}],
        )

        # Parse response
        response_text = response.content[0].text
        api_duration = round(time.time() - start_time, 1)

        # Calculate cost estimate
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        # Sonnet 4.6 pricing: $3/M input, $15/M output
        cost = (input_tokens * 3 / 1_000_000) + (output_tokens * 15 / 1_000_000)

        try:
            # Try to parse JSON from response
            # Handle potential markdown code blocks
            clean = response_text.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            audit_data = json.loads(clean)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse Claude response as JSON: {response_text[:200]}")
            audit_data = {
                "issue_type": None,
                "site_quality": "medium",
                "confidence": "low",
                "subject": None,
                "body": None,
                "error": "Failed to parse AI response",
            }

        audit_data["_meta"] = {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_estimate": round(cost, 4),
            "api_duration_seconds": api_duration,
        }

        return audit_data

    async def verify_findings(
        self, url: str, verify_actions: list[str]
    ) -> dict:
        """Pass 2: Click flagged elements and screenshot the destinations."""
        verification_results = []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(viewport={"width": 1440, "height": 900})

                await page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(2)

                for action in verify_actions[:5]:  # Max 5 verifications
                    try:
                        # Try to find and click the element described
                        # Use text matching as primary strategy
                        element = page.get_by_text(action, exact=False).first
                        if element:
                            await element.click()
                            await asyncio.sleep(2)
                            screenshot_bytes = await page.screenshot(type="png")
                            current_url = page.url
                            verification_results.append({
                                "action": action,
                                "destination_url": current_url,
                                "screenshot": base64.b64encode(screenshot_bytes).decode("utf-8"),
                                "success": True,
                            })
                            await page.go_back()
                            await asyncio.sleep(1)
                        else:
                            verification_results.append({
                                "action": action,
                                "success": False,
                                "error": "Element not found",
                            })
                    except Exception as e:
                        verification_results.append({
                            "action": action,
                            "success": False,
                            "error": str(e),
                        })

                await browser.close()

        except Exception as e:
            logger.error(f"Verification failed for {url}: {e}")

        return {"verifications": verification_results}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/audit_service.py
git commit -m "feat: add Playwright + Claude Vision audit service"
```

---

### Task 5: Autoresearch API Routes (Phase 1 — Audit Endpoints)

**Files:**
- Create: `backend/app/routes/autoresearch.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create autoresearch router with audit endpoints**

Create `backend/app/routes/autoresearch.py`:

```python
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database.connection import get_db
from app.models.autoresearch import AuditResult, AutoresearchSettings, Experiment
from app.models.outreach import OutreachProspect, OutreachCampaign
from app.schemas.autoresearch import (
    AuditApproveRequest,
    AuditRejectRequest,
    AuditResultResponse,
    AutoresearchSettingsUpdate,
    BatchAuditResponse,
    BatchProgressResponse,
)
from app.services.audit_service import AuditService, DEFAULT_AUDIT_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/autoresearch", tags=["autoresearch"])

# In-memory batch job tracking
_batch_jobs: dict = {}
audit_service = AuditService()


# --- Audit Endpoints ---

@router.post("/audit/{prospect_id}")
async def audit_prospect(
    prospect_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Audit a single prospect's website."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    if not prospect.website:
        raise HTTPException(status_code=400, detail="Prospect has no website URL")

    # Get settings
    settings = db.query(AutoresearchSettings).filter(
        AutoresearchSettings.user_id == current_user.id
    ).first()
    audit_prompt = settings.audit_prompt if settings and settings.audit_prompt else DEFAULT_AUDIT_PROMPT
    min_wait = settings.min_page_load_wait if settings else 3

    # Get learning context if available
    learning_context = None
    # TODO: Phase 4 — inject learning context from learning_service

    # Capture screenshots
    screenshots = await audit_service.capture_screenshots(
        url=prospect.website, min_wait=min_wait
    )

    if screenshots.get("error"):
        # Store failed audit
        audit = AuditResult(
            prospect_id=prospect_id,
            campaign_id=prospect.campaign_id,
            status="skipped",
            rejection_reason=f"Screenshot capture failed: {screenshots['error']}",
            audit_duration_seconds=screenshots.get("duration_seconds"),
            created_at=datetime.utcnow(),
        )
        db.add(audit)
        db.commit()
        db.refresh(audit)
        return {"id": audit.id, "status": "skipped", "error": screenshots["error"]}

    # Analyze with Claude Vision
    audit_data = await audit_service.analyze_with_claude(
        screenshots=screenshots,
        prospect_name=prospect.contact_name or "there",
        prospect_company=prospect.agency_name or "",
        prospect_niche=prospect.niche or "",
        prospect_city="",  # Extract from prospect if available
        audit_prompt=audit_prompt,
        learning_context=learning_context,
    )

    # Determine status
    status = "pending_review"
    if audit_data.get("site_quality") == "good":
        status = "skipped"

    # Store audit result
    meta = audit_data.get("_meta", {})
    audit = AuditResult(
        prospect_id=prospect_id,
        campaign_id=prospect.campaign_id,
        issue_type=audit_data.get("issue_type"),
        issue_detail=audit_data.get("issue_detail"),
        secondary_issue=audit_data.get("secondary_issue"),
        secondary_detail=audit_data.get("secondary_detail"),
        confidence=audit_data.get("confidence", "medium"),
        site_quality=audit_data.get("site_quality", "medium"),
        needs_verification=audit_data.get("needs_verification", False),
        generated_subject=audit_data.get("subject"),
        generated_body=audit_data.get("body"),
        word_count=audit_data.get("word_count"),
        desktop_screenshot=screenshots.get("desktop_screenshot"),
        mobile_screenshot=screenshots.get("mobile_screenshot"),
        status=status,
        audit_duration_seconds=screenshots.get("duration_seconds"),
        model_used=meta.get("model", "claude-sonnet-4-6-20250514"),
        tokens_used=(meta.get("input_tokens", 0) + meta.get("output_tokens", 0)),
        ai_cost_estimate=meta.get("cost_estimate"),
        created_at=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)

    return {
        "id": audit.id,
        "status": audit.status,
        "issue_type": audit.issue_type,
        "confidence": audit.confidence,
        "site_quality": audit.site_quality,
        "subject": audit.generated_subject,
    }


async def _run_batch_audit(batch_id: str, campaign_id: int, db_factory, user_id: int):
    """Background task: audit all queued prospects in a campaign."""
    db = db_factory()
    try:
        settings = db.query(AutoresearchSettings).filter(
            AutoresearchSettings.user_id == user_id
        ).first()
        max_batch = settings.max_batch_size if settings else 50

        # Get queued prospects with websites that haven't been audited
        already_audited = db.query(AuditResult.prospect_id).filter(
            AuditResult.campaign_id == campaign_id
        ).subquery()

        prospects = (
            db.query(OutreachProspect)
            .filter(
                OutreachProspect.campaign_id == campaign_id,
                OutreachProspect.website.isnot(None),
                OutreachProspect.website != "",
                ~OutreachProspect.id.in_(already_audited),
            )
            .limit(max_batch)
            .all()
        )

        job = _batch_jobs[batch_id]
        job["total"] = len(prospects)

        for prospect in prospects:
            if job.get("cancelled"):
                break

            job["current_prospect"] = prospect.agency_name or prospect.contact_name

            try:
                audit_prompt = settings.audit_prompt if settings and settings.audit_prompt else DEFAULT_AUDIT_PROMPT
                min_wait = settings.min_page_load_wait if settings else 3

                screenshots = await audit_service.capture_screenshots(
                    url=prospect.website, min_wait=min_wait
                )

                if screenshots.get("error"):
                    audit = AuditResult(
                        prospect_id=prospect.id,
                        campaign_id=campaign_id,
                        status="skipped",
                        rejection_reason=f"Screenshot failed: {screenshots['error']}",
                        audit_duration_seconds=screenshots.get("duration_seconds"),
                    )
                    db.add(audit)
                    db.commit()
                    job["errors"] += 1
                else:
                    audit_data = await audit_service.analyze_with_claude(
                        screenshots=screenshots,
                        prospect_name=prospect.contact_name or "there",
                        prospect_company=prospect.agency_name or "",
                        prospect_niche=prospect.niche or "",
                        prospect_city="",
                        audit_prompt=audit_prompt,
                    )

                    status = "pending_review"
                    if audit_data.get("site_quality") == "good":
                        status = "skipped"

                    meta = audit_data.get("_meta", {})
                    audit = AuditResult(
                        prospect_id=prospect.id,
                        campaign_id=campaign_id,
                        issue_type=audit_data.get("issue_type"),
                        issue_detail=audit_data.get("issue_detail"),
                        secondary_issue=audit_data.get("secondary_issue"),
                        secondary_detail=audit_data.get("secondary_detail"),
                        confidence=audit_data.get("confidence", "medium"),
                        site_quality=audit_data.get("site_quality", "medium"),
                        needs_verification=audit_data.get("needs_verification", False),
                        generated_subject=audit_data.get("subject"),
                        generated_body=audit_data.get("body"),
                        word_count=audit_data.get("word_count"),
                        desktop_screenshot=screenshots.get("desktop_screenshot"),
                        mobile_screenshot=screenshots.get("mobile_screenshot"),
                        status=status,
                        audit_duration_seconds=screenshots.get("duration_seconds"),
                        model_used=meta.get("model"),
                        tokens_used=(meta.get("input_tokens", 0) + meta.get("output_tokens", 0)),
                        ai_cost_estimate=meta.get("cost_estimate"),
                    )
                    db.add(audit)
                    db.commit()

                job["completed"] += 1

            except Exception as e:
                logger.error(f"Batch audit error for prospect {prospect.id}: {e}")
                job["errors"] += 1
                job["completed"] += 1

        job["is_complete"] = True

    except Exception as e:
        logger.error(f"Batch audit {batch_id} failed: {e}")
        _batch_jobs[batch_id]["is_complete"] = True
        _batch_jobs[batch_id]["errors"] += 1
    finally:
        db.close()


@router.post("/audit/batch/{campaign_id}", response_model=BatchAuditResponse)
async def batch_audit_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Start a batch audit of all queued prospects in a campaign."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Count prospects to audit
    already_audited = db.query(AuditResult.prospect_id).filter(
        AuditResult.campaign_id == campaign_id
    ).subquery()

    count = (
        db.query(OutreachProspect)
        .filter(
            OutreachProspect.campaign_id == campaign_id,
            OutreachProspect.website.isnot(None),
            OutreachProspect.website != "",
            ~OutreachProspect.id.in_(already_audited),
        )
        .count()
    )

    if count == 0:
        raise HTTPException(status_code=400, detail="No prospects to audit")

    batch_id = str(uuid.uuid4())
    _batch_jobs[batch_id] = {
        "completed": 0,
        "total": count,
        "errors": 0,
        "current_prospect": None,
        "is_complete": False,
        "cancelled": False,
    }

    # Use db session factory for background task
    from app.database.connection import SessionLocal
    background_tasks.add_task(
        _run_batch_audit, batch_id, campaign_id, SessionLocal, current_user.id
    )

    return BatchAuditResponse(batch_id=batch_id, total=count, message=f"Started auditing {count} prospects")


@router.get("/audit/batch/{batch_id}/progress", response_model=BatchProgressResponse)
async def batch_audit_progress(batch_id: str):
    """Get progress of a batch audit."""
    job = _batch_jobs.get(batch_id)
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    return BatchProgressResponse(
        batch_id=batch_id,
        completed=job["completed"],
        total=job["total"],
        errors=job["errors"],
        current_prospect=job.get("current_prospect"),
        is_complete=job["is_complete"],
        is_cancelled=job.get("cancelled", False),
    )


@router.post("/audit/batch/{batch_id}/cancel")
async def cancel_batch_audit(batch_id: str):
    """Cancel a running batch audit."""
    job = _batch_jobs.get(batch_id)
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    job["cancelled"] = True
    return {"message": "Cancellation requested"}


@router.get("/audits/{prospect_id}")
async def get_audit_results(
    prospect_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get audit results for a prospect."""
    audits = (
        db.query(AuditResult)
        .filter(AuditResult.prospect_id == prospect_id)
        .order_by(AuditResult.created_at.desc())
        .all()
    )
    return audits


@router.get("/audits")
async def list_audits(
    campaign_id: Optional[int] = None,
    status: Optional[str] = None,
    confidence: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all audits with filters."""
    query = db.query(AuditResult)
    if campaign_id:
        query = query.filter(AuditResult.campaign_id == campaign_id)
    if status:
        query = query.filter(AuditResult.status == status)
    if confidence:
        query = query.filter(AuditResult.confidence == confidence)

    total = query.count()
    audits = (
        query.order_by(AuditResult.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Enrich with prospect info
    results = []
    for audit in audits:
        prospect = db.query(OutreachProspect).filter(OutreachProspect.id == audit.prospect_id).first()
        result = {
            **{c.name: getattr(audit, c.name) for c in audit.__table__.columns},
            "prospect_name": prospect.contact_name if prospect else None,
            "prospect_company": prospect.agency_name if prospect else None,
            "prospect_niche": prospect.niche if prospect else None,
            "prospect_email": prospect.email if prospect else None,
        }
        results.append(result)

    return {"audits": results, "total_count": total, "page": page, "page_size": page_size}


@router.put("/audits/{audit_id}/approve")
async def approve_audit(
    audit_id: int,
    request: AuditApproveRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Approve an audit and create an experiment record."""
    audit = db.query(AuditResult).filter(AuditResult.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    # Update audit status
    audit.status = "approved"
    if request.edited_subject or request.edited_body:
        audit.was_edited = True
        audit.edited_subject = request.edited_subject
        audit.edited_body = request.edited_body

    # Determine final email content
    final_subject = request.edited_subject or audit.generated_subject
    final_body = request.edited_body or audit.generated_body

    # Update prospect's custom email fields (integrates with existing CopyEmailModal)
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == audit.prospect_id).first()
    if prospect:
        prospect.custom_email_subject = final_subject
        prospect.custom_email_body = final_body

    # Create experiment record
    edit_type = None
    if audit.was_edited:
        if request.edited_subject and request.edited_body:
            edit_type = "rewrite"
        elif request.edited_subject:
            edit_type = "subject_only"
        else:
            edit_type = "minor_tweak"

    experiment = Experiment(
        prospect_id=audit.prospect_id,
        campaign_id=audit.campaign_id,
        audit_id=audit.id,
        status="draft",
        issue_type=audit.issue_type,
        issue_detail=audit.issue_detail,
        secondary_issue=audit.secondary_issue,
        secondary_detail=audit.secondary_detail,
        confidence=audit.confidence,
        site_quality=audit.site_quality,
        pass_2_triggered=audit.pass_2_completed,
        subject=final_subject,
        body=final_body,
        word_count=audit.word_count,
        was_edited=audit.was_edited,
        edit_type=edit_type,
        niche=prospect.niche if prospect else None,
        city=None,  # Extract if available
        state=None,
        company=prospect.agency_name if prospect else None,
        step_number=1,
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    return {
        "audit_id": audit.id,
        "experiment_id": experiment.id,
        "subject": final_subject,
        "body": final_body,
    }


@router.put("/audits/{audit_id}/reject")
async def reject_audit(
    audit_id: int,
    request: AuditRejectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Reject an audit with feedback for learning."""
    audit = db.query(AuditResult).filter(AuditResult.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    audit.status = "rejected"
    audit.rejection_reason = request.rejection_reason
    db.commit()

    return {"message": "Audit rejected", "rejection_reason": request.rejection_reason}


# --- Settings Endpoints ---

@router.get("/settings")
async def get_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get autoresearch settings."""
    settings = db.query(AutoresearchSettings).filter(
        AutoresearchSettings.user_id == current_user.id
    ).first()

    if not settings:
        # Create default settings
        settings = AutoresearchSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Get Gmail status
    from app.models.autoresearch import GmailToken
    gmail = db.query(GmailToken).filter(GmailToken.user_id == current_user.id).first()

    # Get cost this month
    from sqlalchemy import func
    monthly_cost = db.query(func.sum(AuditResult.ai_cost_estimate)).filter(
        AuditResult.created_at >= datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    ).scalar() or 0.0

    total_audits = db.query(AuditResult).filter(
        AuditResult.created_at >= datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    ).count()

    return {
        "audit_prompt": settings.audit_prompt or DEFAULT_AUDIT_PROMPT,
        "audit_model": settings.audit_model,
        "classifier_model": settings.classifier_model,
        "learning_model": settings.learning_model,
        "min_page_load_wait": settings.min_page_load_wait,
        "enable_pass_2": settings.enable_pass_2,
        "max_batch_size": settings.max_batch_size,
        "gmail_connected": gmail is not None and gmail.is_active if gmail else False,
        "gmail_email": gmail.email_address if gmail else None,
        "monthly_cost": round(monthly_cost, 2),
        "total_audits": total_audits,
    }


@router.put("/settings")
async def update_settings(
    updates: AutoresearchSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update autoresearch settings."""
    settings = db.query(AutoresearchSettings).filter(
        AutoresearchSettings.user_id == current_user.id
    ).first()

    if not settings:
        settings = AutoresearchSettings(user_id=current_user.id)
        db.add(settings)

    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)

    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)

    return {"message": "Settings updated"}
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add the import and router registration. Add after the existing router includes (around line 174):

```python
from app.routes import autoresearch as autoresearch_router
app.include_router(autoresearch_router.router, prefix="/api")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes/autoresearch.py backend/app/main.py
git commit -m "feat: add autoresearch API routes (audit + settings endpoints)"
```

---

### Task 6: Frontend Types and API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript types**

Add to the end of `frontend/src/types/index.ts`:

```typescript
// --- Autoresearch Types ---

export enum AuditStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
}

export enum AuditConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum SiteQuality {
  GOOD = 'good',
  MEDIUM = 'medium',
  POOR = 'poor',
}

export enum ExperimentStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  REPLIED = 'replied',
  NO_REPLY = 'no_reply',
  BOUNCED = 'bounced',
}

export interface AuditResult {
  id: number;
  prospect_id: number;
  campaign_id: number;
  issue_type: string | null;
  issue_detail: string | null;
  secondary_issue: string | null;
  secondary_detail: string | null;
  confidence: string;
  site_quality: string;
  needs_verification: boolean;
  pass_2_completed: boolean;
  generated_subject: string | null;
  generated_body: string | null;
  word_count: number | null;
  desktop_screenshot: string | null;
  mobile_screenshot: string | null;
  status: string;
  rejection_reason: string | null;
  was_edited: boolean;
  edited_subject: string | null;
  edited_body: string | null;
  audit_duration_seconds: number | null;
  ai_cost_estimate: number | null;
  created_at: string;
  // Joined prospect info
  prospect_name: string | null;
  prospect_company: string | null;
  prospect_niche: string | null;
  prospect_email: string | null;
}

export interface AuditListResponse {
  audits: AuditResult[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface BatchAuditResponse {
  batch_id: string;
  total: number;
  message: string;
}

export interface BatchProgress {
  batch_id: string;
  completed: number;
  total: number;
  errors: number;
  current_prospect: string | null;
  is_complete: boolean;
  is_cancelled: boolean;
}

export interface ExperimentRecord {
  id: number;
  prospect_id: number;
  campaign_id: number;
  audit_id: number;
  status: string;
  issue_type: string | null;
  issue_detail: string | null;
  secondary_issue: string | null;
  confidence: string | null;
  subject: string | null;
  body: string | null;
  word_count: number | null;
  was_edited: boolean;
  niche: string | null;
  city: string | null;
  company: string | null;
  sent_at: string | null;
  day_of_week: string | null;
  step_number: number;
  replied: boolean;
  reply_at: string | null;
  response_time_minutes: number | null;
  sentiment: string | null;
  category: string | null;
  converted_to_call: boolean;
  converted_to_client: boolean;
  deal_value: number | null;
  created_at: string;
}

export interface ExperimentListResponse {
  experiments: ExperimentRecord[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface IssueTypeStats {
  issue_type: string;
  sent: number;
  replied: number;
  reply_rate: number;
  confidence: string;
}

export interface NicheStats {
  niche: string;
  sent: number;
  replied: number;
  reply_rate: number;
  best_issue_type: string | null;
}

export interface TimingStats {
  day_of_week: string;
  sent: number;
  replied: number;
  reply_rate: number;
}

export interface AnalyticsOverview {
  total_experiments: number;
  total_sent: number;
  total_replied: number;
  overall_reply_rate: number;
  best_issue_type: string | null;
  best_niche: string | null;
  avg_response_time_minutes: number | null;
  total_ai_cost: number;
}

export interface InsightRecord {
  id: number;
  insight: string;
  confidence: string;
  sample_size: number;
  recommendation: string | null;
  applies_to: string;
  is_active: boolean;
  created_at: string;
}

export interface AutoresearchSettings {
  audit_prompt: string | null;
  audit_model: string;
  classifier_model: string;
  learning_model: string;
  min_page_load_wait: number;
  enable_pass_2: boolean;
  max_batch_size: number;
  gmail_connected: boolean;
  gmail_email: string | null;
  monthly_cost: number;
  total_audits: number;
}
```

- [ ] **Step 2: Add API client**

Add to `frontend/src/lib/api.ts` (at the end, before any closing brackets). Use the existing `api` axios instance (which auto-attaches the JWT token via interceptor):

```typescript
// --- Autoresearch API ---

export const autoresearchApi = {
  // Audits
  auditProspect: async (prospectId: number) => {
    const { data } = await api.post(`/autoresearch/audit/${prospectId}`);
    return data;
  },

  batchAudit: async (campaignId: number): Promise<BatchAuditResponse> => {
    const { data } = await api.post(`/autoresearch/audit/batch/${campaignId}`);
    return data;
  },

  getBatchProgress: async (batchId: string): Promise<BatchProgress> => {
    const { data } = await api.get(`/autoresearch/audit/batch/${batchId}/progress`);
    return data;
  },

  cancelBatch: async (batchId: string) => {
    const { data } = await api.post(`/autoresearch/audit/batch/${batchId}/cancel`);
    return data;
  },

  listAudits: async (params?: {
    campaign_id?: number;
    status?: string;
    confidence?: string;
    page?: number;
    page_size?: number;
  }): Promise<AuditListResponse> => {
    const { data } = await api.get('/autoresearch/audits', { params });
    return data;
  },

  approveAudit: async (auditId: number, body?: { edited_subject?: string; edited_body?: string }) => {
    const { data } = await api.put(`/autoresearch/audits/${auditId}/approve`, body || {});
    return data;
  },

  rejectAudit: async (auditId: number, reason: string) => {
    const { data } = await api.put(`/autoresearch/audits/${auditId}/reject`, { rejection_reason: reason });
    return data;
  },

  // Experiments
  listExperiments: async (params?: {
    campaign_id?: number;
    niche?: string;
    issue_type?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<ExperimentListResponse> => {
    const { data } = await api.get('/autoresearch/experiments', { params });
    return data;
  },

  // Analytics
  getAnalyticsOverview: async (): Promise<AnalyticsOverview> => {
    const { data } = await api.get('/autoresearch/analytics/overview');
    return data;
  },

  getAnalyticsByIssueType: async (): Promise<{ stats: IssueTypeStats[] }> => {
    const { data } = await api.get('/autoresearch/analytics/by-issue-type');
    return data;
  },

  getAnalyticsByNiche: async (): Promise<{ stats: NicheStats[] }> => {
    const { data } = await api.get('/autoresearch/analytics/by-niche');
    return data;
  },

  getAnalyticsByTiming: async (): Promise<{ stats: TimingStats[] }> => {
    const { data } = await api.get('/autoresearch/analytics/by-timing');
    return data;
  },

  getAnalyticsTrends: async (): Promise<{ stats: any[] }> => {
    const { data } = await api.get('/autoresearch/analytics/trends');
    return data;
  },

  // Insights
  getInsights: async (): Promise<InsightRecord[]> => {
    const { data } = await api.get('/autoresearch/insights');
    return data;
  },

  refreshInsights: async () => {
    const { data } = await api.post('/autoresearch/insights/refresh');
    return data;
  },

  // Gmail
  getGmailAuthUrl: async (): Promise<{ auth_url: string }> => {
    const { data } = await api.get('/autoresearch/gmail/auth-url');
    return data;
  },

  getGmailStatus: async () => {
    const { data } = await api.get('/autoresearch/gmail/status');
    return data;
  },

  disconnectGmail: async () => {
    const { data } = await api.post('/autoresearch/gmail/disconnect');
    return data;
  },

  pollGmail: async () => {
    const { data } = await api.post('/autoresearch/gmail/poll');
    return data;
  },

  // Settings
  getSettings: async (): Promise<AutoresearchSettings> => {
    const { data } = await api.get('/autoresearch/settings');
    return data;
  },

  updateSettings: async (updates: Partial<AutoresearchSettings>) => {
    const { data } = await api.put('/autoresearch/settings', updates);
    return data;
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat: add autoresearch TypeScript types and API client"
```

---

### Task 7: Autoresearch Page + Routing + Sidebar

**Files:**
- Create: `frontend/src/pages/Autoresearch.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create Autoresearch page shell**

Create `frontend/src/pages/Autoresearch.tsx` with 4 tabs (Audits, Insights, Experiments, Settings). Each tab is a placeholder that will be filled in subsequent tasks.

Follow the existing OutreachHub.tsx tab pattern. Use the project's dark mode conventions from CLAUDE.md. Use `FlaskConical` from lucide-react as the page icon.

The page should:
- Have a header with title "Autoresearch" and description
- Tab navigation (Audits, Insights, Experiments, Settings)
- Persist active tab to URL query params (like OutreachHub does)
- Import and render the tab components (which start as simple placeholders)

- [ ] **Step 2: Add route to App.tsx**

In `frontend/src/App.tsx`, add the lazy import and route:

```typescript
const Autoresearch = lazy(() => import('./pages/Autoresearch'));

// In the routes:
<Route path="/autoresearch" element={<Autoresearch />} />
```

- [ ] **Step 3: Add sidebar entry to Layout.tsx**

In `frontend/src/components/Layout.tsx`, add Autoresearch to the sidebar. Place it after "Outreach" in the "Clients" section or create a new section. Use `FlaskConical` icon from lucide-react.

```typescript
{ name: 'Autoresearch', href: '/autoresearch', icon: FlaskConical },
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Autoresearch.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: add Autoresearch page, route, and sidebar entry"
```

---

### Task 8: Audits Tab Component

**Files:**
- Create: `frontend/src/components/autoresearch/AuditsTab.tsx`
- Create: `frontend/src/components/autoresearch/AuditCard.tsx`
- Create: `frontend/src/components/autoresearch/ScreenshotModal.tsx`
- Create: `frontend/src/components/autoresearch/BatchProgress.tsx`

- [ ] **Step 1: Create AuditCard component**

Create `frontend/src/components/autoresearch/AuditCard.tsx`

A card for each audit in the review queue. Shows:
- Confidence badge (green HIGH, yellow MEDIUM, red LOW) or grey SKIPPED
- Prospect name, company, niche, city
- Issue type badge + issue detail text
- Secondary issue (if any)
- Generated subject line (editable inline)
- Generated email body (editable textarea)
- Word count
- Action buttons: "Approve & Copy" (primary), "Edit" (secondary), "Reject" (danger), "View Screenshots", "Skip"

Follow CLAUDE.md card patterns, dark mode conventions, `cn()` usage.

- [ ] **Step 2: Create ScreenshotModal component**

Create `frontend/src/components/autoresearch/ScreenshotModal.tsx`

Modal that shows desktop and mobile screenshots side-by-side (or togglable). Screenshots are base64 images displayed via `<img src="data:image/png;base64,{data}" />`. Follow CLAUDE.md modal pattern.

- [ ] **Step 3: Create BatchProgress component**

Create `frontend/src/components/autoresearch/BatchProgress.tsx`

A progress bar component that:
- Shows "{completed}/{total} audits complete ({errors} errors)"
- Polls `getBatchProgress` every 5 seconds while batch is running
- Shows cancel button
- Shows "current prospect" being audited
- Disappears when complete

- [ ] **Step 4: Create AuditsTab component**

Create `frontend/src/components/autoresearch/AuditsTab.tsx`

The main audits tab that:
- Uses `useQuery` to fetch audits via `autoresearchApi.listAudits`
- Campaign filter dropdown (populated from existing campaigns)
- Status filter (Pending Review, Approved, Rejected, Skipped, All)
- "Audit All Queued" button that triggers batch audit
- Shows BatchProgress component when batch is running
- Renders AuditCard for each audit
- Sorted by confidence (high first)
- Empty state when no audits

- [ ] **Step 5: Wire AuditsTab into Autoresearch page**

Update `frontend/src/pages/Autoresearch.tsx` to import and render `AuditsTab` in the first tab.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/autoresearch/ frontend/src/pages/Autoresearch.tsx
git commit -m "feat: add Audits tab with review queue, audit cards, screenshots, batch progress"
```

---

## Phase 2: Experiment Tracker

### Task 9: Experiment API Endpoints

**Files:**
- Modify: `backend/app/routes/autoresearch.py`

- [ ] **Step 1: Add experiment list and analytics endpoints**

Add to `backend/app/routes/autoresearch.py`:

- `GET /api/autoresearch/experiments` — List experiments with filters (campaign_id, niche, issue_type, status), pagination
- `GET /api/autoresearch/analytics/overview` — Aggregate: total sent, replied, reply rate, best issue type, best niche, avg response time, total cost
- `GET /api/autoresearch/analytics/by-issue-type` — Group by issue_type: sent count, replied count, reply rate, confidence level based on sample size
- `GET /api/autoresearch/analytics/by-niche` — Group by niche: sent count, replied count, reply rate, best issue type per niche
- `GET /api/autoresearch/analytics/by-timing` — Group by day_of_week: sent count, replied count, reply rate
- `GET /api/autoresearch/analytics/trends` — Group by week (using `sent_at`): weekly sent count, replied count, reply rate, to show performance over time
- `POST /api/autoresearch/audits/{audit_id}/reaudit` — Re-audit a rejected prospect with a fresh screenshot capture and Claude analysis. Stores the rejection reason from the previous audit as context so the same mistake isn't repeated.

All analytics should use SQLAlchemy `func.count`, `func.sum` for aggregation. Confidence is derived: 50+ = high, 20-49 = medium, <20 = low.

- [ ] **Step 2: Commit**

```bash
git add backend/app/routes/autoresearch.py
git commit -m "feat: add experiment list and analytics endpoints"
```

---

### Task 10: Experiments Tab Frontend

**Files:**
- Create: `frontend/src/components/autoresearch/ExperimentsTab.tsx`

- [ ] **Step 1: Create ExperimentsTab component**

Create `frontend/src/components/autoresearch/ExperimentsTab.tsx`

Filterable table showing all experiments:
- Filters: Campaign, Niche, Issue Type, Outcome (All/Replied/No Reply/Pending), Date Range
- Columns: Company, Issue Type, Sent Date, Reply Time, Outcome (icon: check for replied, clock for pending, X for exhausted)
- Expandable rows: click to show full audit details, email body, reply text
- Pagination controls at bottom
- Stats bar at top: Total Sent, Reply Rate, Best Issue Type

Follow CLAUDE.md table patterns with dark mode.

- [ ] **Step 2: Wire into Autoresearch page**

Update `frontend/src/pages/Autoresearch.tsx` to render ExperimentsTab in the Experiments tab.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/autoresearch/ExperimentsTab.tsx frontend/src/pages/Autoresearch.tsx
git commit -m "feat: add Experiments tab with filterable log and analytics"
```

---

## Phase 3: Gmail Read-Only Integration

### Task 11: Gmail Service

**Files:**
- Create: `backend/app/services/gmail_service.py`

- [ ] **Step 1: Create Gmail service**

Create `backend/app/services/gmail_service.py` with:

- `get_auth_url(redirect_uri, state)` — Build Google OAuth consent URL with `gmail.readonly` scope
- `handle_callback(code, redirect_uri)` — Exchange auth code for tokens, return refresh token + email
- `encrypt_token(token)` / `decrypt_token(encrypted)` — Fernet encryption using `GMAIL_ENCRYPTION_KEY` env var
- `poll_inbox(db, user_id)` — Fetch new emails since last `history_id`, match to known prospects by email address, classify inbound replies with Claude Haiku
- `classify_reply(text)` — Send reply text to Claude Haiku, return sentiment/category/wants_loom/etc.
- `match_sent_emails(db, user_id)` — Check sent folder, match recipients to prospects, update experiment `sent_at` and status

Use `google-auth-oauthlib` for OAuth flow and `google-api-python-client` for Gmail API calls.

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/gmail_service.py
git commit -m "feat: add Gmail OAuth service with reply polling and classification"
```

---

### Task 12: Gmail API Endpoints

**Files:**
- Modify: `backend/app/routes/autoresearch.py`

- [ ] **Step 1: Add Gmail endpoints to autoresearch router**

Add to `backend/app/routes/autoresearch.py`:

- `GET /api/autoresearch/gmail/auth-url` — Generate OAuth URL with state param
- `GET /api/autoresearch/gmail/callback` — Handle OAuth callback, store encrypted token, redirect to frontend
- `GET /api/autoresearch/gmail/status` — Return connection status
- `POST /api/autoresearch/gmail/poll` — Manual trigger for inbox polling
- `POST /api/autoresearch/gmail/disconnect` — Revoke token, delete from DB

- [ ] **Step 2: Commit**

```bash
git add backend/app/routes/autoresearch.py
git commit -m "feat: add Gmail OAuth and polling API endpoints"
```

---

### Task 13: Scheduler Service

**Files:**
- Create: `backend/app/services/scheduler_service.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create scheduler service**

Create `backend/app/services/scheduler_service.py`:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

async def poll_gmail_job():
    """Scheduled job: poll Gmail for new replies."""
    from app.database.connection import SessionLocal
    from app.services.gmail_service import GmailService
    from app.models.autoresearch import GmailToken

    db = SessionLocal()
    try:
        gmail_service = GmailService()
        tokens = db.query(GmailToken).filter(GmailToken.is_active == True).all()
        for token in tokens:
            await gmail_service.poll_inbox(db, token.user_id)
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(poll_gmail_job, "interval", minutes=5, id="gmail_poll", replace_existing=True)
    scheduler.start()

def stop_scheduler():
    scheduler.shutdown(wait=False)
```

- [ ] **Step 2: Wire scheduler into main.py startup**

In `backend/app/main.py`, modify the EXISTING `startup_event` function (line 194) to also start the scheduler. Do NOT add a new startup handler — merge into the existing one:

```python
from app.services.scheduler_service import start_scheduler, stop_scheduler

# Modify existing startup_event (around line 194):
@app.on_event("startup")
async def startup_event():
    """Initialize database and background scheduler on startup"""
    init_db()
    start_scheduler()

# Add new shutdown event:
@app.on_event("shutdown")
def shutdown_event():
    stop_scheduler()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/scheduler_service.py backend/app/main.py
git commit -m "feat: add APScheduler for Gmail polling background job"
```

---

### Task 14: Settings Tab Frontend (Gmail Connection UI)

**Files:**
- Create: `frontend/src/components/autoresearch/SettingsTab.tsx`

- [ ] **Step 1: Create SettingsTab component**

Create `frontend/src/components/autoresearch/SettingsTab.tsx` with sections:

1. **Gmail Connection** — Status indicator, "Connect Gmail" button (opens OAuth URL in new window), "Disconnect" button, last poll time
2. **AI Model Selection** — Dropdowns for audit model, classifier model, learning model
3. **Audit Settings** — Min page load wait (number input), Enable Pass 2 (checkbox), Max batch size (number input)
4. **Audit Prompt** — Full-width textarea with the base audit prompt, save button
5. **Cost Tracker** — This month's spend, avg per audit, total audits this month

Use `useQuery` for fetching settings, `useMutation` for updates. Follow CLAUDE.md form input patterns.

Handle Gmail OAuth return: check URL for `?gmail=connected` query param and show success toast.

- [ ] **Step 2: Wire into Autoresearch page**

Update `frontend/src/pages/Autoresearch.tsx` to render SettingsTab.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/autoresearch/SettingsTab.tsx frontend/src/pages/Autoresearch.tsx
git commit -m "feat: add Settings tab with Gmail connection, model config, prompt editor"
```

---

## Phase 4: Insights & Learning Engine

### Task 15: Learning Service

**Files:**
- Create: `backend/app/services/learning_service.py`

- [ ] **Step 1: Create learning service**

Create `backend/app/services/learning_service.py` with:

- `generate_insights(db)` — Aggregate experiment data, send to Claude Sonnet for pattern analysis, store structured insights
- `build_learning_context(db, niche)` — Build the `<learning_context>` block to append to audit prompts, prioritizing issue types by reply rate, including niche-specific data
- `should_refresh(db)` — Check if 50+ new experiments since last refresh
- `deactivate_old_insights(db)` — When new insights generated, supersede old ones

The Claude analysis prompt should receive aggregated stats (not raw data) and return structured JSON insights.

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/learning_service.py
git commit -m "feat: add learning engine service for insight generation"
```

---

### Task 16: Insights API Endpoints

**Files:**
- Modify: `backend/app/routes/autoresearch.py`

- [ ] **Step 1: Add insight endpoints**

Add to `backend/app/routes/autoresearch.py`:

- `GET /api/autoresearch/insights` — List active insights
- `POST /api/autoresearch/insights/refresh` — Trigger re-analysis
- `GET /api/autoresearch/insights/history` — All insights including superseded
- `GET /api/autoresearch/learning-context/{niche}` — Return the generated learning context block

- [ ] **Step 2: Wire learning context into audit endpoint**

Update the `audit_prospect` and `_run_batch_audit` functions to call `build_learning_context` and pass it to Claude Vision.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes/autoresearch.py
git commit -m "feat: add insights endpoints and wire learning context into auditor"
```

---

### Task 17: Insights Tab Frontend

**Files:**
- Create: `frontend/src/components/autoresearch/InsightsTab.tsx`

- [ ] **Step 1: Create InsightsTab component**

Create `frontend/src/components/autoresearch/InsightsTab.tsx` showing:

1. **Top Performing Issue Types** — Table with columns: Issue Type, Sent, Replied, Rate, Confidence bar
2. **By Niche** — Table with columns: Niche, Sent, Replied, Rate, Best Issue Type
3. **By Day of Week** — Simple bar chart (using div heights, no chart library needed)
4. **Active Insights** — List of insight cards with confidence badge (green HIGH, yellow MEDIUM, red LOW), recommendation text
5. **"Refresh Insights" button** — Triggers `refreshInsights` mutation

Use `useQuery` to fetch analytics data from the three analytics endpoints + insights endpoint.

- [ ] **Step 2: Wire into Autoresearch page**

Update `frontend/src/pages/Autoresearch.tsx` to render InsightsTab.

- [ ] **Step 3: Add weekly refresh to scheduler**

In `backend/app/services/scheduler_service.py`, add a weekly job:

```python
scheduler.add_job(weekly_learning_refresh, "cron", day_of_week="sun", hour=22, id="weekly_learn", replace_existing=True)
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/autoresearch/InsightsTab.tsx frontend/src/pages/Autoresearch.tsx backend/app/services/scheduler_service.py
git commit -m "feat: add Insights tab with analytics dashboard and weekly refresh"
```

---

## Phase 5: Polish

### Task 18: Edge Cases and Error Handling

**Files:**
- Modify: `backend/app/services/audit_service.py`
- Modify: `backend/app/routes/autoresearch.py`

- [ ] **Step 1: Handle edge cases in audit service**

Add to `audit_service.py`:
- Timeout handling: if a site takes >30s to load, return error gracefully
- Bot detection: if page returns 403 or captcha page, mark as "skipped" with reason
- Empty screenshots: if Chromium crashes, don't send empty images to Claude
- Invalid URLs: validate URL format before launching browser
- Large screenshots: cap screenshot data at 5MB (truncate if larger by reducing quality)

- [ ] **Step 2: Add error handling to routes**

Add proper try/except blocks around all audit operations. Return meaningful error messages. Log errors with context.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/audit_service.py backend/app/routes/autoresearch.py
git commit -m "feat: add edge case handling for audits (timeouts, bot detection, validation)"
```

---

### Task 19: Final Integration Test

- [ ] **Step 1: Start backend and verify endpoints**

Run:
```bash
cd backend && venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Test endpoints:
```bash
# Get settings (should return defaults)
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/autoresearch/settings

# List audits (should return empty)
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/autoresearch/audits
```

- [ ] **Step 2: Start frontend and verify page**

Run:
```bash
cd frontend && npm run dev
```

Navigate to `http://localhost:5173/autoresearch`:
- Verify page loads with 4 tabs
- Verify sidebar entry appears
- Verify dark mode works correctly
- Test audit flow with a real prospect URL

- [ ] **Step 3: Run a single audit end-to-end**

1. Pick a prospect with a website URL
2. Click "Audit" on the prospect
3. Wait for audit to complete
4. Review the generated email
5. Approve or reject
6. Verify experiment record created

- [ ] **Step 4: Commit any fixes**

```bash
git add backend/app/ frontend/src/
git commit -m "fix: integration test fixes for autoresearch"
```
