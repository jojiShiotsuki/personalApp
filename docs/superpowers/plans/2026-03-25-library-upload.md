# Library Upload System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload PDFs and paste text that gets distilled by Sonnet, auto-organized by Haiku, and saved to the Obsidian vault as searchable knowledge.

**Architecture:** FastAPI multipart endpoint → PyMuPDF text extraction → duplicate check via source hash → Sonnet distills to markdown → Haiku picks category/filename → save to vault `library/` folder → instant re-index. Shared vault utilities extracted to avoid duplication.

**Tech Stack:** FastAPI (UploadFile + Form), PyMuPDF (fitz), AsyncAnthropic (Sonnet + Haiku), existing VaultFile/VaultChunk models, existing re-index infrastructure.

**Spec:** `docs/superpowers/specs/2026-03-25-library-upload-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/services/vault_utils.py` | Create | Shared vault utilities: sanitize_filename, write_vault_file, push_vault_changes |
| `backend/app/services/library_service.py` | Create | PDF extraction, duplicate check, Sonnet distill, Haiku organize, save to vault |
| `backend/app/routes/joji_ai.py` | Modify | Add `POST /api/ai/library/upload` endpoint |
| `backend/requirements.txt` | Modify | Add `pymupdf` |
| `backend/app/services/crm_vault_sync.py` | Modify | Import shared utilities from vault_utils instead of duplicating |
| `backend/app/services/tool_executor.py` | Modify | Import shared push logic from vault_utils |
| `frontend/src/lib/api.ts` | Modify | Add `uploadToLibrary()` API function |
| `frontend/src/components/joji-ai/AISettingsPanel.tsx` | Modify | Add "Brain Library" section with upload panel |
| `frontend/src/components/joji-ai/LibraryUploadPanel.tsx` | Create | Upload UI: drag-drop PDF, text paste, processing states |

---

### Task 1: Install PyMuPDF dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pymupdf to requirements.txt**

Add this line after the existing dependencies:

```
pymupdf>=1.24.0
```

- [ ] **Step 2: Install it**

Run: `cd backend && source venv/Scripts/activate && pip install pymupdf`

- [ ] **Step 3: Verify import**

Run: `python -c "import fitz; print(f'PyMuPDF {fitz.version}')"`

Expected: `PyMuPDF 1.24.x`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add pymupdf for PDF text extraction"
```

---

### Task 2: Create `vault_utils.py` — shared vault utilities

**Files:**
- Create: `backend/app/services/vault_utils.py`

- [ ] **Step 1: Create the file with sanitize_filename, write_vault_file, push_vault_changes**

```python
"""
Shared vault utilities used by CRM vault sync, library service,
tool executor, and conversation learner.
"""

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.services.vault_config import VAULT_REPO_DIR
from app.services import obsidian_client

logger = logging.getLogger(__name__)


def sanitize_filename(name: str) -> str:
    """Convert a name to a safe lowercase filename slug.

    Replaces spaces with hyphens, removes special characters,
    and truncates to 100 characters.
    """
    if not name:
        return "unnamed"
    sanitized = name.lower().strip()
    sanitized = re.sub(r"[\s_]+", "-", sanitized)
    sanitized = re.sub(r"[^a-z0-9\-.]", "", sanitized)
    sanitized = re.sub(r"-{2,}", "-", sanitized)
    sanitized = sanitized.strip("-")
    if len(sanitized) > 100:
        sanitized = sanitized[:100].rstrip("-")
    return sanitized or "unnamed"


def write_vault_file(relative_path: str, content: str) -> None:
    """Write a file to the vault via Obsidian REST API + filesystem."""
    obsidian_client.write_file(relative_path, content)
    dest = VAULT_REPO_DIR / relative_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")


