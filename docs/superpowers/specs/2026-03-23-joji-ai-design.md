# Joji AI -- Personal AI Assistant with Obsidian Vault Brain

**Date:** 2026-03-23
**Status:** Approved design, pending implementation

## Overview

Joji AI is a personal AI assistant inside the Vertex CRM that replaces Claude web app usage. It has full business context through two sources: the user's Obsidian vault (synced via GitHub) and live CRM data (via tool use). The AI learns everything about the business -- SOPs, client notes, contracts, learnings, outreach strategies -- and can take actions in the CRM.

## Architecture

### Three Layers

1. **Knowledge Layer** -- Obsidian vault synced from GitHub, chunked and embedded in SQLite/PostgreSQL for semantic search
2. **AI Layer** -- Claude Sonnet 4.6 (default) / Opus 4.6 (toggle) with CRM tools + vault search
3. **Interface Layer** -- Floating chat panel on every page + dedicated full-page `/ai` view

### Data Flow

```
Obsidian (local PC)
    -> Obsidian Git plugin pushes to private GitHub repo
        -> App pulls from GitHub (every 30 min or manual "Sync Now")
            -> Markdown files diffed, chunked (~500 tokens), embedded
                -> Stored in database (vault_chunks table)

User asks a question
    -> Embed the question
    -> Vector similarity search -> top 5-10 relevant vault chunks
    -> CRM tool calls as needed (contacts, deals, tasks, outreach, etc.)
    -> Claude receives: system prompt + vault context + CRM data + conversation history
    -> Response streamed back via SSE
```

## Backend

### New Models

All new foreign keys use `ondelete="CASCADE"` to keep data clean.

#### VaultFile
Tracks each markdown file synced from the vault.

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | |
| file_path | str unique | Relative path in vault (e.g. `sops/pricing.md`) |
| content_hash | str | SHA256 of file content (for change detection) |
| last_synced_at | datetime | When this file was last pulled |
| created_at | datetime | |
| updated_at | datetime | |

#### VaultChunk
Stores chunked + embedded pieces of vault files for search.

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | |
| vault_file_id | int FK (CASCADE) | Links to VaultFile |
| chunk_index | int | Order within the file |
| content | text | The text chunk (~500 tokens) |
| embedding | LargeBinary | Vector embedding (512 float32s, works on SQLite + PostgreSQL) |
| heading_context | str | The heading hierarchy this chunk falls under (e.g. "SOPs > Pricing > Hourly Rates") |
| metadata_json | json | Extracted frontmatter, links |
| created_at | datetime | |

#### Conversation
Persists chat conversations across sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | |
| user_id | int FK (CASCADE) | |
| title | str | Auto-generated or user-set |
| created_at | datetime | |
| updated_at | datetime | |

#### ConversationMessage
Individual messages within a conversation.

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | |
| conversation_id | int FK (CASCADE) | |
| role | str | "user" or "assistant" |
| content | text | Message content |
| model | str | Which model generated this message (for cost tracking) |
| tool_calls_json | json | Any tool calls made (for transparency) |
| vault_chunks_used | json | IDs of vault chunks that were referenced |
| tokens_used | int | Token count for cost tracking |
| cost_usd | float | Calculated cost for this message |
| created_at | datetime | |

#### JojiAISettings
User-level settings for the AI.

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | |
| user_id | int FK (CASCADE) | |
| github_repo_url | str | Private repo URL for vault sync |
| github_token_encrypted | text | Encrypted PAT (reuses existing Fernet encryption from gmail_service) |
| sync_interval_minutes | int | Default 30 |
| last_sync_at | datetime | |
| last_sync_status | str | success/failed/in_progress |
| last_sync_file_count | int | |
| default_model | str | Default "claude-sonnet-4-6" |
| system_prompt_override | text | Custom system prompt additions |
| total_tokens_used | int | Running total for cost tracking |
| total_cost_usd | float | Running total cost |
| created_at | datetime | |
| updated_at | datetime | |

### New Services

#### VaultSyncService (`backend/app/services/vault_sync_service.py`)

Pulls vault from GitHub, diffs changes, re-indexes.

- `sync_vault(db, settings)` -- main sync flow:
  1. Pull the GitHub repo to a persistent local directory (`backend/data/vault-repo/`). First sync does a clone, subsequent syncs do `git pull`. Directory persists across restarts.
  2. Walk all `.md` files
  3. Compare content hashes to stored VaultFile records
  4. For new/changed files: chunk and embed (in batches of 20 files, committing after each batch to avoid long SQLite locks)
  5. For deleted files: remove VaultFile + VaultChunks
  6. Update sync status in settings
- `chunk_markdown(content, max_tokens=500)` -- splits markdown into chunks:
  - Headings always start a new chunk
  - Code blocks kept intact (even if over 500 tokens)
  - Frontmatter/YAML extracted as metadata, not chunked
  - Obsidian wikilinks `[[page]]` preserved in chunk text
  - Each chunk stores its heading hierarchy for context
