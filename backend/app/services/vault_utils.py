"""
Shared vault utilities: filename sanitisation, file writing, and git push.

These helpers consolidate logic that was previously duplicated across
crm_vault_sync.py and tool_executor.py.
"""

import base64
import logging
import re
from pathlib import Path
from typing import Optional

import httpx
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


# In-memory cache for files written this request (used by GitHub API push when filesystem is unavailable)
_pending_writes: dict[str, str] = {}


def write_vault_file(relative_path: str, content: str) -> None:
    """Write *content* to *relative_path* inside the vault.

    Attempts the Obsidian REST API first (instant visibility when Obsidian is
    open), then writes to filesystem if available, and caches content in memory
    for the GitHub API push fallback.
    """
    # Cache for GitHub API push (in case filesystem isn't available)
    _pending_writes[relative_path] = content

    # 1. Obsidian REST API (best-effort — silently ignored on failure)
    obsidian_client.write_file(relative_path, content)

    # 2. Filesystem write (if vault repo exists)
    if VAULT_REPO_DIR.exists():
        abs_path = VAULT_REPO_DIR / relative_path
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        logger.debug("Wrote vault file to filesystem: %s", abs_path)


def push_vault_changes(db: Session, paths: list[str], commit_msg: str) -> None:
    """Push vault file changes to GitHub in a background thread (non-blocking).

    Strategy:
    1. Try git push if the vault repo is cloned locally (works on localhost)
    2. If no local repo (Render after deploy), use GitHub Contents API directly

    All errors are caught and logged; this function never raises.
    """
    import threading

    # Snapshot the pending writes for the background thread
    snapshot = {k: v for k, v in _pending_writes.items() if any(k == p or k.startswith(p) for p in paths)}

    def _do_push():
        try:
            # Restore snapshot into pending writes for this thread
            _pending_writes.update(snapshot)

            if VAULT_REPO_DIR.exists() and (VAULT_REPO_DIR / ".git").exists():
                _git_push(db, paths, commit_msg)
                return
            logger.info("push_vault_changes: no local git repo, using GitHub API")
            _github_api_push(db, paths, commit_msg)
        except Exception:
            logger.exception("push_vault_changes: background push failed")

    thread = threading.Thread(target=_do_push, daemon=True)
    thread.start()


def _git_push(db: Session, paths: list[str], commit_msg: str) -> None:
    """Push via local git repo."""
    try:
        import git

        repo = git.Repo(VAULT_REPO_DIR)

        for path in paths:
            repo.git.add(path)

        if not repo.is_dirty(index=True, untracked_files=True):
            logger.debug("_git_push: no changes to commit")
            return

        repo.index.commit(commit_msg)
        logger.info("_git_push: committed '%s'", commit_msg)

        from app.models.joji_ai import JojiAISettings
        from app.services.encryption_service import EncryptionService

        current_url = repo.remotes.origin.url
        needs_restore = False

        if "@github.com" not in current_url:
            settings = db.query(JojiAISettings).first()
            if settings and settings.github_token_encrypted:
                token = EncryptionService().decrypt(settings.github_token_encrypted)
                auth_url = re.sub(r"^https://", f"https://{token}@", current_url)
                repo.remotes.origin.set_url(auth_url)
                needs_restore = True

        try:
            try:
                repo.remotes.origin.pull(rebase=True)
            except git.GitCommandError:
                pass
            repo.remotes.origin.push()
            logger.info("_git_push: pushed successfully")
        except git.GitCommandError as push_err:
            logger.error("_git_push: push failed: %s", push_err)
        finally:
            if needs_restore:
                repo.remotes.origin.set_url(current_url)

    except Exception:
        logger.exception("_git_push: unexpected error")


def _github_api_push(db: Session, paths: list[str], commit_msg: str) -> None:
    """Push files directly via GitHub Contents API — no git clone needed."""
    try:
        from app.models.joji_ai import JojiAISettings
        from app.services.encryption_service import EncryptionService

        settings = db.query(JojiAISettings).first()
        if not settings or not settings.github_repo_url or not settings.github_token_encrypted:
            logger.warning("_github_api_push: no GitHub settings configured")
            return

        token = EncryptionService().decrypt(settings.github_token_encrypted)
        repo_url = settings.github_repo_url.rstrip("/")
        # Extract owner/repo from URL like https://github.com/owner/repo
        match = re.search(r"github\.com/([^/]+/[^/.]+)", repo_url)
        if not match:
            logger.error("_github_api_push: can't parse repo from URL: %s", repo_url)
            return
        owner_repo = match.group(1)

        # Classic PATs use "token", fine-grained use "Bearer" — try token first
        auth_prefix = "token" if token.startswith("ghp_") else "Bearer"
        headers = {
            "Authorization": f"{auth_prefix} {token}",
            "Accept": "application/vnd.github.v3+json",
        }
        logger.info("_github_api_push: using %s auth for %s, paths=%s", auth_prefix, owner_repo, paths)

        # Push each file — from filesystem or in-memory cache
        logger.info("_github_api_push: pending_writes keys=%s", list(_pending_writes.keys()))
        for path_pattern in paths:
            # Check in-memory cache first (files written by write_vault_file)
            if path_pattern in _pending_writes:
                logger.info("_github_api_push: found %s in cache, pushing via API", path_pattern)
                _github_api_put_content(owner_repo, path_pattern, _pending_writes[path_pattern], commit_msg, headers)
                continue

            # Check filesystem
            search_dir = VAULT_REPO_DIR / path_pattern
            if search_dir.is_dir():
                files = list(search_dir.rglob("*.md"))
            elif search_dir.exists():
                files = [search_dir]
            else:
                # Check cache for any files matching this path prefix (e.g. "library/business/")
                matched = [k for k in _pending_writes if k.startswith(path_pattern)]
                for cached_path in matched:
                    _github_api_put_content(owner_repo, cached_path, _pending_writes[cached_path], commit_msg, headers)
                continue

            for file_path in files:
                rel_path = file_path.relative_to(VAULT_REPO_DIR).as_posix()
                content = file_path.read_text(encoding="utf-8")
                _github_api_put_content(owner_repo, rel_path, content, commit_msg, headers)

    except Exception:
        logger.exception("_github_api_push: unexpected error")


def _github_api_put_content(
    owner_repo: str,
    file_path: str,
    content: str,
    commit_msg: str,
    headers: dict,
) -> None:
    """Create or update a single file via GitHub Contents API."""
    try:
        encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")

        api_url = f"https://api.github.com/repos/{owner_repo}/contents/{file_path}"

        # Check if file already exists (need SHA to update)
        sha: Optional[str] = None
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.get(api_url, headers=headers)
                if resp.status_code == 200:
                    sha = resp.json().get("sha")
        except Exception:
            pass

        payload = {
            "message": commit_msg,
            "content": encoded,
        }
        if sha:
            payload["sha"] = sha

        with httpx.Client(timeout=15) as client:
            resp = client.put(api_url, headers=headers, json=payload)

        if resp.status_code in (200, 201):
            logger.info("_github_api_put_file: pushed %s to GitHub", file_path)
        else:
            logger.error("_github_api_put_file: failed for %s: %d %s", file_path, resp.status_code, resp.text[:200])

    except Exception as exc:
        logger.warning("_github_api_put_file: error for %s: %s", file_path, exc)
