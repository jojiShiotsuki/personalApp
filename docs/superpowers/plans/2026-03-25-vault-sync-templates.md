# Vault Auto-Sync & Starter Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hook CRM data into the Obsidian vault via GitHub auto-sync, and generate starter templates from real outreach data so Joji AI learns the user's voice.

**Architecture:** The existing `CRMVaultSync` service writes markdown and pushes to GitHub. We add `BackgroundTasks` hooks in CRM routes for immediate sync on key events, a batch scheduler job for minor updates, and a template generation endpoint that pulls real emails from the `Experiment` table.

**Tech Stack:** FastAPI BackgroundTasks, SQLAlchemy, GitPython, APScheduler

**Spec:** `docs/superpowers/specs/2026-03-25-vault-sync-templates-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/services/crm_vault_sync.py` | Modify | Add `batch_crm_sync()`, `generate_starter_templates()`, fix `_push_changes()` |
| `backend/app/routes/crm.py` | Modify | Add BackgroundTasks for contact create, contact status→CLIENT, deal close (both routes) |
| `backend/app/routes/autoresearch.py` | Modify | Add BackgroundTasks for insight generation |
| `backend/app/services/scheduler_service.py` | Modify | Add `crm_batch_sync_job()` on 30-min interval |
| `backend/app/routes/joji_ai.py` | Modify | Add `POST /api/ai/vault/generate-templates` endpoint |
| `frontend/src/lib/api.ts` | Modify | Add `generateVaultTemplates()` API call |
| `frontend/src/components/joji-ai/AISettingsPanel.tsx` | Modify | Add "Generate Vault Templates" button |

---

### Task 1: Fix `_push_changes()` — replace force-push with pull-rebase

**Files:**
- Modify: `backend/app/services/crm_vault_sync.py:268-304`

- [ ] **Step 1: Replace the force-push fallback with pull-rebase**

In `_push_changes()`, replace lines 294-301:

```python
# OLD (force-push fallback — dangerous)
try:
    repo.remotes.origin.push()
except git.GitCommandError as push_err:
    logger.warning("CRM vault sync push failed, attempting force push for crm-sync: %s", push_err)
    try:
        repo.remotes.origin.push(force=True)
    except git.GitCommandError as force_err:
        logger.error("CRM vault sync force push also failed: %s", force_err)
```

Replace with:

```python
try:
    repo.remotes.origin.push()
except git.GitCommandError as push_err:
    logger.warning("CRM vault sync push failed, attempting pull --rebase: %s", push_err)
    try:
        repo.remotes.origin.pull(rebase=True)
        repo.remotes.origin.push()
    except git.GitCommandError as rebase_err:
        logger.error("CRM vault sync pull-rebase failed, skipping push: %s", rebase_err)
```

- [ ] **Step 2: Verify backend starts without errors**

Run: `cd backend && source venv/Scripts/activate && python -c "from app.services.crm_vault_sync import CRMVaultSync; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/crm_vault_sync.py
git commit -m "fix: replace force-push with pull-rebase in CRM vault sync"
```

---

### Task 2: Add `batch_crm_sync()` method to CRMVaultSync

**Files:**
- Modify: `backend/app/services/crm_vault_sync.py`

- [ ] **Step 1: Add a `_write_contact_file()` helper that writes but doesn't push**

Add this method to the class (extracted from `sync_contact` but without git push):

```python
def _write_contact_file(self, db: Session, contact_id: int) -> bool:
    """Write a contact markdown file without pushing. Returns True if file was written."""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return False

    deals = (
        db.query(Deal)
        .filter(Deal.contact_id == contact_id)
        .order_by(Deal.created_at.desc())
        .all()
    )
    interactions = (
        db.query(Interaction)
        .filter(Interaction.contact_id == contact_id)
        .order_by(Interaction.interaction_date.desc())
        .limit(10)
        .all()
    )

    md = self._render_contact_markdown(contact, deals, interactions)
    filename = self._sanitize_filename(contact.name)
    dest = CRM_SYNC_DIR / "contacts" / f"{filename}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(md, encoding="utf-8")
    return True
```

- [ ] **Step 2: Add a `_write_deal_file()` helper**

