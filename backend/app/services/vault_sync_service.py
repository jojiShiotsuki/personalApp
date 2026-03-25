"""
Vault sync service -- pulls Obsidian vault from GitHub, chunks markdown files,
and generates Voyage AI embeddings for semantic search.
"""

import hashlib
import logging
import os
import re
import struct
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.joji_ai import JojiAISettings, VaultChunk, VaultFile
from app.services.encryption_service import EncryptionService
from app.services.vault_config import VAULT_REPO_DIR

logger = logging.getLogger(__name__)
BATCH_SIZE = 20  # Commit after every N files to avoid long DB locks
CHUNK_CHAR_LIMIT = 2000  # ~500 tokens


class VaultSyncService:
    """Syncs an Obsidian vault from GitHub and indexes it for search."""

    def __init__(self) -> None:
        self._encryption = EncryptionService()
        voyage_key = os.getenv("VOYAGE_API_KEY")
        self._voyage_client = None
        if voyage_key:
            try:
                import voyageai

                self._voyage_client = voyageai.Client(api_key=voyage_key)
            except Exception as e:
                logger.warning("Failed to initialize Voyage AI client: %s", e)

    # ------------------------------------------------------------------
    # Main sync flow
    # ------------------------------------------------------------------

    async def sync_vault(
        self, db: Session, settings: JojiAISettings
    ) -> dict[str, Any]:
        """Pull the vault from GitHub, chunk markdown, embed, and store.

        Returns a results dict with status, counts of files synced /
        chunks created / files deleted.
        """
        if not settings.github_token_encrypted or not settings.github_repo_url:
            return {"status": "failed", "error": "GitHub repo or token not configured"}

        # 1. Decrypt token and build authenticated URL
        try:
            token = self._encryption.decrypt(settings.github_token_encrypted)
        except Exception as e:
            logger.error("Failed to decrypt GitHub token: %s", e)
            settings.last_sync_status = "failed"
            db.commit()
            return {"status": "failed", "error": "Token decryption failed"}

        auth_url = self._build_auth_url(settings.github_repo_url, token)

        # 2. Clone or pull
        try:
            self._clone_or_pull(auth_url)
        except Exception as e:
            logger.error("Git clone/pull failed: %s", e)
            settings.last_sync_status = "failed"
            db.commit()
            return {"status": "failed", "error": f"Git operation failed: {e}"}

        # 3. Walk markdown files
        md_files = self._collect_md_files()
        disk_paths: set[str] = set()
        files_synced = 0
        chunks_created = 0
        batch_counter = 0
        partial = False

        for md_path in md_files:
            rel_path = md_path.relative_to(VAULT_REPO_DIR).as_posix()
            disk_paths.add(rel_path)

            try:
                content = md_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.warning("Cannot read %s: %s", rel_path, e)
                continue

            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

            # Look up existing VaultFile
            vault_file = (
                db.query(VaultFile).filter(VaultFile.file_path == rel_path).first()
            )

            if vault_file and vault_file.content_hash == content_hash:
                continue  # unchanged

            # New or changed -- delete old chunks, re-index
            if vault_file:
                db.query(VaultChunk).filter(
                    VaultChunk.vault_file_id == vault_file.id
                ).delete()
            else:
                vault_file = VaultFile(file_path=rel_path, content_hash=content_hash)
                db.add(vault_file)

            vault_file.content_hash = content_hash
            vault_file.last_synced_at = datetime.utcnow()

            # Flush to get vault_file.id for new records
            db.flush()

            # Chunk and embed
            raw_chunks = self.chunk_markdown(content, rel_path)
            texts = [c["content"] for c in raw_chunks]
            embeddings = self.embed_chunks(texts)

            if self._voyage_client and all(e is None for e in embeddings):
                partial = True  # Voyage was expected but failed

            for i, chunk_dict in enumerate(raw_chunks):
                db_chunk = VaultChunk(
                    vault_file_id=vault_file.id,
                    chunk_index=chunk_dict["chunk_index"],
                    content=chunk_dict["content"],
                    embedding=embeddings[i] if embeddings[i] is not None else None,
                    heading_context=chunk_dict["heading_context"],
                    metadata_json=chunk_dict["metadata"] or None,
                )
                db.add(db_chunk)

            chunks_created += len(raw_chunks)
            files_synced += 1
            batch_counter += 1

            if batch_counter >= BATCH_SIZE:
                db.commit()
                batch_counter = 0

        # 4. Delete files that no longer exist on disk
        all_db_files = db.query(VaultFile).all()
        files_deleted = 0
        for db_file in all_db_files:
            if db_file.file_path not in disk_paths:
                db.delete(db_file)  # cascade deletes chunks
                files_deleted += 1

        # 5. Final commit
        total_files = len(disk_paths)
        status = "partial" if partial else "success"
        if not self._voyage_client:
            status = "partial"  # no Voyage client at all

        settings.last_sync_at = datetime.utcnow()
        settings.last_sync_status = status
        settings.last_sync_file_count = total_files
        db.commit()

        return {
            "status": status,
            "files_synced": files_synced,
            "chunks_created": chunks_created,
            "files_deleted": files_deleted,
        }

    # ------------------------------------------------------------------
    # Git helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_auth_url(repo_url: str, token: str) -> str:
        """Convert a GitHub URL into an authenticated clone URL.

        e.g. https://github.com/user/repo  ->  https://{token}@github.com/user/repo.git
        """
        url = repo_url.rstrip("/")
        if not url.endswith(".git"):
            url += ".git"
        # Insert token after the scheme
        url = re.sub(r"^https://", f"https://{token}@", url)
        return url

    @staticmethod
    def _clone_or_pull(auth_url: str) -> None:
        """Clone a fresh copy or pull latest changes."""
        import git

        if VAULT_REPO_DIR.exists() and (VAULT_REPO_DIR / ".git").exists():
            repo = git.Repo(VAULT_REPO_DIR)
            repo.remotes.origin.pull()
        else:
            VAULT_REPO_DIR.mkdir(parents=True, exist_ok=True)
            git.Repo.clone_from(auth_url, str(VAULT_REPO_DIR))

    @staticmethod
    def _collect_md_files() -> list[Path]:
        """Return all .md files in the vault repo, skipping .git/ and .obsidian/."""
        results: list[Path] = []
        for md_path in VAULT_REPO_DIR.rglob("*.md"):
            parts = md_path.relative_to(VAULT_REPO_DIR).parts
            if any(p in (".git", ".obsidian") for p in parts):
                continue
            results.append(md_path)
        return sorted(results)

    # ------------------------------------------------------------------
    # Markdown chunking
    # ------------------------------------------------------------------

    @staticmethod
    def chunk_markdown(content: str, file_path: str) -> list[dict]:
        """Split markdown content into chunks of roughly 500 tokens (~2000 chars).

        Rules:
        - Headings (lines starting with #) always start a new chunk.
        - Fenced code blocks (```) are kept intact even if over limit.
        - YAML frontmatter (between --- at start of file) extracted as
          metadata and NOT included in chunks.
        - Heading hierarchy tracked: "## Pricing" then "### Hourly" gives
          heading_context "Pricing > Hourly".
        - Obsidian [[wikilinks]] preserved as-is.

        Returns list of dicts with keys: content, heading_context,
        chunk_index, metadata.
        """
        lines = content.split("\n")

        # --- Extract YAML frontmatter ---
        metadata: dict[str, Any] = {}
        body_start = 0
        if lines and lines[0].strip() == "---":
            for i in range(1, len(lines)):
                if lines[i].strip() == "---":
                    frontmatter_text = "\n".join(lines[1:i])
                    metadata = _parse_yaml_frontmatter(frontmatter_text)
                    body_start = i + 1
                    break

        body_lines = lines[body_start:]

        # --- Parse into logical sections ---
        # Each section is a list of lines that belong together.
        sections: list[dict] = []
        heading_stack: list[tuple[int, str]] = []  # (level, text)
        current_lines: list[str] = []
        current_heading_context = ""
        in_code_block = False

        def _flush() -> None:
            nonlocal current_lines
            text = "\n".join(current_lines).strip()
            if text:
                sections.append(
                    {"content": text, "heading_context": current_heading_context}
                )
            current_lines = []

        for line in body_lines:
            stripped = line.strip()

            # Track fenced code blocks
            if stripped.startswith("```"):
                if in_code_block:
                    # End of code block -- include closing fence in current
                    current_lines.append(line)
                    in_code_block = False
                    continue
                else:
                    in_code_block = True
                    current_lines.append(line)
                    continue

            if in_code_block:
                current_lines.append(line)
                continue

            # Heading detection
            heading_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
            if heading_match:
                _flush()
                level = len(heading_match.group(1))
                heading_text = heading_match.group(2).strip()

                # Update heading stack
                heading_stack = [
                    (lvl, txt) for lvl, txt in heading_stack if lvl < level
                ]
                heading_stack.append((level, heading_text))
                current_heading_context = " > ".join(
                    txt for _, txt in heading_stack
                )

                current_lines.append(line)
                continue

            current_lines.append(line)

        # Flush remaining lines
        _flush()

        # --- Split sections into size-limited chunks ---
        chunks: list[dict] = []
        chunk_index = 0

        for section in sections:
            text = section["content"]
            ctx = section["heading_context"]

            if len(text) <= CHUNK_CHAR_LIMIT:
                chunks.append(
                    {
                        "content": text,
                        "heading_context": ctx,
                        "chunk_index": chunk_index,
                        "metadata": metadata if chunk_index == 0 else {},
                    }
                )
                chunk_index += 1
            else:
                # Split large sections by paragraph, preserving code blocks
                sub_chunks = _split_large_section(text, CHUNK_CHAR_LIMIT)
                for sc in sub_chunks:
                    chunks.append(
                        {
                            "content": sc,
                            "heading_context": ctx,
                            "chunk_index": chunk_index,
                            "metadata": metadata if chunk_index == 0 else {},
                        }
                    )
                    chunk_index += 1

        # Guarantee at least one chunk for non-empty content
        if not chunks and content.strip():
            chunks.append(
                {
                    "content": content.strip()[:CHUNK_CHAR_LIMIT],
                    "heading_context": "",
                    "chunk_index": 0,
                    "metadata": metadata,
                }
            )

        return chunks

    # ------------------------------------------------------------------
    # Embeddings
    # ------------------------------------------------------------------

    def embed_chunks(self, texts: list[str]) -> list[Optional[bytes]]:
        """Generate Voyage AI embeddings for a list of text chunks.

        Returns a list of byte-packed float32 arrays (one per chunk).
        If no Voyage client is available or the API call fails, returns
        a list of None so chunks are stored without embeddings.
        """
        if not self._voyage_client or not texts:
            return [None] * len(texts)

        try:
            result = self._voyage_client.embed(
                texts, model="voyage-3-lite", input_type="document"
            )
            packed: list[Optional[bytes]] = []
            for emb in result.embeddings:
                packed.append(struct.pack(f"{len(emb)}f", *emb))
            return packed
        except Exception as e:
            logger.warning("Voyage AI embedding failed: %s", e)
            return [None] * len(texts)


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------


