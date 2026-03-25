# Library Upload System — Design Spec

## Goal

Let users upload PDFs and paste text into Joji AI's brain (Obsidian vault). Content is auto-distilled by Sonnet into structured markdown, auto-organized into the right folder by Haiku, checked for duplicates, saved to the vault, and instantly indexed for semantic search.

## Constraints

- PDFs and text paste only (no URLs/YouTube for now)
- Max PDF size: 10 MB. Max text paste: 500,000 characters
- Storage: Obsidian vault `library/` folder (markdown only, no raw PDFs in git)
- Cost: ~$0.06 per typical upload (Sonnet distill + Haiku organize + Voyage embed). Large documents (200k+ chars) may cost more — Sonnet input is truncated to 100,000 chars (~25k tokens)
- No new database tables — reuse VaultFile/VaultChunk
- Rate limit: 20 uploads per day

## Architecture

```
User uploads PDF/text
        ↓
  FastAPI endpoint (multipart/form-data for both modes)
        ↓
  Validate: file type (magic bytes %PDF-), size limits
        ↓
  Extract text (PyMuPDF for PDF, raw for text)
        ↓
  Hash extracted text → check metadata_json on existing VaultChunks for duplicate source_hash
        ↓ (no duplicate)
  Truncate to 100k chars if needed → Sonnet distills into structured markdown
        ↓
  Haiku auto-organizes (picks category folder + filename)
        ↓
  Sanitize paths (no .., resolve inside library/)
        ↓
  Save to vault: library/<category>/<filename>.md
  + write via Obsidian REST API for instant visibility
  + git commit and push (reuse shared vault_utils)
        ↓
  Re-index file immediately (chunk + embed)
        ↓
  Return success with file path + summary preview
```

## Backend

### New file: `backend/app/services/vault_utils.py`

Extract shared utilities from `crm_vault_sync.py` to avoid duplication:
- `sanitize_filename(name: str) -> str` — slug-safe filename
- `write_vault_file(relative_path: str, content: str) -> None` — Obsidian REST API + filesystem write
- `push_vault_changes(db: Session, paths: list[str], commit_msg: str) -> None` — git add + commit + push with auth token injection

Both `crm_vault_sync.py` and the new `library_service.py` import from here.

### New file: `backend/app/services/library_service.py`

**Responsibilities:**
- `extract_pdf_text(file_bytes: bytes) -> str` — extract text from PDF using PyMuPDF (fitz). Validates magic bytes `%PDF-` before processing. Returns error if no text extracted (scanned PDF).
- `check_duplicate(db: Session, source_hash: str) -> Optional[str]` — check VaultChunk metadata_json for matching `source_content_hash`. Returns existing file path if duplicate found.
- `distill_content(text: str, title_hint: Optional[str]) -> str` — AsyncAnthropic Sonnet call. Input truncated to 100k chars. max_tokens=4096. Returns structured markdown.
- `auto_organize(summary: str) -> dict` — AsyncAnthropic Haiku call. Returns `{"category": "hormozi", "filename": "100m-offers", "title": "$100M Offers"}`. Response validated as JSON, category/filename sanitized and path-checked.
- `save_to_vault(db: Session, category: str, filename: str, content: str, source_hash: str) -> dict` — write to vault via vault_utils, re-index, store source_hash in metadata_json of first chunk.

**Path security:** After Haiku returns category/filename, sanitize both with `sanitize_filename()`, construct full path, then verify with:
```python
final_path = (VAULT_REPO_DIR / "library" / category / f"{filename}.md").resolve()
assert str(final_path).startswith(str((VAULT_REPO_DIR / "library").resolve()))
```

**Distill prompt (Sonnet):**
```
You are distilling a book/document into a structured knowledge base entry.

Extract:
1. Key frameworks and mental models (with examples)
2. Actionable principles (specific, not vague)
3. Notable quotes worth remembering
4. How this applies to a freelance web developer targeting Australian clients

Format as clean markdown with headers. Be thorough but concise — capture
the substance, skip the filler. Write it so someone who hasn't read the
original can understand and apply the frameworks.
```

**Auto-organize prompt (Haiku):**
```
Given this content summary, return JSON with the best category folder
and filename for organizing it in a knowledge vault.

Categories: business, sales, marketing, mindset, operations, finance,
or suggest a new one if none fit.

Return: {"category": "<folder>", "filename": "<slug>", "title": "<display title>"}
Only lowercase alphanumeric and hyphens in category and filename.
```

