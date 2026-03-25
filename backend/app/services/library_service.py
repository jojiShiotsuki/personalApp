"""
Library service: PDF extraction, AI distillation, auto-organization, and vault persistence.

Pipeline:
1. Extract text from PDF (PyMuPDF) or accept raw text
2. Hash text for duplicate detection
3. Sonnet distills into structured markdown (frameworks, principles, quotes)
4. Haiku picks category folder + filename for auto-organization
5. Save to Obsidian vault under library/<category>/<filename>.md
6. Re-index immediately for search
"""

import hashlib
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from anthropic import AsyncAnthropic
from sqlalchemy.orm import Session

from app.models.joji_ai import VaultChunk, VaultFile
from app.services.vault_config import VAULT_REPO_DIR
from app.services.vault_utils import sanitize_filename, write_vault_file, push_vault_changes

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SONNET_MODEL = "claude-sonnet-4-6"
HAIKU_MODEL = "claude-haiku-4-5-20251001"
MAX_DISTILL_CHARS = 100_000
MAX_TEXT_CHARS = 500_000
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------

def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract plain text from a PDF given its raw bytes.

    Raises ValueError for non-PDF input or image-only PDFs where no text
    could be extracted.
    """
    if not file_bytes[:5].startswith(b"%PDF-"):
        raise ValueError("Invalid file: not a PDF (magic bytes mismatch)")

    import fitz  # PyMuPDF

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages: list[str] = []
    for page in doc:
        page_text = page.get_text()
        if page_text.strip():
            pages.append(page_text)

    if not pages:
        raise ValueError(
            "Could not extract text from PDF (may be scanned/image-only)"
        )

    return "\n\n".join(pages)


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------

def compute_source_hash(text: str) -> str:
    """Return a SHA-256 hex digest of the UTF-8-encoded text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_duplicate(db: Session, source_hash: str) -> Optional[str]:
    """Return the vault file_path if this content has already been uploaded.

    Searches VaultChunk rows at chunk_index=0 (first chunk of each file) that
    carry a ``source_content_hash`` in their metadata_json.
    """
    candidates = (
        db.query(VaultChunk)
        .filter(
            VaultChunk.chunk_index == 0,
            VaultChunk.metadata_json.isnot(None),
        )
        .all()
    )

    for chunk in candidates:
        meta = chunk.metadata_json
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (json.JSONDecodeError, TypeError):
                continue
        if not isinstance(meta, dict):
            continue
        if meta.get("source_content_hash") == source_hash:
            vault_file = db.query(VaultFile).filter(
                VaultFile.id == chunk.vault_file_id
            ).first()
            if vault_file:
                return vault_file.file_path

    return None


# ---------------------------------------------------------------------------
# AI distillation
# ---------------------------------------------------------------------------