def push_vault_changes(db: Session, paths: list[str], commit_msg: str) -> None:
    """Git add specific paths, commit, and push with auth token injection."""
    try:
        if not VAULT_REPO_DIR.exists() or not (VAULT_REPO_DIR / ".git").exists():
            logger.debug("Vault push: no vault repo, skipping")
            return

        import git

        repo = git.Repo(VAULT_REPO_DIR)

        for p in paths:
            repo.git.add(p)

        if not repo.is_dirty(index=True, untracked_files=True):
            logger.debug("Vault push: no changes to push")
            return

        repo.index.commit(commit_msg)

        try:
            repo.remotes.origin.push()
        except git.GitCommandError:
            # Inject auth token if remote URL lacks credentials
            _push_with_auth(db, repo)

    except Exception:
        logger.exception("Vault push failed for: %s", paths)


def _push_with_auth(db: Session, repo) -> None:
    """Push with GitHub token injected into remote URL."""
    import git

    try:
        from app.models.joji_ai import JojiAISettings
        from app.services.encryption_service import EncryptionService

        settings = db.query(JojiAISettings).first()
        if settings and settings.github_token_encrypted:
            token = EncryptionService.decrypt(settings.github_token_encrypted)
            current_url = repo.remotes.origin.url
            auth_url = re.sub(r"^https://", f"https://{token}@", current_url)
            repo.remotes.origin.set_url(auth_url)
            try:
                repo.remotes.origin.push()
            finally:
                repo.remotes.origin.set_url(current_url)
        else:
            repo.remotes.origin.pull(rebase=True)
            repo.remotes.origin.push()
    except git.GitCommandError:
        repo.remotes.origin.pull(rebase=True)
        repo.remotes.origin.push()
```

- [ ] **Step 2: Verify import**

Run: `cd backend && source venv/Scripts/activate && python -c "from app.services.vault_utils import sanitize_filename, write_vault_file, push_vault_changes; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/vault_utils.py
git commit -m "feat: add shared vault_utils (sanitize, write, push)"
```

---

### Task 3: Create `library_service.py` — core upload pipeline

**Files:**
- Create: `backend/app/services/library_service.py`

- [ ] **Step 1: Create the service with all pipeline functions**

```python
"""
Library service — handles PDF/text upload pipeline:
extract → duplicate check → Sonnet distill → Haiku organize → save to vault.
"""

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from anthropic import AsyncAnthropic
from sqlalchemy.orm import Session

from app.models.joji_ai import VaultChunk, VaultFile
from app.services.vault_config import VAULT_REPO_DIR
from app.services.vault_utils import sanitize_filename, write_vault_file, push_vault_changes

logger = logging.getLogger(__name__)

SONNET_MODEL = "claude-sonnet-4-6"
HAIKU_MODEL = "claude-haiku-4-5-20251001"
MAX_DISTILL_CHARS = 100_000
MAX_TEXT_CHARS = 500_000
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

DISTILL_PROMPT = """You are distilling a book/document into a structured knowledge base entry.

Extract:
1. Key frameworks and mental models (with examples)
2. Actionable principles (specific, not vague)
3. Notable quotes worth remembering
4. How this applies to a freelance web developer targeting Australian clients

Format as clean markdown with headers. Be thorough but concise — capture
the substance, skip the filler. Write it so someone who hasn't read the
original can understand and apply the frameworks."""

ORGANIZE_PROMPT = """Given this content summary, return JSON with the best category folder
and filename for organizing it in a knowledge vault.

Categories: business, sales, marketing, mindset, operations, finance,
or suggest a new one if none fit.

Return: {"category": "<folder>", "filename": "<slug>", "title": "<display title>"}
Only lowercase alphanumeric and hyphens in category and filename."""