### New endpoint: `POST /api/ai/library/upload`

```python
@router.post("/library/upload")
async def upload_to_library(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
```

- Accepts either a PDF file OR text content (not both)
- Validates: PDF magic bytes `%PDF-`, file size ≤ 10 MB, text length ≤ 500k chars
- Optional title hint (helps the AI name it)
- Uses `AsyncAnthropic` for non-blocking Sonnet/Haiku calls
- Expected processing time: 10-30 seconds
- Returns: `{"status": "success", "file_path": "library/hormozi/100m-offers.md", "title": "...", "preview": "first 200 chars..."}`

**Error responses:**
- 400: `{"detail": "No file or text provided"}`
- 400: `{"detail": "File must be a PDF"}`
- 400: `{"detail": "File too large (max 10 MB)"}`
- 400: `{"detail": "Text too long (max 500,000 characters)"}`
- 400: `{"detail": "Could not extract text from PDF (may be scanned/image-only)"}`
- 409: `{"detail": "Duplicate content", "existing_file": "library/hormozi/100m-offers.md"}`
- 429: `{"detail": "Upload limit reached (20 per day)"}`
- 500: `{"detail": "Failed to process content"}`

### Duplicate detection

- SHA256 hash of **extracted source text** (before distillation)
- Stored in `metadata_json` of the first VaultChunk: `{"source_content_hash": "abc123..."}`
- On upload, scan VaultChunks where `chunk_index=0` and `metadata_json` contains a matching hash
- This is consistent with how vault_sync_service stores metadata and avoids content_hash confusion (which hashes the distilled markdown, not the source)

### YAML frontmatter on generated files

```yaml
---
type: library
source: pdf
title: "$100M Offers"
author: Alex Hormozi (auto-detected)
category: business
tags: [offers, pricing, value-equation]
uploaded: 2026-03-25
distilled_by: claude-sonnet-4-6
source_hash: abc123...
---
```

## Frontend

### Upload panel in AI Settings

Add a "Brain Library" section in `AISettingsPanel.tsx` that expands into a full upload panel when clicked (same pattern as Settings ↔ Conversations swap).

**Upload panel contains:**
- Drag-and-drop zone / file picker (PDF only, max 10 MB)
- Text paste area (toggle between PDF upload and text paste)
- Optional title field
- Upload button
- Indeterminate processing state: "Processing... this may take up to 30 seconds"
- Success: toast "Saved to brain: library/hormozi/100m-offers.md"
- Error: toast with specific error message

**No library browsing in the app** — Obsidian handles that.

### New API function in `api.ts`

```typescript
uploadToLibrary: async (file?: File, text?: string, title?: string) => {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (text) formData.append('text', text);
  if (title) formData.append('title', title);
  // Don't set Content-Type — let axios set it with boundary automatically
  const { data } = await api.post('/api/ai/library/upload', formData, {
    timeout: 60000, // 60s timeout for long processing
  });
  return data;
}
```

## Dependencies

- `PyMuPDF` (pymupdf) — PDF text extraction, more robust than PyPDF2 (add to requirements.txt)
- Everything else already exists (Anthropic SDK, vault config, re-indexing)

## Cost per upload

| Step | Model | Est. cost (typical book) |
|------|-------|-----------|
| Distill content | Sonnet (25k input, 4k output) | ~$0.135 |
| Auto-organize | Haiku | ~$0.002 |
| Embed chunks | Voyage | ~$0.001 |
| **Total** | | **~$0.14** |

Note: Cost scales with document size. Short articles ~$0.03, full books ~$0.14, max input (100k chars) ~$0.25.

## What Joji AI does with library content

No changes needed to the AI. It already:
- Searches the vault on every message
- Gets relevant chunks in the system prompt
- References vault content in responses

Library files are just more vault files. The AI will naturally pull from Hormozi's frameworks when you ask business questions — while still being Joji AI, not pretending to be Hormozi.

## Out of scope (future)

- URL/web page import
- YouTube transcript import
- Library browsing UI in the app
- Editing library files from the app
- Multiple file upload at once
- OCR for scanned PDFs
