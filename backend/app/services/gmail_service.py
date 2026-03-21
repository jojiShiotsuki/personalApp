"""
Gmail OAuth service for inbox polling, reply classification, and sending emails.

Handles Google OAuth flow, encrypts refresh tokens, polls for new messages,
matches them to known outreach prospects, classifies inbound replies using
Claude Haiku, and sends outbound emails via the Gmail API.
"""

import asyncio
import json
import logging
import os
import re
import base64
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr
from typing import Any, Optional

from cryptography.fernet import Fernet
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from anthropic import AsyncAnthropic
from sqlalchemy.orm import Session

from app.models.autoresearch import GmailToken, EmailMatch, Experiment
from app.models.outreach import OutreachProspect, ProspectStatus

logger = logging.getLogger(__name__)

# Haiku pricing: $0.25 per 1M input tokens, $1.25 per 1M output tokens
HAIKU_INPUT_PRICE_PER_M = 0.25
HAIKU_OUTPUT_PRICE_PER_M = 1.25

CLASSIFICATION_SYSTEM_PROMPT = (
    "Classify this cold email reply. Return JSON with: "
    "sentiment (positive/neutral/negative), "
    "category (interested/curious/not_interested/stop/out_of_office/bounce), "
    "wants_loom (bool), "
    "wants_call (bool), "
    "forwarded_internally (bool), "
    "key_quote (string, 1 sentence), "
    "suggested_action (string)"
)


