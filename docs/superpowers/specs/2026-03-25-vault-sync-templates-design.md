# Vault Auto-Sync & Starter Templates — Design Spec

**Date:** 2026-03-25
**Status:** Draft

## Overview

Two deliverables:
1. Hook the existing `CRMVaultSync` service into CRM routes so contacts, deals, and insights auto-push to the Obsidian vault GitHub repo
2. Create vault starter templates pre-filled with real outreach data from the database

## Part 1: CRM Auto-Sync Hooks

### Immediate Sync (on important events)

These trigger `CRMVaultSync` as a `BackgroundTasks.add_task()` call right after the DB commit:

| Route file | Event | Method |
|---|---|---|
| `crm.py` | Contact created | `sync_contact(db, contact_id)` |
| `crm.py` | Contact status changed to CLIENT | `sync_contact(db, contact_id)` |
| `crm.py` | Deal stage changed to Closed Won/Lost via `PUT /deals/{id}` | `sync_deal(db, deal_id)` |
| `crm.py` | Deal stage changed to Closed Won/Lost via `PATCH /deals/{id}/stage` | `sync_deal(db, deal_id)` |
| `autoresearch.py` | New insight generated (after learning engine runs) | `sync_outreach_insights(db)` |

**Note:** Both deal update routes (`update_deal` and `update_deal_stage`) must receive the hook since either can transition a deal to closed.

**Note:** `sync_outreach_insights` is synchronous and runs blocking git operations. Use `BackgroundTasks.add_task()` which runs sync functions in the thread pool — acceptable for background git work.

### Batched Sync (30-min scheduler)

Add a new `batch_crm_sync()` method to `CRMVaultSync` and schedule it in `scheduler_service.py`:

1. Query all contacts with `updated_at` in the last 30 minutes
2. Query all deals with `updated_at` in the last 30 minutes
3. For each, write the markdown file (but do NOT call `_push_changes()` per record)
4. Call `sync_outreach_insights()` to write the insights file (without push)
5. Call `_push_changes()` **once** at the end for all written files
6. Skip entirely if no GitHub repo configured

This avoids a git push storm — one commit covers all changes in the batch window.

**Deduplication:** The batch is idempotent (overwrites files). If an immediate sync already pushed a record, the batch will overwrite with identical content and git will detect no diff. No tracking needed.

### Git Safety

The existing `_push_changes()` falls back to `force=True` on push failure. This risks destroying vault content written in Obsidian that hasn't been pulled yet. **Fix:** Replace the force-push fallback with `git pull --rebase` before pushing. If rebase fails (true conflict), log the error and skip — do not force-push.

## Part 2: Vault Starter Templates

### New Folder Structure

Files are written to `VAULT_REPO_DIR` (the backend's cloned git repo at `backend/data/vault-repo/`), NOT the local Obsidian directory. They sync to the user's Obsidian vault via GitHub.

```
knowledge/
├── tech-stack.md
└── lessons-learned.md
voice/
├── tone-guide.md
├── communication-style.md
└── phrases-i-use.md
goals/
└── business-vision.md
```

Also add to existing folders:
```
sops/
├── sales-process.md
├── pricing.md
└── client-onboarding.md
templates/
├── cold-emails.md
├── follow-ups.md
└── loom-scripts.md
```

### Data Population Strategy

**Pulled from database (real data — no AI calls needed):**
- `voice/communication-style.md` — Extract 5-10 real sent emails from `Experiment` table (where `sent_at` is not null), showing subject + body. Group by step type (cold email, follow-up, loom email).
- `templates/cold-emails.md` — Pull cold email bodies from step 1 experiments with `sent_at` set.
- `templates/follow-ups.md` — Pull generated follow-up emails (step 2+) with their step numbers.
- `templates/loom-scripts.md` — Pull loom scripts from experiments that have `loom_script` set.

**Structured extraction (pattern matching, no AI):**
- `voice/phrases-i-use.md` — Extract greetings (first line of emails), sign-offs (last lines before name), and recurring phrases via simple text patterns.
- `voice/tone-guide.md` — Structured template with placeholder sections. Pre-fill what can be observed: average email length, greeting style, sign-off style. Mark subjective sections (humor, directness) as `<!-- Fill in: describe your style -->`.

**Inferred from known context (static content):**
- `sops/sales-process.md` — Document the autoresearch pipeline: audit → cold email → follow-ups → loom video → LinkedIn engage
- `sops/pricing.md` — Placeholder with structure sections (hourly rate, packages, retainers)
- `sops/client-onboarding.md` — Placeholder with structure
- `knowledge/tech-stack.md` — WordPress for clients, React+FastAPI for CRM, Claude AI for automation
- `knowledge/lessons-learned.md` — Placeholder
- `goals/business-vision.md` — Placeholder

**Edge case:** If zero experiments exist in the database, template files are still created with placeholder content and a note: "No outreach data found yet. Templates will be populated as you send emails."

### Implementation

Add `generate_starter_templates(db)` method to `CRMVaultSync`:
1. Query autoresearch database for sent emails, follow-ups, loom scripts
2. Generate markdown files using string formatting (no AI calls)
3. Write files to `VAULT_REPO_DIR` under the appropriate folders
4. Call `_push_changes()` once to commit and push all files

Expose as `POST /api/ai/vault/generate-templates` with `current_user: User = Depends(get_current_user)` for authentication.

## File Changes

### Backend (CRM sync hooks)
- `backend/app/routes/crm.py` — Add background task after contact create, contact status change to CLIENT, deal stage change (both PUT and PATCH routes)
- `backend/app/routes/autoresearch.py` — Add background task after insight generation
- `backend/app/services/crm_vault_sync.py` — Add `batch_crm_sync(db)` method that writes all files then pushes once. Fix `_push_changes()` to use pull-rebase instead of force-push.
- `backend/app/services/scheduler_service.py` — Add batch CRM sync job (30-min interval)

### Backend (template generation)
- `backend/app/services/crm_vault_sync.py` — Add `generate_starter_templates(db)` method
- `backend/app/routes/joji_ai.py` — Add `POST /api/ai/vault/generate-templates` endpoint (auth required)

### Frontend
- `frontend/src/components/joji-ai/AISettingsPanel.tsx` — Add "Generate Vault Templates" button

## Testing

- Verify CRM sync triggers on contact create, deal stage change (both routes), insight generation
- Verify batch sync writes all files then pushes once (not once per record)
- Verify template generation pulls real data and writes correct markdown
- Verify template generation with zero experiments creates placeholder files
- Verify vault re-sync picks up the new files and indexes them for AI search
- Verify scheduler skips gracefully when no vault repo is cloned
- Verify git pull-rebase runs before push (no force-push)
