"""Shared Fernet encryption service for token storage.

Used by GmailService (refresh tokens) and Joji AI (API key storage).
Reads from ENCRYPTION_KEY env var, falling back to GMAIL_ENCRYPTION_KEY
for backward compatibility.
"""

import base64
import logging
import os

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class EncryptionService:
    """Encrypts and decrypts sensitive tokens using Fernet symmetric encryption.

    Cipher text is base64-url-encoded on top of the Fernet output so it can be
    stored safely in any text column (SQLite, Postgres, etc.).  This matches the
    encoding scheme used by GmailService since the autoresearch feature was
    introduced -- existing stored tokens remain valid.
    """

    def __init__(self) -> None:
        # Try ENCRYPTION_KEY first, fall back to GMAIL_ENCRYPTION_KEY for backward compat
        key = os.getenv("ENCRYPTION_KEY") or os.getenv("GMAIL_ENCRYPTION_KEY")
        if not key:
            raise ValueError(
                "ENCRYPTION_KEY (or GMAIL_ENCRYPTION_KEY) environment variable is not set. "
                'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a plaintext string and return a base64-url-encoded ciphertext."""
        encrypted = self._fernet.encrypt(plaintext.encode("utf-8"))
        return base64.urlsafe_b64encode(encrypted).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a base64-url-encoded ciphertext and return the original plaintext."""
        raw = base64.urlsafe_b64decode(ciphertext.encode("utf-8"))
        return self._fernet.decrypt(raw).decode("utf-8")