class GmailService:
    """Manages Gmail OAuth, inbox polling, prospect matching, and reply classification."""

    def __init__(self) -> None:
        # Encryption key for storing refresh tokens
        encryption_key = os.getenv("GMAIL_ENCRYPTION_KEY")
        if not encryption_key:
            raise ValueError(
                "GMAIL_ENCRYPTION_KEY environment variable is not set. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)

        # Anthropic client for Haiku classification
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        self.anthropic_client = AsyncAnthropic(api_key=anthropic_key)

        # Google OAuth credentials
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        if not self.google_client_id or not self.google_client_secret:
            raise ValueError(
                "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required"
            )

        self.scopes = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
        ]

    # ──────────────────────────────────────────────
    # OAuth Flow
    # ──────────────────────────────────────────────

    def _build_client_config(self) -> dict[str, Any]:
        """Build the client config dict for Google OAuth Flow."""
        return {
            "web": {
                "client_id": self.google_client_id,
                "client_secret": self.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }

    def get_auth_url(self, redirect_uri: str) -> tuple[str, str, str]:
        """
        Generate a Google OAuth authorization URL.

        Returns:
            (auth_url, state, code_verifier) tuple.
        """
        state = os.urandom(16).hex()

        flow = Flow.from_client_config(
            client_config=self._build_client_config(),
            scopes=self.scopes,
            state=state,
        )
        flow.redirect_uri = redirect_uri

        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
        )

        # Store code_verifier for PKCE — needed in handle_callback
        code_verifier = flow.code_verifier

        return (auth_url, state, code_verifier)

    def handle_callback(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> dict[str, str]:
        """
        Exchange the authorization code for tokens and retrieve the user's email.

        Returns:
            {"email": "user@example.com", "refresh_token": "..."}
        """
        flow = Flow.from_client_config(
            client_config=self._build_client_config(),
            scopes=self.scopes,
        )
        flow.redirect_uri = redirect_uri
        if code_verifier:
            flow.code_verifier = code_verifier
        flow.fetch_token(code=code)

        credentials = flow.credentials
        refresh_token = credentials.refresh_token

        # Build Gmail service to get user email
        service = build("gmail", "v1", credentials=credentials)
        profile = service.users().getProfile(userId="me").execute()
        email_address = profile.get("emailAddress", "")

        return {
            "email": email_address,
            "refresh_token": refresh_token,
        }

    # ──────────────────────────────────────────────
    # Token Encryption
    # ──────────────────────────────────────────────

    def encrypt_token(self, token: str) -> str:
        """Encrypt a refresh token for database storage."""
        encrypted = self.cipher.encrypt(token.encode("utf-8"))
        return base64.urlsafe_b64encode(encrypted).decode("utf-8")

    def decrypt_token(self, encrypted: str) -> str:
        """Decrypt a stored refresh token."""
        raw = base64.urlsafe_b64decode(encrypted.encode("utf-8"))
        return self.cipher.decrypt(raw).decode("utf-8")

    # ──────────────────────────────────────────────
    # Send Email
    # ──────────────────────────────────────────────

    async def send_email(
        self,
        db: Session,
        user_id: int,
        to_email: str,
        subject: str,
        body: str,
        tracking_pixel_html: str | None = None,
    ) -> dict[str, Any]:
        """
        Send an email via the Gmail API.

        Builds a multipart/alternative message with plain text and HTML
        (for tracking pixel support). Uses asyncio.to_thread to avoid
        blocking the event loop with the synchronous Google API client.

        Returns:
            {"message_id": "...", "thread_id": "...", "to": "...", "subject": "..."}
        """
        gmail_token = (
            db.query(GmailToken)
            .filter(GmailToken.user_id == user_id, GmailToken.is_active == True)
            .first()
        )
        if not gmail_token:
            raise ValueError("No active Gmail token found for this user")

        refresh_token = self.decrypt_token(gmail_token.encrypted_refresh_token)
        credentials = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.google_client_id,
            client_secret=self.google_client_secret,
            scopes=self.scopes,
        )
        service = build("gmail", "v1", credentials=credentials)

        # Build multipart/alternative email (plain text + HTML for tracking pixel)
        msg = MIMEMultipart("alternative")
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["From"] = gmail_token.email_address

        # Plain text version
        msg.attach(MIMEText(body, "plain"))

        # HTML version (preserves line breaks + appends tracking pixel)
        html_body = body.replace("\n", "<br>")
        if tracking_pixel_html:
            html_body += tracking_pixel_html
        msg.attach(MIMEText(html_body, "html"))

        # Encode and send (wrap synchronous call in a thread)
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

        def _send() -> dict[str, Any]:
            return service.users().messages().send(
                userId="me", body={"raw": raw}
            ).execute()

        sent = await asyncio.to_thread(_send)

        logger.info(
            "Email sent via Gmail to %s (message_id=%s)",
            to_email,
            sent.get("id"),
        )

        return {
            "message_id": sent.get("id"),
            "thread_id": sent.get("threadId"),
            "to": to_email,
            "subject": subject,
        }

    # ──────────────────────────────────────────────
    # Inbox Polling
    # ──────────────────────────────────────────────

    async def poll_inbox(self, db: Session, user_id: int) -> dict[str, Any]:
        """
        Poll Gmail inbox for new messages, match to prospects, and classify replies.

        Returns:
            {"new_replies": N, "new_sent_matches": N, "errors": [...]}
        """
        result: dict[str, Any] = {"new_replies": 0, "new_sent_matches": 0, "errors": []}

        # Get the user's Gmail token
        gmail_token = (
            db.query(GmailToken)
            .filter(GmailToken.user_id == user_id, GmailToken.is_active == True)
            .first()
        )
        if not gmail_token:
            result["errors"].append("No active Gmail token found for user")
            return result

        # Build Gmail service from stored refresh token
        try:
            refresh_token = self.decrypt_token(gmail_token.encrypted_refresh_token)
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.google_client_id,
                client_secret=self.google_client_secret,
                scopes=self.scopes,
            )
            service = build("gmail", "v1", credentials=credentials)
        except Exception as exc:
            logger.error("Failed to build Gmail service for user %d: %s", user_id, exc)
            gmail_token.is_active = False
            db.commit()
            result["errors"].append(f"Token expired or revoked: {exc}")
            return result

        # Build date query for message search
        if gmail_token.last_poll_at:
            after_date = gmail_token.last_poll_at.strftime("%Y/%m/%d")
        else:
            after_date = (datetime.utcnow() - timedelta(hours=24)).strftime("%Y/%m/%d")

        user_email = gmail_token.email_address

        # Fetch messages from inbox and sent
        try:
            messages = self._list_messages(service, f"after:{after_date}")
        except Exception as exc:
            logger.error("Failed to list Gmail messages for user %d: %s", user_id, exc)
            # Check if it's an auth error
            if "invalid_grant" in str(exc).lower() or "token" in str(exc).lower():
                gmail_token.is_active = False
                db.commit()
            result["errors"].append(f"Gmail API error: {exc}")
            return result

        # Load all known prospect emails for matching
        prospect_emails = (
            db.query(OutreachProspect)
            .filter(OutreachProspect.email.isnot(None))
            .all()
        )
        prospect_by_email: dict[str, OutreachProspect] = {
            p.email.lower(): p for p in prospect_emails if p.email
        }

        # Process each message
        for msg_stub in messages:
            msg_id = msg_stub["id"]

            # Skip if we already have this message
            existing = (
                db.query(EmailMatch)
                .filter(EmailMatch.gmail_message_id == msg_id)
                .first()
            )
            if existing:
                continue

            try:
                msg_data = service.users().messages().get(
                    userId="me", id=msg_id, format="full"
                ).execute()
            except Exception as exc:
                logger.warning("Failed to fetch message %s: %s", msg_id, exc)
                result["errors"].append(f"Failed to fetch message {msg_id}: {exc}")
                continue

            # Extract headers
            headers = {
                h["name"].lower(): h["value"]
                for h in msg_data.get("payload", {}).get("headers", [])
            }
            from_header = headers.get("from", "")
            to_header = headers.get("to", "")
            subject = headers.get("subject", "")
            date_str = headers.get("date", "")

            from_email = self._extract_email_address(from_header)
            to_email = self._extract_email_address(to_header)

            # Parse received date
            received_at = self._parse_email_date(date_str)

            # Determine direction
            is_outbound = from_email.lower() == user_email.lower()
            direction = "outbound" if is_outbound else "inbound"

            # Find matching prospect
            match_email = to_email.lower() if is_outbound else from_email.lower()
            prospect = prospect_by_email.get(match_email)

            if not prospect:
                # Check for bounces even if no prospect match (from mailer-daemon)
                bounce_senders = ["mailer-daemon", "postmaster", "mail delivery"]
                if any(b in from_email.lower() for b in bounce_senders):
                    # Try to find the bounced recipient in the body
                    body_text = self._extract_email_body(msg_data.get("payload", {}))
                    for email_addr, p in prospect_by_email.items():
                        if email_addr in (body_text or "").lower():
                            # Found the bounced prospect
                            bounce_exp = (
                                db.query(Experiment)
                                .filter(Experiment.prospect_id == p.id)
                                .order_by(Experiment.sent_at.desc())
                                .first()
                            )
                            if bounce_exp:
                                bounce_exp.status = "bounced"
                                bounce_exp.replied = False
                                logger.info("Detected bounce for prospect %d (%s)", p.id, email_addr)
                                result["new_replies"] += 1
                            break
                continue

            # Extract body text
            body_text = self._extract_email_body(msg_data.get("payload", {}))

            if direction == "inbound":
                # Classify the reply with Claude Haiku
                classification: dict[str, Any] = {}
                try:
                    classification = await self.classify_reply(body_text)
                except Exception as exc:
                    logger.warning("Classification failed for message %s: %s", msg_id, exc)
                    result["errors"].append(f"Classification failed for {msg_id}: {exc}")

                # Create EmailMatch record
                email_match = EmailMatch(
                    prospect_id=prospect.id,
                    gmail_message_id=msg_id,
                    direction="inbound",
                    from_email=from_email,
                    to_email=to_email,
                    subject=subject,
                    body_text=body_text[:5000] if body_text else None,
                    received_at=received_at,
                    sentiment=classification.get("sentiment"),
                    category=classification.get("category"),
                    wants_loom=classification.get("wants_loom"),
                    wants_call=classification.get("wants_call"),
                    forwarded_internally=classification.get("forwarded_internally"),
                    key_quote=classification.get("key_quote"),
                    suggested_action=classification.get("suggested_action"),
                    classification_cost=classification.get("classification_cost"),
                )

                # Find linked experiment (most recent sent OR replied experiment for this prospect)
                # Check "sent" first, fall back to "replied" for multi-reply threads
                experiment = (
                    db.query(Experiment)
                    .filter(
                        Experiment.prospect_id == prospect.id,
                        Experiment.status == "sent",
                    )
                    .order_by(Experiment.sent_at.desc())
                    .first()
                )
                if not experiment:
                    # Multi-reply: prospect already replied before, update the latest replied experiment
                    experiment = (
                        db.query(Experiment)
                        .filter(
                            Experiment.prospect_id == prospect.id,
                            Experiment.status == "replied",
                        )
                        .order_by(Experiment.reply_at.desc())
                        .first()
                    )
                if experiment:
                    email_match.experiment_id = experiment.id

                    # Update experiment with reply data
                    experiment.status = "replied"
                    experiment.replied = True
                    experiment.reply_at = received_at
                    experiment.sentiment = classification.get("sentiment")
                    experiment.category = classification.get("category")
                    experiment.forwarded_internally = classification.get("forwarded_internally")
                    experiment.full_reply_text = body_text[:5000] if body_text else None

                    # Calculate response time in minutes
                    if experiment.sent_at and received_at:
                        delta = received_at - experiment.sent_at
                        experiment.response_time_minutes = int(delta.total_seconds() / 60)

                db.add(email_match)

                # Update prospect status based on classification
                sentiment = classification.get("sentiment")
                category = classification.get("category")
                if category == "stop" or category == "not_interested":
                    prospect.status = ProspectStatus.NOT_INTERESTED
                elif category in ("interested", "curious"):
                    prospect.status = ProspectStatus.REPLIED
                elif sentiment:
                    prospect.status = ProspectStatus.REPLIED

                result["new_replies"] += 1

            elif direction == "outbound":
                # Outbound message — track sent email
                email_match = EmailMatch(
                    prospect_id=prospect.id,
                    gmail_message_id=msg_id,
                    direction="outbound",
                    from_email=from_email,
                    to_email=to_email,
                    subject=subject,
                    body_text=body_text[:5000] if body_text else None,
                    received_at=received_at,
                )

                # Find linked experiment in draft status
                experiment = (
                    db.query(Experiment)
                    .filter(
                        Experiment.prospect_id == prospect.id,
                        Experiment.status == "draft",
                    )
                    .order_by(Experiment.created_at.desc())
                    .first()
                )
                if experiment:
                    email_match.experiment_id = experiment.id
                    experiment.status = "sent"
                    experiment.sent_at = received_at
                    experiment.day_of_week = received_at.strftime("%A") if received_at else None
                    experiment.sent_hour = received_at.hour if received_at else None

                    # Compare actual sent content vs what was tracked at copy time
                    if body_text and experiment.body:
                        actual_body = body_text[:2000].strip()
                        tracked_body = experiment.body[:2000].strip()
                        if actual_body != tracked_body:
                            # User edited after copying — capture the real version
                            experiment.was_edited = True
                            experiment.edit_type = "post_copy_edit"
                            experiment.body = actual_body
                            experiment.word_count = len(actual_body.split())
                            logger.info(
                                "Detected post-copy edit for prospect %d (experiment %d)",
                                prospect.id, experiment.id,
                            )

                db.add(email_match)
                result["new_sent_matches"] += 1

        # Update last poll timestamp
        gmail_token.last_poll_at = datetime.utcnow()
        db.commit()

        logger.info(
            "Gmail poll complete for user %d: %d replies, %d sent matches",
            user_id,
            result["new_replies"],
            result["new_sent_matches"],
        )
        return result

    # ──────────────────────────────────────────────
    # Reply Classification
    # ──────────────────────────────────────────────

    async def classify_reply(self, text: str) -> dict[str, Any]:
        """
        Classify a cold email reply using Claude Haiku.

        Returns a dict with sentiment, category, wants_loom, wants_call,
        forwarded_internally, key_quote, suggested_action, and classification_cost.
        """
        if not text or not text.strip():
            return {
                "sentiment": None,
                "category": None,
                "classification_cost": 0.0,
            }

        # Truncate very long replies
        truncated = text[:3000]

        model = os.getenv("AUTORESEARCH_CLASSIFIER_MODEL", "claude-haiku-4-5")

        try:
            response = await self.anthropic_client.messages.create(
                model=model,
                max_tokens=300,
                system=CLASSIFICATION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": truncated}],
            )
        except Exception as exc:
            logger.error("Haiku classification API error: %s", exc)
            return {
                "sentiment": None,
                "category": None,
                "classification_cost": 0.0,
                "error": str(exc),
            }

        # Extract response text
        raw_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_text += block.text

        # Parse JSON from response
        classification = self._parse_classification_json(raw_text)

        # Calculate cost
        input_tokens = getattr(response.usage, "input_tokens", 0)
        output_tokens = getattr(response.usage, "output_tokens", 0)
        cost_usd = (
            (input_tokens * HAIKU_INPUT_PRICE_PER_M / 1_000_000)
            + (output_tokens * HAIKU_OUTPUT_PRICE_PER_M / 1_000_000)
        )
        classification["classification_cost"] = round(cost_usd, 6)

        return classification

    @staticmethod
    def _parse_classification_json(raw_text: str) -> dict[str, Any]:
        """Parse JSON from Claude's classification response."""
        text = raw_text.strip()

        # Strip markdown code fences
        fence_pattern = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)
        match = fence_pattern.search(text)
        if match:
            text = match.group(1).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse classification JSON: %s", exc)
            logger.debug("Raw classification text: %s", raw_text[:500])
            return {
                "sentiment": None,
                "category": None,
                "error": f"JSON parse error: {exc}",
            }

    # ──────────────────────────────────────────────
    # Gmail API Helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _list_messages(service: Any, query: str) -> list[dict[str, Any]]:
        """
        List all messages matching the query, handling pagination.

        Returns a list of message stubs with at least an "id" field.
        """
        messages: list[dict[str, Any]] = []
        page_token: Optional[str] = None

        while True:
            kwargs: dict[str, Any] = {"userId": "me", "q": query, "maxResults": 100}
            if page_token:
                kwargs["pageToken"] = page_token

            response = service.users().messages().list(**kwargs).execute()
            batch = response.get("messages", [])
            messages.extend(batch)

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return messages

    @staticmethod
    def _extract_email_body(payload: dict[str, Any]) -> str:
        """
        Walk the MIME tree of a Gmail message payload and extract plain text.

        Strips quoted reply text (lines starting with ">") and returns the
        first 2000 characters of the clean body.
        """
        parts_to_check: list[dict[str, Any]] = []

        # Collect all parts from the MIME tree
        if "parts" in payload:
            stack = list(payload["parts"])
            while stack:
                part = stack.pop()
                parts_to_check.append(part)
                if "parts" in part:
                    stack.extend(part["parts"])
        else:
            # Single-part message
            parts_to_check.append(payload)

        # Find text/plain part
        body_text = ""
        for part in parts_to_check:
            mime_type = part.get("mimeType", "")
            if mime_type == "text/plain":
                data = part.get("body", {}).get("data", "")
                if data:
                    try:
                        decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                        body_text = decoded
                        break
                    except Exception as exc:
                        logger.debug("Failed to decode message body part: %s", exc)

        # If no text/plain found, try text/html as fallback (strip tags)
        if not body_text:
            for part in parts_to_check:
                mime_type = part.get("mimeType", "")
                if mime_type == "text/html":
                    data = part.get("body", {}).get("data", "")
                    if data:
                        try:
                            decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                            # Basic HTML tag stripping
                            body_text = re.sub(r"<[^>]+>", " ", decoded)
                            body_text = re.sub(r"\s+", " ", body_text).strip()
                            break
                        except Exception as exc:
                            logger.debug("Failed to decode HTML body part: %s", exc)

        # Strip quoted reply lines (lines starting with ">")
        lines = body_text.split("\n")
        clean_lines = [line for line in lines if not line.strip().startswith(">")]
        clean_text = "\n".join(clean_lines).strip()

        # Also strip common reply headers like "On Mon, Jan 1, ... wrote:"
        reply_header_pattern = re.compile(
            r"^On .+wrote:\s*$", re.MULTILINE | re.IGNORECASE
        )
        clean_text = reply_header_pattern.split(clean_text)[0].strip()

        return clean_text[:2000]

    @staticmethod
    def _extract_email_address(header_value: str) -> str:
        """
        Parse an email address from a header like "Name <email@example.com>".

        Returns just the email address portion.
        """
        if not header_value:
            return ""

        # Use Python's email.utils.parseaddr for robust parsing
        _, email_addr = parseaddr(header_value)
        return email_addr if email_addr else header_value.strip()

    @staticmethod
    def _parse_email_date(date_str: str) -> datetime:
        """
        Parse an email Date header into a datetime object.

        Falls back to utcnow() if parsing fails.
        """
        if not date_str:
            return datetime.utcnow()

        # Common email date formats
        formats = [
            "%a, %d %b %Y %H:%M:%S %z",
            "%d %b %Y %H:%M:%S %z",
            "%a, %d %b %Y %H:%M:%S %Z",
            "%d %b %Y %H:%M:%S %Z",
        ]

        # Strip parenthetical timezone names like "(UTC)" or "(PST)"
        cleaned = re.sub(r"\s*\([^)]*\)\s*$", "", date_str.strip())

        for fmt in formats:
            try:
                parsed = datetime.strptime(cleaned, fmt)
                # Convert to naive UTC
                return parsed.replace(tzinfo=None)
            except ValueError:
                continue

        logger.debug("Could not parse email date: %s", date_str)
        return datetime.utcnow()