```python
def _write_deal_file(self, db: Session, deal_id: int) -> bool:
    """Write a deal markdown file without pushing. Returns True if file was written."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        return False

    contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
    md = self._render_deal_markdown(deal, contact)
    filename = self._sanitize_filename(deal.title)
    dest = CRM_SYNC_DIR / "deals" / f"{filename}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(md, encoding="utf-8")
    return True
```

- [ ] **Step 3: Add `batch_crm_sync()`**

```python
def batch_crm_sync(self, db: Session) -> dict:
    """Batch sync all recently modified contacts and deals, push once."""
    try:
        settings = self._get_settings(db)
        if settings is None:
            return {"status": "skipped", "reason": "no github repo configured"}

        cutoff = datetime.utcnow() - timedelta(minutes=35)  # 5-min overlap buffer
        written = 0

        # Sync modified contacts
        contacts = db.query(Contact).filter(Contact.updated_at >= cutoff).all()
        for contact in contacts:
            if self._write_contact_file(db, contact.id):
                written += 1

        # Sync modified deals
        deals = db.query(Deal).filter(Deal.updated_at >= cutoff).all()
        for deal in deals:
            if self._write_deal_file(db, deal.id):
                written += 1

        # Sync insights (always refresh)
        insights = (
            db.query(Insight)
            .filter(Insight.is_active.is_(True))
            .order_by(Insight.created_at.desc())
            .all()
        )
        md = self._render_insights_markdown(insights)
        dest = CRM_SYNC_DIR / "outreach" / "insights.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(md, encoding="utf-8")
        written += 1

        # Single push for all changes
        if written > 0:
            self._push_changes(settings)

        return {"status": "success", "files_written": written}

    except Exception:
        logger.exception("Batch CRM sync failed")
        return {"status": "failed"}
```

- [ ] **Step 4: Add missing import at top of file**

Add `from datetime import datetime, timedelta` (timedelta is new).

- [ ] **Step 5: Verify import**

