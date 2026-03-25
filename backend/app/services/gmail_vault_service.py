"""
Gmail-to-Vault indexing -- fetches email threads from Gmail,
summarises them via Haiku, and writes markdown files to the vault repo.
"""

import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

VAULT_REPO_DIR = Path(__file__).parent.parent.parent / "data" / "vault-repo"
GMAIL_VAULT_DIR = VAULT_REPO_DIR / "gmail"
THREAD_BODY_LIMIT = 3000  # chars sent to Haiku per thread
BATCH_SIZE = 20  # threads per git push
MAX_THREADS_PER_SYNC = 50  # max threads processed per scheduler run (avoids timeouts)


class GmailVaultService:
    """Indexes Gmail threads as summarised markdown in the Obsidian vault."""

    def __init__(self) -> None:
        from app.services.encryption_service import EncryptionService

        self._encryption = EncryptionService()

    # ------------------------------------------------------------------
    # Public methods
    # ------------------------------------------------------------------

    def backfill(self, db: Session, user_id: int, months: int = 6) -> dict[str, Any]:
        """One-time backfill: fetch all threads from the past N months, summarise, push to vault.

        Loops through ALL Gmail accounts for the user.
        Tracks progress via gmail_backfill_status on JojiAISettings.
        """
        self._set_backfill_status(db, user_id, "in_progress")

        try:
            accounts = self._get_all_gmail_accounts(db, user_id)
            if not accounts:
                self._set_backfill_status(db, user_id, "failed", error="No Gmail accounts connected")
                return {"status": "failed", "error": "No Gmail accounts connected"}

            cutoff = datetime.utcnow() - timedelta(days=months * 30)
            query = f"after:{cutoff.strftime('%Y/%m/%d')}"

            total_indexed = 0
            total_skipped = 0
            GMAIL_VAULT_DIR.mkdir(parents=True, exist_ok=True)

            for gmail_service, user_email in accounts:
                logger.info("Gmail vault backfill: processing %s", user_email)
                thread_ids = self._fetch_thread_ids(gmail_service, query)
                logger.info("Gmail vault backfill: found %d threads for %s", len(thread_ids), user_email)

                for i, tid in enumerate(thread_ids):
                    try:
                        md = self._process_thread(gmail_service, tid, user_email)
                        if md is None:
                            total_skipped += 1
                            continue

                        dest = GMAIL_VAULT_DIR / f"{tid}.md"
                        dest.write_text(md, encoding="utf-8")
                        total_indexed += 1

                        if total_indexed % BATCH_SIZE == 0:
                            self._push_to_vault(db)
                            logger.info(
                                "Gmail vault backfill: pushed batch %d (%s, %d/%d)",
                                total_indexed // BATCH_SIZE,
                                user_email,
                                i + 1,
                                len(thread_ids),
                            )

                    except Exception as exc:
                        logger.warning("Failed to process thread %s: %s", tid, exc)
                        total_skipped += 1

            # Final push
            if total_indexed % BATCH_SIZE != 0:
                self._push_to_vault(db)

            self._update_sync_timestamp(db, user_id)
            self._set_backfill_status(db, user_id, "success", threads=total_indexed)

            return {"status": "success", "threads_indexed": total_indexed, "threads_skipped": total_skipped}

        except Exception as exc:
            logger.exception("Gmail vault backfill failed for user %d", user_id)
            self._set_backfill_status(db, user_id, "failed", error=str(exc)[:500])
            return {"status": "failed", "error": str(exc)}

    def _set_backfill_status(
        self, db: Session, user_id: int, status: str,
        threads: int | None = None, error: str | None = None
    ) -> None:
        """Update gmail_backfill_status on JojiAISettings."""
        from app.models.joji_ai import JojiAISettings
        try:
            settings = db.query(JojiAISettings).filter(JojiAISettings.user_id == user_id).first()
            if settings:
                settings.gmail_backfill_status = status
                settings.gmail_backfill_threads = threads
                settings.gmail_backfill_error = error
                db.commit()
        except Exception:
            logger.warning("Failed to update backfill status to %s", status)

    def incremental_sync(self, db: Session, user_id: int) -> dict[str, Any]:
        """Sync threads modified since last sync. Loops through ALL accounts.

        If never synced before, uses 6-month lookback (acts as backfill).
        Processes max MAX_THREADS_PER_SYNC threads per run to avoid timeouts.
        The scheduler calls this every 30 min, so large inboxes get
        indexed gradually across multiple runs.
        """
        accounts = self._get_all_gmail_accounts(db, user_id)
        if not accounts:
            return {"status": "skipped", "reason": "Gmail not connected"}

        from app.models.joji_ai import JojiAISettings

        settings = db.query(JojiAISettings).filter(JojiAISettings.user_id == user_id).first()

        last_sync = None
        if settings and hasattr(settings, "last_gmail_vault_sync_at"):
            last_sync = settings.last_gmail_vault_sync_at

        # If never synced, go back 6 months (automatic backfill)
        if not last_sync:
            last_sync = datetime.utcnow() - timedelta(days=180)
            logger.info("Gmail vault: first sync for user %d, backfilling 6 months", user_id)

        query = f"after:{last_sync.strftime('%Y/%m/%d')}"

        GMAIL_VAULT_DIR.mkdir(parents=True, exist_ok=True)
        total_indexed = 0
        total_skipped = 0

        for gmail_service, user_email in accounts:
            thread_ids = self._fetch_thread_ids(gmail_service, query)

            # Skip threads we already have
            new_thread_ids = [
                tid for tid in thread_ids
                if not (GMAIL_VAULT_DIR / f"{tid}.md").exists()
            ]

            if not new_thread_ids:
                continue

            # Process max batch per run to avoid timeouts
            batch = new_thread_ids[:MAX_THREADS_PER_SYNC]
            logger.info(
                "Gmail vault sync: %d new threads for %s (processing %d this run)",
                len(new_thread_ids), user_email, len(batch)
            )

            for tid in batch:
                try:
                    md = self._process_thread(gmail_service, tid, user_email)
                    if md is None:
                        total_skipped += 1
                        continue
                    dest = GMAIL_VAULT_DIR / f"{tid}.md"
                    dest.write_text(md, encoding="utf-8")
                    total_indexed += 1
                except Exception as exc:
                    logger.warning("Failed to process thread %s: %s", tid, exc)
                    total_skipped += 1

        if total_indexed > 0:
            self._push_to_vault(db)

        self._update_sync_timestamp(db, user_id)

        # Update backfill status if it was in_progress
        if settings and settings.gmail_backfill_status in ("started", "in_progress"):
            self._set_backfill_status(db, user_id, "success", threads=total_indexed)

        return {"status": "success", "threads_indexed": total_indexed, "threads_skipped": total_skipped}

    # ------------------------------------------------------------------
    # Gmail API helpers
    # ------------------------------------------------------------------

    def _get_all_gmail_accounts(self, db: Session, user_id: int) -> list[tuple[Any, str]]:
        """Build Gmail API services for ALL connected accounts of a user.

        Returns list of (service, email_address) tuples.
        """
        from app.models.autoresearch import GmailToken
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        tokens = (
            db.query(GmailToken)
            .filter(GmailToken.user_id == user_id, GmailToken.is_active == True)
            .all()
        )

        accounts = []
        for token in tokens:
            try:
                refresh_token = self._encryption.decrypt(token.encrypted_refresh_token)
                creds = Credentials(
                    token=None,
                    refresh_token=refresh_token,
                    client_id=os.getenv("GOOGLE_CLIENT_ID"),
                    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
                    token_uri="https://oauth2.googleapis.com/token",
                )
                service = build("gmail", "v1", credentials=creds)
                accounts.append((service, token.email_address))
            except Exception as exc:
                logger.warning("Failed to build Gmail service for %s: %s", token.email_address, exc)

        return accounts

    def _build_gmail_service(self, db: Session, user_id: int) -> tuple[Any, Optional[str]]:
        """Build authenticated Gmail API service for a user (first account)."""
        accounts = self._get_all_gmail_accounts(db, user_id)
        if not accounts:
            return None, None
        return accounts[0]

    @staticmethod
    def _fetch_thread_ids(service: Any, query: str) -> list[str]:
        """Fetch all thread IDs matching a Gmail query."""
        thread_ids: list[str] = []
        page_token: Optional[str] = None
        while True:
            results = (
                service.users()
                .threads()
                .list(userId="me", q=query, maxResults=100, pageToken=page_token)
                .execute()
            )
            threads = results.get("threads", [])
            thread_ids.extend(t["id"] for t in threads)
            page_token = results.get("nextPageToken")
            if not page_token:
                break
        return thread_ids

    # ------------------------------------------------------------------
    # Thread processing
    # ------------------------------------------------------------------

    def _process_thread(self, service: Any, thread_id: str, user_email: str) -> Optional[str]:
        """Fetch a thread, summarise it, return markdown content. Returns None to skip."""
        thread = (
            service.users().threads().get(userId="me", id=thread_id, format="full").execute()
        )
        messages = thread.get("messages", [])
        if not messages:
            return None

        # Skip newsletters (check for List-Unsubscribe header on first message)
        if len(messages) == 1:
            headers = {
                h["name"].lower(): h["value"]
                for h in messages[0].get("payload", {}).get("headers", [])
            }
            if "list-unsubscribe" in headers:
                return None

        # Extract message data
        thread_messages: list[str] = []
        participants: set[str] = set()
        subject = ""
        first_date: Optional[datetime] = None
        last_date: Optional[datetime] = None

        for msg in messages:
            headers = {
                h["name"].lower(): h["value"]
                for h in msg.get("payload", {}).get("headers", [])
            }
            from_email = headers.get("from", "")
            to_email = headers.get("to", "")
            date_str = headers.get("date", "")
            if not subject:
                subject = headers.get("subject", "No Subject")

            from app.services.gmail_service import GmailService

            body = GmailService._extract_email_body(msg.get("payload", {}))
            msg_date = GmailService._parse_email_date(date_str) if date_str else datetime.utcnow()
            sender = GmailService._extract_email_address(from_email)

            if first_date is None or msg_date < first_date:
                first_date = msg_date
            if last_date is None or msg_date > last_date:
                last_date = msg_date

            participants.add(sender)
            if to_email:
                participants.add(GmailService._extract_email_address(to_email))

            role = "Joji" if sender.lower() == user_email.lower() else sender
            thread_messages.append(f"**{role}** ({msg_date.strftime('%Y-%m-%d')}):\n{body[:500]}")

        transcript = "\n\n---\n\n".join(thread_messages)

        # Summarise via Haiku
        summary = self._summarise_thread(subject, transcript[:THREAD_BODY_LIMIT], list(participants))
        if not summary:
            # Fallback: store raw metadata without summary
            summary = "_(Summary generation failed)_"

        # Build markdown
        md_lines = [
            f"# Email: {subject}",
            "",
            f"**Between:** {', '.join(sorted(participants))}",
            f"**Date:** {first_date.strftime('%Y-%m-%d') if first_date else 'Unknown'}"
            f" -- {last_date.strftime('%Y-%m-%d') if last_date else 'Unknown'}",
            f"**Thread ID:** {thread_id}",
            f"**Messages:** {len(messages)}",
            "",
            summary,
            "",
        ]
        return "\n".join(md_lines)

    # ------------------------------------------------------------------
    # Haiku summarisation
    # ------------------------------------------------------------------

    @staticmethod
    def _summarise_thread(
        subject: str, transcript: str, participants: list[str]
    ) -> Optional[str]:
        """Summarise an email thread via Claude Haiku."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return None

        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Summarise this email thread concisely. Extract:\n"
                            "1. What was discussed\n"
                            "2. Any decisions made\n"
                            "3. Action items or next steps\n"
                            "4. Key information about the people involved\n"
                            "\n"
                            f"Subject: {subject}\n"
                            f"Participants: {', '.join(participants)}\n"
                            "\n"
                            "Thread:\n"
                            f"{transcript}\n"
                            "\n"
                            "Format as:\n"
                            "## Summary\n"
                            "(2-3 sentence overview)\n"
                            "\n"
                            "## Key Points\n"
                            "- (bullet points)\n"
                        ),
                    }
                ],
            )
            return response.content[0].text if response.content else None
        except Exception as exc:
            logger.warning("Haiku thread summary failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Vault push helpers
    # ------------------------------------------------------------------

    def _push_to_vault(self, db: Session) -> None:
        """Push gmail/ files to the vault repo."""
        from app.models.joji_ai import JojiAISettings

        settings = (
            db.query(JojiAISettings).filter(JojiAISettings.github_repo_url.isnot(None)).first()
        )
        if not settings:
            return

        try:
            if not VAULT_REPO_DIR.exists() or not (VAULT_REPO_DIR / ".git").exists():
                logger.debug("Gmail vault sync: no vault repo cloned, skipping push")
                return

            import git

            repo = git.Repo(VAULT_REPO_DIR)

            # Stage only gmail/ files
            repo.git.add("gmail/")

            # Check if there are staged changes
            if not repo.is_dirty(index=True, untracked_files=True):
                logger.debug("Gmail vault sync: no changes to push")
                return

            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            repo.index.commit(f"Gmail vault sync: {timestamp}")

            try:
                repo.remotes.origin.push()
            except git.GitCommandError as push_err:
                logger.warning(
                    "Gmail vault sync push failed, attempting pull --rebase: %s", push_err
                )
                try:
                    repo.remotes.origin.pull(rebase=True)
                    repo.remotes.origin.push()
                except git.GitCommandError as rebase_err:
                    logger.error(
                        "Gmail vault sync pull-rebase failed, skipping push: %s", rebase_err
                    )

        except Exception:
            logger.exception("Gmail vault sync: git push failed")

    def _update_sync_timestamp(self, db: Session, user_id: int) -> None:
        """Update last_gmail_vault_sync_at on JojiAISettings."""
        from app.models.joji_ai import JojiAISettings

        settings = db.query(JojiAISettings).filter(JojiAISettings.user_id == user_id).first()
        if settings:
            settings.last_gmail_vault_sync_at = datetime.utcnow()
            db.commit()