def _parse_yaml_frontmatter(text: str) -> dict[str, Any]:
    """Best-effort YAML frontmatter parsing without requiring PyYAML.

    Handles simple key: value pairs commonly found in Obsidian notes.
    Falls back to an empty dict on any parse error.
    """
    result: dict[str, Any] = {}
    try:
        for line in text.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                key, _, value = line.partition(":")
                key = key.strip()
                value = value.strip()
                # Strip surrounding quotes
                if (value.startswith('"') and value.endswith('"')) or (
                    value.startswith("'") and value.endswith("'")
                ):
                    value = value[1:-1]
                # Handle simple YAML lists written as [a, b, c]
                if value.startswith("[") and value.endswith("]"):
                    items = [
                        v.strip().strip("\"'") for v in value[1:-1].split(",")
                    ]
                    result[key] = items
                else:
                    result[key] = value
    except Exception:
        pass
    return result


def _split_large_section(text: str, limit: int) -> list[str]:
    """Split a large text block into chunks respecting paragraph boundaries.

    Code blocks (fenced with ```) are kept intact even if they exceed the
    limit, so that code examples are never broken mid-block.
    """
    paragraphs: list[str] = []
    current: list[str] = []
    in_code = False

    for line in text.split("\n"):
        if line.strip().startswith("```"):
            if in_code:
                # Closing fence -- end code block paragraph
                current.append(line)
                paragraphs.append("\n".join(current))
                current = []
                in_code = False
                continue
            else:
                # Opening fence -- flush anything before it
                if current:
                    paragraphs.append("\n".join(current))
                    current = []
                current.append(line)
                in_code = True
                continue

        if in_code:
            current.append(line)
            continue

        # Outside code: split on blank lines
        if line.strip() == "":
            if current:
                paragraphs.append("\n".join(current))
                current = []
        else:
            current.append(line)

    if current:
        paragraphs.append("\n".join(current))

    # Merge paragraphs into chunks that stay under the limit
    chunks: list[str] = []
    buffer = ""

    for para in paragraphs:
        if not buffer:
            buffer = para
        elif len(buffer) + len(para) + 2 <= limit:
            buffer = buffer + "\n\n" + para
        else:
            chunks.append(buffer)
            buffer = para

    if buffer:
        chunks.append(buffer)

    return chunks