Run: `python -c "from app.services.crm_vault_sync import CRMVaultSync; c = CRMVaultSync(); print('OK')"`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/crm_vault_sync.py
git commit -m "feat: add batch_crm_sync and write helpers to CRMVaultSync"
```

---

### Task 3: Add CRM sync hooks to routes

**Files:**
- Modify: `backend/app/routes/crm.py:52-59` (create_contact), `:62-79` (update_contact), `:194-241` (update_deal), `:243-270` (update_deal_stage)
- Modify: `backend/app/routes/autoresearch.py:2536-2559` (refresh_insights)

- [ ] **Step 1: Add BackgroundTasks to `create_contact`**

Change the function signature and add the sync call:

```python
@router.post("/contacts", response_model=ContactResponse, status_code=201)
def create_contact(contact: ContactCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Create a new contact"""
    db_contact = Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)

    # Sync to vault
    background_tasks.add_task(_vault_sync_contact, db_contact.id)

    return db_contact
```

Add the BackgroundTasks import and helper at the top of the file:

```python
from fastapi import BackgroundTasks  # add to existing import line

def _vault_sync_contact(contact_id: int):
    """Background task: sync a contact to the vault."""
    from app.database.connection import SessionLocal
    from app.services.crm_vault_sync import CRMVaultSync
    db = SessionLocal()
    try:
        CRMVaultSync().sync_contact(db, contact_id)
    except Exception as e:
        logger.warning("Vault sync for contact %d failed: %s", contact_id, e)
    finally:
        db.close()

def _vault_sync_deal(deal_id: int):
    """Background task: sync a deal to the vault."""
    from app.database.connection import SessionLocal
    from app.services.crm_vault_sync import CRMVaultSync
    db = SessionLocal()
    try:
        CRMVaultSync().sync_deal(db, deal_id)
    except Exception as e:
        logger.warning("Vault sync for deal %d failed: %s", deal_id, e)
    finally:
        db.close()
```

**Important:** The background task needs its own DB session because the route's session may close before the task runs.

- [ ] **Step 2: Add vault sync to `update_contact` for status change to CLIENT**

```python
@router.put("/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # ... existing code ...
    db.commit()
    db.refresh(db_contact)

    # Sync to vault if status changed to CLIENT
    if "status" in update_data and update_data["status"] == ContactStatus.CLIENT:
        background_tasks.add_task(_vault_sync_contact, contact_id)

    return db_contact
```

Add `from app.models.crm import ContactStatus` if not already imported.

- [ ] **Step 3: Add vault sync to `update_deal` for closed deals**

After the existing `db.commit()` and activity logging block (around line 240), add:

```python
    # Sync closed deal to vault
    if "stage" in update_data and update_data["stage"] in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
        background_tasks.add_task(_vault_sync_deal, deal_id)
```

Add `background_tasks: BackgroundTasks` to the function signature.

- [ ] **Step 4: Add vault sync to `update_deal_stage` for closed deals**

After the existing `db.commit()` block, add:

```python
    # Sync closed deal to vault
    if stage in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
        background_tasks.add_task(_vault_sync_deal, deal_id)
```

Add `background_tasks: BackgroundTasks` to the function signature.

- [ ] **Step 5: Add vault sync to `refresh_insights` in autoresearch.py**

After the insights are generated (around line 2550), add:

```python
    # Sync insights to vault in background
    background_tasks.add_task(_vault_sync_insights)
```

Add `background_tasks: BackgroundTasks` to the function signature. Add helper:

```python
def _vault_sync_insights():
    """Background task: sync outreach insights to the vault."""
    from app.database.connection import SessionLocal
    from app.services.crm_vault_sync import CRMVaultSync
    db = SessionLocal()
    try:
        CRMVaultSync().sync_outreach_insights(db)
    except Exception as e:
        logger.warning("Vault sync for insights failed: %s", e)
    finally:
        db.close()
```

- [ ] **Step 6: Verify backend starts**

Run: `python -m uvicorn app.main:app --port 8001` — check no import errors.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routes/crm.py backend/app/routes/autoresearch.py
git commit -m "feat: add CRM vault sync hooks for contacts, deals, and insights"
```

---

### Task 4: Add batch CRM sync to scheduler

**Files:**
- Modify: `backend/app/services/scheduler_service.py`

- [ ] **Step 1: Add the batch sync job function**

```python
async def crm_batch_sync_job():
    """Scheduled job: batch sync recently modified CRM data to vault."""
    from app.database.connection import SessionLocal
    from app.services.crm_vault_sync import CRMVaultSync

    db = SessionLocal()
    try:
        syncer = CRMVaultSync()
        result = syncer.batch_crm_sync(db)
        if result.get("files_written", 0) > 0:
            logger.info("CRM batch sync: %s", result)
    except Exception as e:
        logger.error("CRM batch sync job failed: %s", e)
    finally:
        db.close()
```

- [ ] **Step 2: Register the job in `start_scheduler()`**

Add after the existing `vault_sync_job` registration:

```python
    scheduler.add_job(
        crm_batch_sync_job,
        "interval",
        minutes=30,
        id="crm_batch_sync",
        replace_existing=True,
    )
```

Update the log message to include "CRM batch sync every 30 min".

- [ ] **Step 3: Verify scheduler starts**

Run: `python -c "from app.services.scheduler_service import start_scheduler; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/scheduler_service.py
git commit -m "feat: add CRM batch sync to scheduler (30-min interval)"
```

---

### Task 5: Add `generate_starter_templates()` to CRMVaultSync

**Files:**
- Modify: `backend/app/services/crm_vault_sync.py`

- [ ] **Step 1: Add the template generation method**

```python
def generate_starter_templates(self, db: Session) -> dict:
    """Generate Obsidian vault starter templates from real outreach data."""
    try:
        settings = self._get_settings(db)
        if settings is None:
            return {"status": "failed", "error": "No GitHub repo configured"}

        from app.models.autoresearch import Experiment

        files_written = 0

        # ── Pull real emails from database ──
        sent_emails = (
            db.query(Experiment)
            .filter(Experiment.sent_at.isnot(None))
            .filter(Experiment.body.isnot(None))
            .order_by(Experiment.sent_at.desc())
            .limit(50)
            .all()
        )

        cold_emails = [e for e in sent_emails if e.step_number == 1]
        follow_ups = [e for e in sent_emails if e.step_number > 1]
        loom_scripts = [e for e in sent_emails if e.loom_script]

        # ── voice/communication-style.md ──
        lines = ["# Communication Style", "", "Real emails I've sent, grouped by type.", ""]
        if cold_emails:
            lines += ["## Cold Emails", ""]
            for e in cold_emails[:5]:
                lines += [f"### To: {e.company or 'Unknown'} ({e.niche or 'N/A'})", ""]
                lines += [f"**Subject:** {e.subject or 'N/A'}", ""]
                lines += [e.body or "", "", "---", ""]
        if follow_ups:
            lines += ["## Follow-ups", ""]
            for e in follow_ups[:5]:
                lines += [f"### Step {e.step_number} — {e.company or 'Unknown'}", ""]
                lines += [f"**Subject:** {e.subject or 'N/A'}", ""]
                lines += [e.body or "", "", "---", ""]
        if not sent_emails:
            lines += ["_No outreach data found yet. Templates will populate as you send emails._", ""]
        self._write_template_file("voice/communication-style.md", "\n".join(lines))
        files_written += 1

        # ── voice/phrases-i-use.md ──
        greetings = set()
        signoffs = set()
        for e in sent_emails:
            if not e.body:
                continue
            body_lines = e.body.strip().split("\n")
            first_line = body_lines[0].strip() if body_lines else ""
            if first_line and len(first_line) < 80:
                greetings.add(first_line)
            # Look for sign-off (last non-empty lines)
            for line in reversed(body_lines):
                stripped = line.strip()
                if stripped and len(stripped) < 60 and not stripped.startswith("http"):
                    signoffs.add(stripped)
                    break

        lines = ["# Phrases I Use", ""]
        lines += ["## Greetings", ""]
        for g in sorted(greetings)[:10]:
            lines += [f"- {g}"]
        lines += ["", "## Sign-offs", ""]
        for s in sorted(signoffs)[:10]:
            lines += [f"- {s}"]
        lines += [""]
        if not sent_emails:
            lines += ["_No outreach data found yet._", ""]
        self._write_template_file("voice/phrases-i-use.md", "\n".join(lines))
        files_written += 1

        # ── voice/tone-guide.md ──
        avg_words = sum(e.word_count or 0 for e in sent_emails) / max(len(sent_emails), 1)
        lines = ["# Tone Guide", ""]
        lines += [f"**Average email length:** {int(avg_words)} words", ""]
        lines += ["## Observed Patterns"]
        lines += [f"- Emails analyzed: {len(sent_emails)}"]
        lines += [f"- Cold emails: {len(cold_emails)}"]
        lines += [f"- Follow-ups: {len(follow_ups)}"]
        lines += [f"- Loom scripts: {len(loom_scripts)}", ""]
        lines += ["## Style Notes", ""]
        lines += ["<!-- Fill in: How formal or casual are you? -->"]
        lines += ["<!-- Fill in: Do you use humor? What kind? -->"]
        lines += ["<!-- Fill in: How direct are you with prospects? -->"]
        lines += ["<!-- Fill in: What would you NEVER say? -->", ""]
        self._write_template_file("voice/tone-guide.md", "\n".join(lines))
        files_written += 1

        # ── templates/cold-emails.md ──
        lines = ["# Cold Email Templates", "", "Real cold emails that were sent.", ""]
        for e in cold_emails[:10]:
            lines += [f"## {e.company or 'Unknown'} — {e.niche or 'N/A'}", ""]
            lines += [f"**Subject:** {e.subject or 'N/A'}", ""]
            lines += [e.body or "_No body_", "", "---", ""]
        if not cold_emails:
            lines += ["_No cold emails sent yet._", ""]
        self._write_template_file("templates/cold-emails.md", "\n".join(lines))
        files_written += 1

        # ── templates/follow-ups.md ──
        lines = ["# Follow-up Templates", "", "Real follow-up emails by step number.", ""]
        for e in follow_ups[:10]:
            lines += [f"## Step {e.step_number} — {e.company or 'Unknown'}", ""]
            lines += [f"**Subject:** {e.subject or 'N/A'}", ""]
            lines += [e.body or "_No body_", "", "---", ""]
        if not follow_ups:
            lines += ["_No follow-ups sent yet._", ""]
        self._write_template_file("templates/follow-ups.md", "\n".join(lines))
        files_written += 1

        # ── templates/loom-scripts.md ──
        lines = ["# Loom Video Scripts", "", "Scripts used for Loom video outreach.", ""]
        for e in loom_scripts[:10]:
            lines += [f"## {e.company or 'Unknown'} — Step {e.step_number}", ""]
            lines += [e.loom_script or "_No script_", "", "---", ""]
        if not loom_scripts:
            lines += ["_No loom scripts generated yet._", ""]
        self._write_template_file("templates/loom-scripts.md", "\n".join(lines))
        files_written += 1

        # ── sops/sales-process.md ──
        self._write_template_file("sops/sales-process.md", """# Sales Process

## Pipeline: Autoresearch Cold Outreach

1. **Website Audit** — AI audits the prospect's website for issues
2. **Cold Email** — Personalized email referencing specific audit findings
3. **Follow-up 1** — Sent after X days if no reply
4. **Follow-up 2** — Different angle, same prospect
5. **Loom Video** — Personalized screen recording walking through their website issues
6. **LinkedIn Engage** — Comment on their posts to build familiarity
7. **Final Follow-up** — Last touch before moving on

## Qualification
- Target: Tradies (HVAC, plumbing, electrical, roofing, landscaping)
- Location: Australia
- Signal: Website has clear issues that hurt their business

## Conversion Path
Prospect → Audit → Email sequence → Reply → Call → Deal → Client
""")
        files_written += 1

        # ── sops/pricing.md ──
        self._write_template_file("sops/pricing.md", """# Pricing

## Packages
<!-- Fill in your pricing packages -->

### Website Build
- Price: $___
- Includes: ___
- Timeline: ___

### Website Maintenance
- Monthly: $___/mo
- Includes: ___

### Hourly Rate
- Rate: $___/hr
- Minimum engagement: ___

## Discounts / Promotions
<!-- Any current offers? -->
""")
        files_written += 1

        # ── sops/client-onboarding.md ──
        self._write_template_file("sops/client-onboarding.md", """# Client Onboarding

## Steps
1. Deal closed — create project in CRM
2. Send welcome email with questionnaire
3. Get access to hosting/domain
4. Set up staging site
5. Design review with client
6. Build and launch
7. Training session
8. Handoff and maintenance plan

<!-- Customize this based on your actual process -->
""")
        files_written += 1

        # ── knowledge/tech-stack.md ──
        self._write_template_file("knowledge/tech-stack.md", """# Tech Stack

## Client Work
- **WordPress** — Primary platform for client websites
- **Elementor / Divi** — Page builders (note which you prefer)
- **Hosting** — <!-- Which hosting provider? -->

## Internal Tools
- **React + TypeScript + Vite + TailwindCSS** — Frontend for Vertex CRM
- **FastAPI + SQLAlchemy + SQLite/PostgreSQL** — Backend for Vertex CRM
- **Claude AI (Sonnet 4.6)** — Email generation, website audits, business automation
- **Playwright** — Website screenshots for AI audits
- **Obsidian** — Personal knowledge base (this vault)

## Opinions
<!-- What do you like/dislike about each tool? Why did you choose them? -->
""")
        files_written += 1

        # ── knowledge/lessons-learned.md ──
        self._write_template_file("knowledge/lessons-learned.md", """# Lessons Learned

<!-- Add entries as you learn them. Format: -->
<!-- ## YYYY-MM-DD: Lesson title -->
<!-- What happened, what you learned, what you'd do differently -->
""")
        files_written += 1

        # ── goals/business-vision.md ──
        self._write_template_file("goals/business-vision.md", """# Business Vision

## Current Focus
<!-- What are you focused on right now? -->

## 2026 Goals
<!-- Revenue targets, client count, new offerings? -->

## Dream Clients
<!-- What does your ideal client look like? -->

## Long-term Vision
<!-- Where do you want Joji Web Solutions to be in 3-5 years? -->
""")
        files_written += 1

        # Push all template files at once
        self._push_changes(settings)

        return {"status": "success", "files_written": files_written}

    except Exception:
        logger.exception("Template generation failed")
        return {"status": "failed"}
```

- [ ] **Step 2: Add the `_write_template_file` helper**

```python
def _write_template_file(self, relative_path: str, content: str) -> None:
    """Write a file to the vault repo at the given relative path."""
    dest = VAULT_REPO_DIR / relative_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")
```

- [ ] **Step 3: Verify import**

Run: `python -c "from app.services.crm_vault_sync import CRMVaultSync; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/crm_vault_sync.py
git commit -m "feat: add generate_starter_templates to CRMVaultSync"
```

---

### Task 6: Add `/api/ai/vault/generate-templates` endpoint

**Files:**
- Modify: `backend/app/routes/joji_ai.py`

- [ ] **Step 1: Add the endpoint after the existing settings endpoint**

```python
# ---------------------------------------------------------------------------
# 11. POST /vault/generate-templates -- Generate vault starter templates
# ---------------------------------------------------------------------------

@router.post("/vault/generate-templates")
def generate_vault_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate Obsidian vault starter templates from real outreach data."""
    from app.services.crm_vault_sync import CRMVaultSync

    syncer = CRMVaultSync()
    result = syncer.generate_starter_templates(db)

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "Template generation failed"))

    return result
