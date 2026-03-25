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

        # --- Push, with auth-token fallback ---
        try:
            repo.remotes.origin.push()
        except git.GitCommandError:
            logger.warning("push_vault_changes: push failed, attempting token injection")
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
                        # Always restore the clean URL — never leave the token on disk
                        repo.remotes.origin.set_url(current_url)
                else:
                    # No token available — try pull-rebase then push
                    repo.remotes.origin.pull(rebase=True)
                    repo.remotes.origin.push()
            except Exception as inner_exc:
                logger.error("push_vault_changes: token-injected push failed: %s", inner_exc)

    except Exception:
        logger.exception("push_vault_changes: unexpected error during git push")
