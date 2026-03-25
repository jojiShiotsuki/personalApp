"""
Shared vault utilities: filename sanitisation, file writing, and git push.

These helpers consolidate logic that was previously duplicated across
crm_vault_sync.py and tool_executor.py.
"""

import logging
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.services import obsidian_client
from app.services.vault_config import VAULT_REPO_DIR

logger = logging.getLogger(__name__)


def sanitize_filename(name: str) -> str:
    """Convert an arbitrary name to a safe, lowercase filename slug.

    - Lowercase + strip surrounding whitespace
    - Replace spaces/underscores with hyphens
    - Remove characters that are not alphanumeric, hyphens, or dots
    - Collapse runs of multiple hyphens into one
    - Strip leading/trailing hyphens
    - Truncate to 100 characters (avoid trailing hyphen after cut)
    - Return "unnamed" if the result is empty
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
    """Write *content* to *relative_path* inside the vault.

    Attempts the Obsidian REST API first (instant visibility when Obsidian is
    open), then falls back to a direct filesystem write so the file is always
    persisted on disk regardless of whether Obsidian is running.
    """
    # 1. Obsidian REST API (best-effort — silently ignored on failure)
    obsidian_client.write_file(relative_path, content)

    # 2. Filesystem write (always executed)
    abs_path = VAULT_REPO_DIR / relative_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(content, encoding="utf-8")
    logger.debug("Wrote vault file to filesystem: %s", abs_path)


def push_vault_changes(db: Session, paths: list[str], commit_msg: str) -> None:
    """Stage *paths*, commit with *commit_msg*, and push to the remote.

    If the initial push fails the function attempts to inject a GitHub personal
    access token (retrieved from JojiAISettings and decrypted) into the remote
    URL, retries the push, then restores the original clean URL so the token
    is never persisted on disk.

    All errors are caught and logged; this function never raises.
    """
    try:
        if not VAULT_REPO_DIR.exists() or not (VAULT_REPO_DIR / ".git").exists():
            logger.debug("push_vault_changes: vault repo not found, skipping push")
            return

        import git  # type: ignore[import]

        repo = git.Repo(VAULT_REPO_DIR)

        # Stage the requested paths
        for path in paths:
            repo.git.add(path)

        # Nothing to commit?
        if not repo.is_dirty(index=True, untracked_files=True):
            logger.debug("push_vault_changes: no changes to commit")
            return

        repo.index.commit(commit_msg)
        logger.info("push_vault_changes: committed '%s'", commit_msg)

        # --- Ensure auth token is in remote URL before pushing ---
        from app.models.joji_ai import JojiAISettings
        from app.services.encryption_service import EncryptionService

        current_url = repo.remotes.origin.url
        needs_restore = False

        # If URL doesn't contain a token, inject one
        if "@github.com" not in current_url:
            settings = db.query(JojiAISettings).first()
            if settings and settings.github_token_encrypted:
                token = EncryptionService.decrypt(settings.github_token_encrypted)
                auth_url = re.sub(r"^https://", f"https://{token}@", current_url)
                repo.remotes.origin.set_url(auth_url)
                needs_restore = True
                logger.debug("push_vault_changes: injected auth token into remote URL")

        try:
            # Pull first to avoid conflicts
            try:
                repo.remotes.origin.pull(rebase=True)
            except git.GitCommandError as pull_err:
                logger.debug("push_vault_changes: pull-rebase failed (OK if fresh): %s", pull_err)

            repo.remotes.origin.push()
            logger.info("push_vault_changes: pushed successfully")
        except git.GitCommandError as push_err:
            logger.error("push_vault_changes: push failed: %s", push_err)
        finally:
            if needs_restore:
                repo.remotes.origin.set_url(current_url)

    except Exception:
        logger.exception("push_vault_changes: unexpected error during git push")