```

- [ ] **Step 2: Verify endpoint registers**

Run backend, then: `curl -s http://localhost:8001/openapi.json | python -c "import json,sys; paths=json.load(sys.stdin)['paths']; print('/api/ai/vault/generate-templates' in paths)"`

Expected: `True`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes/joji_ai.py
git commit -m "feat: add POST /api/ai/vault/generate-templates endpoint"
```

---

### Task 7: Add frontend "Generate Vault Templates" button

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/joji-ai/AISettingsPanel.tsx`

- [ ] **Step 1: Add API function**

In `frontend/src/lib/api.ts`, add to `jojiAiApi`:

```typescript
  generateVaultTemplates: async (): Promise<{ status: string; files_written: number }> => {
    const { data } = await api.post('/api/ai/vault/generate-templates');
    return data;
  },
```

- [ ] **Step 2: Add mutation and button to AISettingsPanel**

Add a new mutation after `syncMutation`:

```typescript
  const templateMutation = useMutation({
    mutationFn: () => jojiAiApi.generateVaultTemplates(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success(`Generated ${data.files_written} vault template files`);
    },
    onError: () => {
      toast.error('Failed to generate templates');
    },
  });
```

Add `import { toast } from 'sonner';` if not already imported.

Add the button in the Vault Sync section of the settings panel, after the existing "Sync Now" button:

