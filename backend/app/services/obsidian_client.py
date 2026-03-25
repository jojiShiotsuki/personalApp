"""
Obsidian Local REST API client with filesystem fallback.

When Obsidian is open with the Local REST API plugin, operations go through
the REST API for instant visibility. When Obsidian is closed, falls back to
direct filesystem access + git push.
"""

import logging
import os
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

VAULT_REPO_DIR = Path(__file__).parent.parent.parent / "data" / "vault-repo"

# Defaults — overridable via env vars or settings
DEFAULT_OBSIDIAN_URL = "https://127.0.0.1:27124"
OBSIDIAN_TIMEOUT = 5.0  # seconds


def _get_url() -> str:
    return os.environ.get("OBSIDIAN_REST_URL", DEFAULT_OBSIDIAN_URL)


def _get_api_key() -> Optional[str]:
    return os.environ.get("OBSIDIAN_REST_API_KEY")


def _make_client() -> httpx.Client:
    """Create an httpx client that ignores the self-signed cert."""
    return httpx.Client(
        base_url=_get_url(),
        verify=False,  # Local REST API uses self-signed HTTPS
        timeout=OBSIDIAN_TIMEOUT,
    )


def _auth_headers() -> dict:
    key = _get_api_key()
    if not key:
        return {}
    return {"Authorization": f"Bearer {key}"}


def is_available() -> bool:
    """Check if Obsidian Local REST API is reachable."""
    key = _get_api_key()
    if not key:
        return False
    try:
        with _make_client() as client:
            resp = client.get("/", headers=_auth_headers())
            return resp.status_code == 200
    except Exception:
        return False


def read_file(file_path: str) -> Optional[str]:
    """Read a file via Obsidian REST API. Returns None if unavailable."""
    key = _get_api_key()
    if not key:
        return None
    try:
        with _make_client() as client:
            resp = client.get(
                f"/vault/{file_path}",
                headers={**_auth_headers(), "Accept": "text/markdown"},
            )
            if resp.status_code == 200:
                return resp.text
            return None
    except Exception:
        return None


def write_file(file_path: str, content: str) -> bool:
    """Write a file via Obsidian REST API. Returns True on success."""
    key = _get_api_key()
    if not key:
        return False
    try:
        with _make_client() as client:
            resp = client.put(
                f"/vault/{file_path}",
                headers={**_auth_headers(), "Content-Type": "text/markdown"},
                content=content,
            )
            if resp.status_code in (200, 204):
                logger.info("Wrote vault file via Obsidian REST API: %s", file_path)
                return True
            logger.warning("Obsidian REST API write returned %d for %s", resp.status_code, file_path)
            return False
    except Exception as exc:
        logger.debug("Obsidian REST API write failed for %s: %s", file_path, exc)
        return False


def delete_file(file_path: str) -> bool:
    """Delete a file via Obsidian REST API. Returns True on success."""
    key = _get_api_key()
    if not key:
        return False
    try:
        with _make_client() as client:
            resp = client.delete(
                f"/vault/{file_path}",
                headers=_auth_headers(),
            )
            return resp.status_code in (200, 204)
    except Exception:
        return False


def list_directory(directory: str = "") -> Optional[list]:
    """List a directory via Obsidian REST API. Returns None if unavailable."""
    key = _get_api_key()
    if not key:
        return None
    try:
        path = f"/vault/{directory}/" if directory else "/vault/"
        with _make_client() as client:
            resp = client.get(path, headers=_auth_headers())
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception:
        return None


def search(query: str) -> Optional[list]:
    """Search vault via Obsidian REST API. Returns None if unavailable."""
    key = _get_api_key()
    if not key:
        return None
    try:
        with _make_client() as client:
            resp = client.post(
                "/search/simple/",
                headers={**_auth_headers(), "Content-Type": "application/json"},
                json={"query": query},
            )
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception:
        return None