async def distill_content(text: str, title_hint: Optional[str] = None) -> str:
    """Use Sonnet to distil *text* into a structured markdown knowledge entry."""
    client = AsyncAnthropic()

    truncated = text[:MAX_DISTILL_CHARS]

    system_prompt = (
        "You are distilling a book/document into a structured knowledge base entry.\n\n"
        "Extract:\n"
        "1. Key frameworks and mental models (with examples)\n"
        "2. Actionable principles (specific, not vague)\n"
        "3. Notable quotes worth remembering\n"
        "4. How this applies to a freelance web developer targeting Australian clients\n\n"
        "Format as clean markdown with headers. Be thorough but concise — capture the "
        "substance, skip the filler. Write it so someone who hasn't read the original "
        "can understand and apply the frameworks."
    )

    if title_hint:
        user_message = f"Distill this document:\n\nTitle: {title_hint}\n\n{truncated}"
    else:
        user_message = f"Distill this document:\n\n{truncated}"

    response = await client.messages.create(
        model=SONNET_MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    return response.content[0].text


# ---------------------------------------------------------------------------
# Auto-organization
# ---------------------------------------------------------------------------

async def auto_organize(summary: str) -> dict:
    """Use Haiku to pick a category folder and filename for the content.

    Returns a dict with ``category``, ``filename``, and ``title`` keys.
    Raises ValueError if the path would escape the library directory.
    """
    client = AsyncAnthropic()

    system_prompt = (
        "Given this content summary, return JSON with the best category folder and "
        "filename for organizing it in a knowledge vault.\n\n"
        "Categories: business, sales, marketing, mindset, operations, finance, or "
        "suggest a new one if none fit.\n\n"
        'Return: {"category": "<folder>", "filename": "<slug>", "title": "<display title>"}\n'
        "Only lowercase alphanumeric and hyphens in category and filename."
    )

    response = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=256,
        system=system_prompt,
        messages=[{"role": "user", "content": summary[:2000]}],
    )

    raw = response.content[0].text

    # Strip optional ```json … ``` fences
    json_match = re.search(r"```json\s*(.*?)\s*```", raw, re.DOTALL)
    if json_match:
        raw = json_match.group(1)
    else:
        # Try to extract a bare JSON object
        obj_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if obj_match:
            raw = obj_match.group(0)

    data = json.loads(raw)

    category = sanitize_filename(data.get("category", "general"))
    filename = sanitize_filename(data.get("filename", "document"))
    title = data.get("title", filename)

    # Path security: ensure the resolved path stays inside library/
    library_root = (VAULT_REPO_DIR / "library").resolve()
    candidate = (VAULT_REPO_DIR / "library" / category / filename).resolve()
    if not str(candidate).startswith(str(library_root)):
        raise ValueError(
            f"Path traversal detected: resolved path {candidate} is outside {library_root}"
        )

    return {"category": category, "filename": filename, "title": title}


# ---------------------------------------------------------------------------
# Vault persistence
# ---------------------------------------------------------------------------

def save_to_vault(
    db: Session,
    category: str,
    filename: str,
    distilled_content: str,
    source_hash: str,
    title: str,
    source_type: str = "pdf",
) -> dict:
    """Write the distilled content to the vault, push changes, and re-index.

    Returns a summary dict with ``status``, ``file_path``, ``title``, and a
    short ``preview`` of the distilled content.
    """
    today = datetime.utcnow().strftime("%Y-%m-%d")

    frontmatter = (
        "---\n"
        "type: library\n"
        f"source: {source_type}\n"
        f'title: "{title}"\n'
        f"category: {category}\n"
        f"uploaded: {today}\n"
        f"distilled_by: claude-sonnet-4-6\n"
        f"source_hash: {source_hash}\n"
        "---\n\n"
    )

    full_content = frontmatter + distilled_content
    relative_path = f"library/{category}/{filename}.md"

    # Write file and push to remote
    write_vault_file(relative_path, full_content)
    push_vault_changes(
        db,
        [f"library/{category}/"],
        f"Library: add {title}",
    )

    # Re-index so the new file is immediately searchable
    from app.services.conversation_learner import _reindex_files

    _reindex_files(db, [relative_path])

    # Store source_hash in the first chunk's metadata so duplicates can be found
    first_chunk = (
        db.query(VaultChunk)
        .join(VaultFile)
        .filter(
            VaultFile.file_path == relative_path,
            VaultChunk.chunk_index == 0,
        )
        .first()
    )

    if first_chunk:
        meta = first_chunk.metadata_json or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (json.JSONDecodeError, TypeError):
                meta = {}
        if not isinstance(meta, dict):
            meta = {}
        meta["source_content_hash"] = source_hash
        first_chunk.metadata_json = meta
        db.commit()
    else:
        logger.warning(
            "save_to_vault: could not find first chunk for %s — hash not stored",
            relative_path,
        )

    return {
        "status": "success",
        "file_path": relative_path,
        "title": title,
        "preview": distilled_content[:200],
    }