```tsx
<button
  onClick={() => templateMutation.mutate()}
  disabled={templateMutation.isPending || !settings?.github_repo_url}
  className={cn(
    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
    'bg-[--exec-accent]/10 text-[--exec-accent] border border-[--exec-accent]/20',
    'hover:bg-[--exec-accent]/20 transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  )}
>
  {templateMutation.isPending ? (
    <RefreshCw className="w-3 h-3 animate-spin" />
  ) : (
    <MessageSquareText className="w-3 h-3" />
  )}
  {templateMutation.isPending ? 'Generating...' : 'Generate Vault Templates'}
</button>
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd frontend && npm run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/joji-ai/AISettingsPanel.tsx
git commit -m "feat: add Generate Vault Templates button in AI Settings"
```

---

### Task 8: Test end-to-end and push

- [ ] **Step 1: Start backend and frontend**
- [ ] **Step 2: Navigate to /ai → Settings → click "Generate Vault Templates"**
- [ ] **Step 3: Verify files appear in the vault repo and on GitHub**
- [ ] **Step 4: Trigger vault re-sync to index new files**
- [ ] **Step 5: Ask Joji AI "What's my sales process?" — verify it uses the new vault content**
- [ ] **Step 6: Create a test contact and verify the CRM sync background task fires**
- [ ] **Step 7: Push to remote**

```bash
git push origin main
```
