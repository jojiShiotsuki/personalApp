"""
Single source of truth for the vault repo path.

Locally: defaults to C:/Users/Shiot/joji-vault (same folder Obsidian uses)
Render:  set VAULT_PATH env var, or falls back to backend/data/vault-repo
"""

import os
from pathlib import Path

_default_local = Path("C:/Users/Shiot/joji-vault")
_default_fallback = Path(__file__).parent.parent.parent / "data" / "vault-repo"

VAULT_REPO_DIR = Path(os.environ.get("VAULT_PATH", str(_default_local if _default_local.exists() else _default_fallback)))