- `embed_chunks(chunks)` -- generates embeddings via Voyage AI (voyage-3-lite, 512 dimensions)

**Error handling:**
- If GitHub is unreachable: log warning, keep existing index, retry next cycle
- If Voyage AI is down: skip embedding step, mark sync as "partial"
- If a single file fails to parse: skip it, log error, continue with rest

#### VaultSearchService (`backend/app/services/vault_search_service.py`)

Searches vault chunks by semantic similarity.

**Vector search approach:** Load all embeddings into a numpy array on first search, cache in memory. Compute cosine similarity with numpy. For a vault under 10k chunks (~20MB of embeddings), this is fast (<50ms). Cache is invalidated after each vault sync.

- `search(db, query, top_k=5)` -- embed query via Voyage AI, cosine similarity against cached embeddings, return top results
- `search_by_path(db, path_pattern)` -- direct file lookup (e.g. "find my pricing SOP")
- Returns chunk content + file path + heading context + surrounding chunks for continuity

**Fallback:** If Voyage AI is down (can't embed query), fall back to SQLite FTS (full-text search) on chunk content using LIKE queries.

#### JojiAIService (upgrade existing `ai_service.py`)

Upgraded AI service with vault context injection.

- Uses Sonnet 4.6 by default (configurable per-conversation)
- Max tokens: 4096 (up from 1024)
- Before calling Claude:
  1. Search vault for relevant chunks based on the user's message
  2. Build system prompt with vault context block
  3. Include conversation history (last 20 messages to stay within context window)
  4. Attach CRM tools
- New tools added:
  - `search_vault` -- AI can explicitly search the vault mid-conversation
  - `get_outreach_stats` -- campaign performance, reply rates
  - `get_prospect_info` -- prospect details + email history
- Streaming via SSE with typed events

**SSE Event Types:**
- `event: text` -- streamed text content
- `event: tool_call` -- tool being executed (name + args)
- `event: tool_result` -- tool result summary
- `event: vault_ref` -- vault chunk being referenced (file path + preview)
- `event: error` -- error during generation
- `event: done` -- stream complete, includes token count + cost

### New Routes (`backend/app/routes/joji_ai.py`)

All routes require `get_current_user` authentication dependency.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/chat` | Send message, get streamed response |
| GET | `/api/ai/conversations` | List conversations (paginated: limit, offset) |
| GET | `/api/ai/conversations/{id}` | Get conversation with messages (paginated) |
| DELETE | `/api/ai/conversations/{id}` | Delete a conversation |
| POST | `/api/ai/conversations/{id}/title` | Rename a conversation |
| POST | `/api/ai/vault/sync` | Trigger manual vault sync |
| GET | `/api/ai/vault/status` | Sync status, file count, last sync time |
| GET | `/api/ai/vault/files` | List indexed vault files |
| GET | `/api/ai/settings` | Get AI settings |
| PUT | `/api/ai/settings` | Update AI settings (model, repo, etc.) |

### Rate Limiting

- Sonnet: 60 requests per hour (default)
- Opus: 20 requests per hour (more expensive, lower limit)
- Daily cost cap: configurable in settings (default $5/day), returns 429 when exceeded
- Configurable via `AI_RATE_LIMIT_SONNET`, `AI_RATE_LIMIT_OPUS`, `AI_DAILY_COST_CAP` env vars

### CRM-to-Vault Auto-Sync

When certain CRM events happen, the app creates/updates markdown files in the vault's GitHub repo:

- **Contact created/updated** -> `crm-sync/contacts/{name}.md` with deal history, interactions, notes
- **Deal stage changed** -> `crm-sync/deals/{title}.md` with value, stage, timeline
- **Outreach insights refreshed** -> `crm-sync/outreach/insights.md` with top performing patterns

**Conflict resolution:** The `crm-sync/` folder is strictly one-way (app -> GitHub). Files in this folder are overwritten on each sync. The vault README and Obsidian will note "Do not edit files in crm-sync/ -- they are auto-generated from the CRM." If a git push fails due to conflicts, the app does a force push on just the `crm-sync/` path, leaving user-created files untouched.

This runs as a background task after CRM mutations. Pushes to GitHub so the files appear in Obsidian too.

### Encryption

GitHub PAT encryption reuses the existing Fernet encryption from `gmail_service.py`. The encryption key env var is `ENCRYPTION_KEY` (shared between Gmail tokens and vault tokens). During migration, the existing `GMAIL_ENCRYPTION_KEY` is aliased to `ENCRYPTION_KEY` for backward compatibility.

### Embedding Strategy

**Option chosen: Voyage AI embeddings** (voyage-3-lite)
- 512 dimensions, good quality, cheap ($0.02/million tokens)
- Store as `LargeBinary` in SQLAlchemy (maps to `blob` on SQLite, `bytea` on PostgreSQL)
- Cosine similarity search via numpy with in-memory cache
- If vault grows beyond 10k chunks, migrate to pgvector (PostgreSQL) or sqlite-vec

**Environment variable:** `VOYAGE_API_KEY` required in `.env` and on Render.

## Frontend

### Floating Chat Panel (upgrade existing `AIChatPanel.tsx`)

- Bottom-right corner, available on every page
- Collapsible to a small button
- Shows current conversation
- "Open full view" button to jump to `/ai` page
- Persists conversation across page navigation

### Full Page (`/ai`)

Layout:
```
+--------------------------------------------------+
|  Sidebar (280px)    |  Chat Area                  |
|                     |                             |
|  + New Chat         |  Messages stream here       |
|                     |                             |
|  Today              |  Vault references shown     |
|  - Chat about...    |  inline as collapsible      |
|  - Pricing question |  cards                      |
|                     |                             |
|  Yesterday          |                             |
|  - HVAC deal...     |                             |
|  - Outreach...      |                             |
|                     |                             |
|  Settings           |  +---------------------+    |
|  - Model: Sonnet    |  | Message input...     |    |
|  - Vault: Synced    |  |              [Send]  |    |
|  - Last sync: 5m    |  +---------------------+    |
+--------------------------------------------------+
```

Features:
- Conversation history in sidebar, grouped by date
- New chat button
- Rename/delete conversations
- Model toggle (Sonnet/Opus) in settings or per-conversation
- Vault sync status indicator
- When AI references vault chunks, show them as collapsible cards with file path and content preview
- Message input with Shift+Enter for newlines, Enter to send

### Shared State

The floating panel and `/ai` page share conversation state via React context at the app root (`ChatContext`). Active conversation ID is stored in context. The floating panel shows a condensed view of the same conversation. TanStack Query handles data fetching with shared query keys (`['ai-conversations']`, `['ai-conversation', id]`).

### Settings Section (within `/ai` page sidebar or as a tab)

- GitHub repo URL + token setup
- Sync now button + status
- File count and last sync time
- Default model selection
- Custom system prompt additions
- Cost tracking (tokens used, estimated cost this month)

## System Prompt Structure

The system prompt is built dynamically, not hardcoded. The "ABOUT JOJI" section comes from a vault note (`sops/about-me.md` or similar) if it exists, otherwise falls back to a sensible default. This way the prompt evolves as the vault grows.

```
You are Joji AI, a personal business assistant with access to a
knowledge vault and CRM system.

{about section from vault note or default}

KNOWLEDGE BASE (from Obsidian vault):
<vault_context>
{relevant chunks inserted here based on the user's question}
</vault_context>

CRM CONTEXT:
{current page context if in floating panel}

You can search the vault for more information and take actions in the
CRM using the available tools.

RULES:
- Be direct and concise
- Australian English
- Reference specific vault notes when answering
- If you don't know something, say so -- don't make it up
- When taking CRM actions, confirm before executing

{user's custom system prompt additions if any}
```

## Vault Structure (Recommended)

The user starts with an empty vault. Recommended folder structure:

```
vault/
+-- sops/              # Standard operating procedures
|   +-- pricing.md
|   +-- onboarding.md
|   +-- cold-outreach.md
|   +-- about-me.md    # Used in system prompt
+-- clients/           # Client notes (manual)
+-- learnings/         # YouTube, courses, books
+-- templates/         # Email templates, proposals
+-- meetings/          # Meeting notes
+-- crm-sync/          # Auto-generated from CRM (don't edit manually)
|   +-- contacts/
|   +-- deals/
|   +-- outreach/
+-- daily/             # Daily notes (optional)
```

## Migration Plan

1. New tables: vault_files, vault_chunks, conversations, conversation_messages, joji_ai_settings
2. Upgrade ai_service.py to JojiAIService
3. Complete existing tool executor (missing handlers for delete_task, update_deal, get_projects, create_project, get_goals, create_goal)
4. No breaking changes to existing data

## Cost Estimates

- **Vault sync:** ~$0.01 per sync (embedding ~500 chunks via Voyage AI)
- **Per message (Sonnet):** ~$0.01-0.03 depending on context size
- **Per message (Opus):** ~$0.15-0.45
- **Monthly estimate (moderate use):** $5-15 on Sonnet, more if Opus used frequently

## Dependencies

- `voyageai` -- for embeddings (pip install voyageai)
- `gitpython` -- for GitHub repo operations (pip install gitpython)
- `numpy` -- for cosine similarity (pip install numpy)

**Environment variables to add:**
- `VOYAGE_API_KEY` -- Voyage AI API key for embeddings
- `ENCRYPTION_KEY` -- shared Fernet key (aliased from existing `GMAIL_ENCRYPTION_KEY`)

## Out of Scope (Future)

- Voice input/output
- Image/PDF parsing from vault
- Multi-user vault sharing
- Real-time Obsidian sync (webhook-based)
- Mobile app integration