def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF. Validates magic bytes."""
    if not file_bytes[:5].startswith(b"%PDF-"):
        raise ValueError("File is not a valid PDF (invalid magic bytes)")

    import fitz  # PyMuPDF

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
    doc.close()

    if not pages:
        raise ValueError("Could not extract text from PDF (may be scanned/image-only)")

    return "\n\n".join(pages)


def compute_source_hash(text: str) -> str:
    """SHA256 hash of source text for duplicate detection."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_duplicate(db: Session, source_hash: str) -> Optional[str]:
    """Check if content with this source hash already exists in the vault.

    Looks at metadata_json on chunk_index=0 VaultChunks for a matching
    source_content_hash. Returns the file_path if duplicate found, else None.
    """
    chunks = (
        db.query(VaultChunk)
        .filter(VaultChunk.chunk_index == 0)
        .filter(VaultChunk.metadata_json.isnot(None))
        .all()
    )
    for chunk in chunks:
        meta = chunk.metadata_json if isinstance(chunk.metadata_json, dict) else {}
        if meta.get("source_content_hash") == source_hash:
            vault_file = db.query(VaultFile).filter(VaultFile.id == chunk.vault_file_id).first()
            return vault_file.file_path if vault_file else None
    return None


async def distill_content(text: str, title_hint: Optional[str] = None) -> str:
    """Use Sonnet to distill text into structured markdown."""
    client = AsyncAnthropic()

    truncated = text[:MAX_DISTILL_CHARS]
    user_msg = f"Distill this document into a knowledge base entry:\n\n"
    if title_hint:
        user_msg += f"Title: {title_hint}\n\n"
    user_msg += truncated

    response = await client.messages.create(
        model=SONNET_MODEL,
        max_tokens=4096,
        system=DISTILL_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    return response.content[0].text


async def auto_organize(summary: str) -> dict:
    """Use Haiku to determine category folder and filename."""
    client = AsyncAnthropic()

    response = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=256,
        system=ORGANIZE_PROMPT,
        messages=[{"role": "user", "content": summary[:2000]}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    result = json.loads(text)

    # Sanitize and validate
    category = sanitize_filename(result.get("category", "uncategorized"))
    filename = sanitize_filename(result.get("filename", "untitled"))
    title = result.get("title", filename)

    # Path security check
    final_path = (VAULT_REPO_DIR / "library" / category / f"{filename}.md").resolve()
    library_root = (VAULT_REPO_DIR / "library").resolve()
    if not str(final_path).startswith(str(library_root)):
        raise ValueError("Path traversal detected in AI-generated path")

    return {"category": category, "filename": filename, "title": title}


def save_to_vault(
    db: Session,
    category: str,
    filename: str,
    distilled_content: str,
    source_hash: str,
    title: str,
    source_type: str = "pdf",
) -> dict:
    """Save distilled content to vault, re-index, and git push."""
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Build frontmatter + content
    frontmatter = (
        f"---\n"
        f"type: library\n"
        f"source: {source_type}\n"
        f"title: \"{title}\"\n"
        f"category: {category}\n"
        f"uploaded: {today}\n"
        f"distilled_by: {SONNET_MODEL}\n"
        f"source_hash: {source_hash}\n"
        f"---\n\n"
    )
    full_content = frontmatter + distilled_content

    relative_path = f"library/{category}/{filename}.md"

    # Write to vault (Obsidian REST API + filesystem)
    write_vault_file(relative_path, full_content)

    # Git commit and push
    push_vault_changes(db, [f"library/{category}/"], f"Library: add {title}")

    # Re-index immediately
    from app.services.conversation_learner import _reindex_files
    _reindex_files(db, [relative_path])

    # Store source_hash in the first chunk's metadata for duplicate detection
    first_chunk = (
        db.query(VaultChunk)
        .join(VaultFile)
        .filter(VaultFile.file_path == relative_path, VaultChunk.chunk_index == 0)
        .first()
    )
    if first_chunk:
        meta = first_chunk.metadata_json or {}
        if isinstance(meta, str):
            import json as json_mod
            meta = json_mod.loads(meta)
        meta["source_content_hash"] = source_hash
        first_chunk.metadata_json = meta
        db.commit()

    return {
        "status": "success",
        "file_path": relative_path,
        "title": title,
        "preview": distilled_content[:200],
    }
```

- [ ] **Step 2: Verify import**

Run: `python -c "from app.services.library_service import extract_pdf_text, distill_content, auto_organize, save_to_vault; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/library_service.py
git commit -m "feat: add library_service — PDF extract, distill, organize, save pipeline"
```

---

### Task 4: Add `POST /api/ai/library/upload` endpoint

**Files:**
- Modify: `backend/app/routes/joji_ai.py`

- [ ] **Step 1: Add the upload endpoint after the existing vault endpoints**

Find the comment block for section 14 (`gmail-sync-now`) and add this new section before it:

```python
# ---------------------------------------------------------------------------
# 15. POST /library/upload -- Upload PDF or text to brain library
# ---------------------------------------------------------------------------

@router.post("/library/upload")
async def upload_to_library(
    file: UploadFile = File(None),
    text: str = Form(None),
    title: str = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a PDF or paste text to distill and save to the vault library."""
    from app.services.library_service import (
        extract_pdf_text, compute_source_hash, check_duplicate,
        distill_content, auto_organize, save_to_vault,
        MAX_FILE_BYTES, MAX_TEXT_CHARS,
    )

    # Validate input
    if not file and not text:
        raise HTTPException(status_code=400, detail="No file or text provided")

    # Rate limit: 20 uploads per day
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    upload_count = (
        db.query(func.count(VaultFile.id))
        .filter(
            VaultFile.file_path.startswith("library/"),
            VaultFile.last_synced_at >= today_start,
        )
        .scalar() or 0
    )
    if upload_count >= 20:
        raise HTTPException(status_code=429, detail="Upload limit reached (20 per day)")

    # Extract text from PDF or use pasted text
    if file:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

        try:
            extracted_text = extract_pdf_text(file_bytes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        if len(text) > MAX_TEXT_CHARS:
            raise HTTPException(status_code=400, detail="Text too long (max 500,000 characters)")
        if not text.strip():
            raise HTTPException(status_code=400, detail="Text is empty")
        extracted_text = text

    # Check for duplicates
    source_hash = compute_source_hash(extracted_text)
    existing = check_duplicate(db, source_hash)
    if existing:
        raise HTTPException(status_code=409, detail=f"Duplicate content already exists at: {existing}")

    # Distill with Sonnet
    try:
        distilled = await distill_content(extracted_text, title_hint=title)
    except Exception as e:
        logger.error("Distillation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to distill content")

    # Auto-organize with Haiku
    try:
        org = await auto_organize(distilled)
    except Exception as e:
        logger.error("Auto-organize failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to organize content")

    # Save to vault
    source_type = "pdf" if file else "text"
    result = save_to_vault(
        db=db,
        category=org["category"],
        filename=org["filename"],
        distilled_content=distilled,
        source_hash=source_hash,
        title=org["title"],
        source_type=source_type,
    )

    return result
```

- [ ] **Step 2: Add missing imports at the top of the file**

Add `UploadFile, File, Form` to the FastAPI import line:

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, Form
```

- [ ] **Step 3: Verify backend starts**

Run: `python -m uvicorn app.main:app --port 8002` — check no import errors, then stop it.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routes/joji_ai.py
git commit -m "feat: add POST /api/ai/library/upload endpoint"
```

---

### Task 5: Add frontend API function

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add `uploadToLibrary` to `jojiAiApi`**

Add this function inside the `jojiAiApi` object, before `getSettings`:

```typescript
  uploadToLibrary: async (file?: File, text?: string, title?: string): Promise<{
    status: string;
    file_path: string;
    title: string;
    preview: string;
  }> => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (text) formData.append('text', text);
    if (title) formData.append('title', title);
    const { data } = await api.post('/api/ai/library/upload', formData, {
      timeout: 60000,
    });
    return data;
  },
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add uploadToLibrary API function"
```

---

### Task 6: Create `LibraryUploadPanel.tsx` — upload UI component

**Files:**
- Create: `frontend/src/components/joji-ai/LibraryUploadPanel.tsx`

- [ ] **Step 1: Create the upload panel component**

```tsx
import { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Upload, FileText, Loader2, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jojiAiApi } from '@/lib/api';
import { toast } from 'sonner';

interface LibraryUploadPanelProps {
  onBack: () => void;
}

const inputClasses = cn(
  'w-full px-3 py-2 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm'
);

export default function LibraryUploadPanel({ onBack }: LibraryUploadPanelProps) {
  const [mode, setMode] = useState<'pdf' | 'text'>('pdf');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [title, setTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (mode === 'pdf' && selectedFile) {
        return jojiAiApi.uploadToLibrary(selectedFile, undefined, title || undefined);
      } else {
        return jojiAiApi.uploadToLibrary(undefined, textContent, title || undefined);
      }
    },
    onSuccess: (data) => {
      toast.success(`Saved to brain: ${data.file_path}`);
      setSelectedFile(null);
      setTextContent('');
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || 'Upload failed';
      toast.error(detail);
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast.error('Only PDF files are supported');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const canUpload = mode === 'pdf' ? !!selectedFile : !!textContent.trim();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-700/30">
        <button
          onClick={onBack}
          className={cn(
            'flex items-center gap-1.5 text-xs text-[--exec-text-secondary]',
            'hover:text-[--exec-text] transition-colors'
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to settings
        </button>
        <h2 className="text-sm font-semibold text-[--exec-text] mt-2">Upload to Brain</h2>
        <p className="text-[10px] text-[--exec-text-muted] mt-1">
          Content is distilled by AI and saved to your knowledge vault
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Mode toggle */}
        <div className="flex items-center bg-stone-800/50 p-1 rounded-lg">
          <button
            onClick={() => setMode('pdf')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'pdf'
                ? 'bg-stone-700/80 text-[--exec-text] shadow-sm'
                : 'text-[--exec-text-muted] hover:text-[--exec-text]'
            )}
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
          <button
            onClick={() => setMode('text')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'text'
                ? 'bg-stone-700/80 text-[--exec-text] shadow-sm'
                : 'text-[--exec-text-muted] hover:text-[--exec-text]'
            )}
          >
            <Type className="w-3 h-3" />
            Text
          </button>
        </div>

        {/* Title (optional) */}
        <div>
          <label className="block text-[10px] font-medium text-[--exec-text-muted] mb-1 uppercase tracking-wider">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. $100M Offers"
            className={inputClasses}
          />
        </div>

        {/* PDF drop zone */}
        {mode === 'pdf' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
              isDragOver
                ? 'border-[--exec-accent] bg-[--exec-accent]/5'
                : selectedFile
                  ? 'border-green-600/40 bg-green-900/10'
                  : 'border-stone-600/40 hover:border-stone-500/60 hover:bg-stone-800/30'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile ? (
              <>
                <FileText className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-xs text-[--exec-text] font-medium">{selectedFile.name}</p>
                <p className="text-[10px] text-[--exec-text-muted] mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-stone-500 mx-auto mb-2" />
                <p className="text-xs text-[--exec-text-muted]">
                  Drop a PDF here or click to browse
                </p>
                <p className="text-[10px] text-stone-600 mt-1">Max 10 MB</p>
              </>
            )}
          </div>
        )}

        {/* Text paste */}
        {mode === 'text' && (
          <div>
            <label className="block text-[10px] font-medium text-[--exec-text-muted] mb-1 uppercase tracking-wider">
              Paste content
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste notes, excerpts, or any text you want the AI to learn from..."
              rows={10}
              className={cn(inputClasses, 'resize-none')}
            />
            <p className="text-[10px] text-stone-600 mt-1">
              {textContent.length.toLocaleString()} / 500,000 characters
            </p>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={() => uploadMutation.mutate()}
          disabled={!canUpload || uploadMutation.isPending}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
            'transition-all duration-200',
            canUpload && !uploadMutation.isPending
              ? 'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md'
              : 'bg-stone-700/30 text-stone-500 cursor-not-allowed'
          )}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing... this may take up to 30 seconds
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload to Brain
            </>
          )}
        </button>

        {/* Info */}
        <p className="text-[10px] text-stone-600 text-center leading-relaxed">
          Content is distilled by AI into key frameworks and principles,
          auto-organized, and saved to your Obsidian vault. Browse and edit
          in Obsidian.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/joji-ai/LibraryUploadPanel.tsx
git commit -m "feat: add LibraryUploadPanel component — PDF drag-drop and text paste UI"
```

---

### Task 7: Wire up LibraryUploadPanel in AISettingsPanel

**Files:**
- Modify: `frontend/src/components/joji-ai/AISettingsPanel.tsx`

- [ ] **Step 1: Add import and state for library panel**

Add at top of file:

```typescript
import LibraryUploadPanel from '@/components/joji-ai/LibraryUploadPanel';
import { BookOpen } from 'lucide-react';
```

Add state inside the component:

```typescript
const [showLibrary, setShowLibrary] = useState(false);
```

- [ ] **Step 2: Add the panel swap — if showLibrary, render LibraryUploadPanel instead**

Wrap the existing return in the library check. At the very start of the `return` block, before the existing `<div className="flex flex-col h-full">`:

```tsx
if (showLibrary) {
  return <LibraryUploadPanel onBack={() => setShowLibrary(false)} />;
}
```

- [ ] **Step 3: Add "Brain Library" button in the settings panel**

Add a new section after the "Vault Sync" section (after the Gmail backfill status block), before the "Default Model" section:

```tsx
{/* Brain Library */}
<section className="pt-4 border-t border-stone-700/30">
  <button
    onClick={() => setShowLibrary(true)}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-3 rounded-lg',
      'bg-stone-800/50 border border-stone-600/40',
      'hover:bg-stone-700/50 hover:border-stone-500/50',
      'transition-all duration-200 group'
    )}
  >
    <div className="w-8 h-8 rounded-lg bg-[--exec-accent]/10 flex items-center justify-center">
      <BookOpen className="w-4 h-4 text-[--exec-accent]" />
    </div>
    <div className="text-left flex-1">
      <p className="text-xs font-medium text-[--exec-text]">Brain Library</p>
      <p className="text-[10px] text-[--exec-text-muted]">Upload PDFs and text to teach the AI</p>
    </div>
    <ArrowLeft className="w-3.5 h-3.5 text-stone-500 rotate-180 group-hover:translate-x-0.5 transition-transform" />
  </button>
</section>
```

- [ ] **Step 4: Add `BookOpen` to the lucide-react import line**

Update the existing import:

```typescript
import { ArrowLeft, Github, RefreshCw, Cpu, MessageSquareText, DollarSign, Check, Mail, Radio, BookOpen } from 'lucide-react';
```

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/joji-ai/AISettingsPanel.tsx
git commit -m "feat: wire up Brain Library button in AI Settings panel"
```

---

### Task 8: Test end-to-end and push

- [ ] **Step 1: Start backend and frontend**

```bash
cd backend && source venv/Scripts/activate && python -m uvicorn app.main:app --reload --port 8001
# In another terminal:
cd frontend && npm run dev
```

- [ ] **Step 2: Navigate to /ai → Settings → click "Brain Library"**

Verify the upload panel shows with PDF/Text toggle, title field, and drop zone.

- [ ] **Step 3: Upload a test PDF or paste text**

Paste some sample text (e.g., a paragraph about business) and click "Upload to Brain". Verify:
- Processing spinner shows
- Toast appears: "Saved to brain: library/<category>/<filename>.md"
- File appears in Obsidian under `library/` folder

- [ ] **Step 4: Verify duplicate detection**

Upload the same content again. Verify:
- Error toast: "Duplicate content already exists at: library/..."

- [ ] **Step 5: Ask Joji AI about the uploaded content**

Start a new conversation and ask about the content you uploaded. Verify the AI references it from the vault.

- [ ] **Step 6: Push to remote**

```bash
git push origin main
```
