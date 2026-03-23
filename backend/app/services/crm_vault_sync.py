"""
CRM-to-Vault auto-sync -- generates markdown files from CRM data
and pushes them to the crm-sync/ folder in the Obsidian vault GitHub repo.
"""

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.autoresearch import Insight
from app.models.crm import Contact, Deal, Interaction
from app.models.joji_ai import JojiAISettings
from app.services.encryption_service import EncryptionService

logger = logging.getLogger(__name__)

# Same directory as VaultSyncService
VAULT_REPO_DIR = Path(__file__).parent.parent.parent / "data" / "vault-repo"

# Subfolder within the vault repo for CRM-generated files
CRM_SYNC_DIR = VAULT_REPO_DIR / "crm-sync"


class CRMVaultSync:
    """Generates markdown from CRM data and pushes to vault GitHub repo."""

    def __init__(self) -> None:
        self._encryption = EncryptionService()

    # ------------------------------------------------------------------
    # Public sync methods
    # ------------------------------------------------------------------

    def sync_contact(self, db: Session, contact_id: int) -> None:
        """Generate markdown for a contact and push to the vault repo.

        Includes the contact's deals and last 10 interactions.
        """
        try:
            settings = self._get_settings(db)
            if settings is None:
                return

            contact = db.query(Contact).filter(Contact.id == contact_id).first()
            if not contact:
                logger.warning("CRM vault sync: contact %d not found", contact_id)
                return

            # Eager-load deals
            deals = (
                db.query(Deal)
                .filter(Deal.contact_id == contact_id)
                .order_by(Deal.created_at.desc())
                .all()
            )

            # Last 10 interactions
            interactions = (
                db.query(Interaction)
                .filter(Interaction.contact_id == contact_id)
                .order_by(Interaction.interaction_date.desc())
                .limit(10)
                .all()
            )

            md = self._render_contact_markdown(contact, deals, interactions)

            filename = self._sanitize_filename(contact.name)
            dest = CRM_SYNC_DIR / "contacts" / f"{filename}.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(md, encoding="utf-8")

            self._push_changes(settings)

        except Exception:
            logger.exception("CRM vault sync failed for contact %d", contact_id)

    def sync_deal(self, db: Session, deal_id: int) -> None:
        """Generate markdown for a deal and push to the vault repo."""
        try:
            settings = self._get_settings(db)
            if settings is None:
                return

            deal = db.query(Deal).filter(Deal.id == deal_id).first()
            if not deal:
                logger.warning("CRM vault sync: deal %d not found", deal_id)
                return

            contact = (
                db.query(Contact).filter(Contact.id == deal.contact_id).first()
            )

            md = self._render_deal_markdown(deal, contact)

            filename = self._sanitize_filename(deal.title)
            dest = CRM_SYNC_DIR / "deals" / f"{filename}.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(md, encoding="utf-8")

            self._push_changes(settings)

        except Exception:
            logger.exception("CRM vault sync failed for deal %d", deal_id)

    def sync_outreach_insights(self, db: Session) -> None:
        """Generate a markdown summary of active outreach insights."""
        try:
            settings = self._get_settings(db)
            if settings is None:
                return

            insights = (
                db.query(Insight)
                .filter(Insight.is_active.is_(True))
                .order_by(Insight.created_at.desc())
                .all()
            )

            md = self._render_insights_markdown(insights)

            dest = CRM_SYNC_DIR / "outreach" / "insights.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(md, encoding="utf-8")

            self._push_changes(settings)

        except Exception:
            logger.exception("CRM vault sync failed for outreach insights")

    # ------------------------------------------------------------------
    # Markdown renderers
    # ------------------------------------------------------------------

    @staticmethod
    def _render_contact_markdown(
        contact: Contact,
        deals: list[Deal],
        interactions: list[Interaction],
    ) -> str:
        lines: list[str] = []
        lines.append(f"# {contact.name}")
        lines.append("")
        lines.append(f"**Email:** {contact.email or 'N/A'}")
        lines.append(f"**Phone:** {contact.phone or 'N/A'}")
        lines.append(f"**Company:** {contact.company or 'N/A'}")
        lines.append(f"**Status:** {contact.status.value if contact.status else 'N/A'}")
        if contact.industry:
            lines.append(f"**Industry:** {contact.industry}")
        if contact.city:
            lines.append(f"**City:** {contact.city}")
        if contact.website_url:
            lines.append(f"**Website:** {contact.website_url}")
        lines.append("")

        # Deals section
        lines.append("## Deals")
        lines.append("")
        if deals:
            for deal in deals:
                value_str = f"${deal.value:,.2f}" if deal.value else "N/A"
                stage_str = deal.stage.value if deal.stage else "N/A"
                lines.append(f"- {deal.title} -- {stage_str} -- {value_str}")
        else:
            lines.append("_No deals yet._")
        lines.append("")

        # Recent interactions section
        lines.append("## Recent Interactions")
        lines.append("")
        if interactions:
            for ix in interactions:
                date_str = ix.interaction_date.strftime("%Y-%m-%d") if ix.interaction_date else "N/A"
                type_str = ix.type.value if ix.type else "N/A"
                notes_str = (ix.notes or "").replace("\n", " ").strip()
                if len(notes_str) > 200:
                    notes_str = notes_str[:200] + "..."
                lines.append(f"- {date_str}: {type_str} -- {notes_str}")
        else:
            lines.append("_No interactions yet._")
        lines.append("")

        # Notes section
        lines.append("## Notes")
        lines.append("")
        lines.append(contact.notes if contact.notes else "_No notes._")
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _render_deal_markdown(deal: Deal, contact: Optional[Contact]) -> str:
        lines: list[str] = []
        lines.append(f"# {deal.title}")
        lines.append("")

        value_str = f"${deal.value:,.2f}" if deal.value else "N/A"
        stage_str = deal.stage.value if deal.stage else "N/A"
        contact_name = contact.name if contact else "Unknown"

        lines.append(f"**Value:** {value_str}")
        lines.append(f"**Stage:** {stage_str}")
        lines.append(f"**Contact:** {contact_name}")
        lines.append(f"**Probability:** {deal.probability}%")
        if deal.expected_close_date:
            lines.append(f"**Expected Close:** {deal.expected_close_date}")
        if deal.actual_close_date:
            lines.append(f"**Actual Close:** {deal.actual_close_date}")
        if deal.is_recurring:
            freq = deal.billing_frequency.value if deal.billing_frequency else "N/A"
            recurring_amt = f"${deal.recurring_amount:,.2f}" if deal.recurring_amount else "N/A"
            lines.append(f"**Recurring:** {freq} -- {recurring_amt}")
            if deal.service_status:
                lines.append(f"**Service Status:** {deal.service_status.value}")
        lines.append("")

        lines.append("## Notes")
        lines.append("")
        lines.append(deal.description if deal.description else "_No notes._")
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _render_insights_markdown(insights: list[Insight]) -> str:
        lines: list[str] = []
        lines.append("# Outreach Insights")
        lines.append("")
        lines.append(f"_Last updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_")
        lines.append("")

        if not insights:
            lines.append("_No active insights yet._")
            lines.append("")
            return "\n".join(lines)

        # Group by confidence
        by_confidence: dict[str, list[Insight]] = {}
        for ins in insights:
            conf = ins.confidence or "unknown"
            by_confidence.setdefault(conf, []).append(ins)

        for conf in ("high", "medium", "low", "unknown"):
            group = by_confidence.get(conf, [])
            if not group:
                continue
            lines.append(f"## {conf.capitalize()} Confidence ({len(group)})")
            lines.append("")
            for ins in group:
                lines.append(f"### {ins.insight[:80]}")
                lines.append("")
                lines.append(f"- **Sample size:** {ins.sample_size}")
                lines.append(f"- **Applies to:** {ins.applies_to or 'all niches'}")
                if ins.recommendation:
                    lines.append(f"- **Recommendation:** {ins.recommendation}")
                lines.append("")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Git push helper
    # ------------------------------------------------------------------

    def _push_changes(self, settings: JojiAISettings) -> None:
        """Add, commit, and push changes in the crm-sync/ folder.

        If the vault repo is not cloned yet, skip silently.
        If push fails due to conflict, force-push the crm-sync path.
        """
        try:
            if not VAULT_REPO_DIR.exists() or not (VAULT_REPO_DIR / ".git").exists():
                logger.debug("CRM vault sync: no vault repo cloned, skipping push")
                return

            import git

            repo = git.Repo(VAULT_REPO_DIR)

            # Stage only crm-sync/ files
            repo.git.add("crm-sync/")

            # Check if there are staged changes
            if not repo.is_dirty(index=True, untracked_files=True):
                logger.debug("CRM vault sync: no changes to push")
                return

            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            repo.index.commit(f"CRM sync: {timestamp}")

            try:
                repo.remotes.origin.push()
            except git.GitCommandError as push_err:
                logger.warning("CRM vault sync push failed, attempting force push for crm-sync: %s", push_err)
                try:
                    repo.remotes.origin.push(force=True)
                except git.GitCommandError as force_err:
                    logger.error("CRM vault sync force push also failed: %s", force_err)

        except Exception:
            logger.exception("CRM vault sync: git push failed")

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Convert a name to a safe lowercase filename.

        Replaces spaces with hyphens, removes special characters,
        and truncates to 100 characters.
        """
        if not name:
            return "unnamed"
        # Lowercase and replace spaces/underscores with hyphens
        sanitized = name.lower().strip()
        sanitized = re.sub(r"[\s_]+", "-", sanitized)
        # Remove anything that isn't alphanumeric, hyphens, or dots
        sanitized = re.sub(r"[^a-z0-9\-.]", "", sanitized)
        # Collapse multiple hyphens
        sanitized = re.sub(r"-{2,}", "-", sanitized)
        # Strip leading/trailing hyphens
        sanitized = sanitized.strip("-")
        # Truncate
        if len(sanitized) > 100:
            sanitized = sanitized[:100].rstrip("-")
        return sanitized or "unnamed"

    def _get_settings(self, db: Session) -> Optional[JojiAISettings]:
        """Return the first JojiAISettings row with a GitHub repo configured.

        Returns None if not configured, meaning sync should be skipped.
        """
        settings = (
            db.query(JojiAISettings)
            .filter(JojiAISettings.github_repo_url.isnot(None))
            .filter(JojiAISettings.github_repo_url != "")
            .first()
        )
        if settings is None:
            logger.debug("CRM vault sync: no GitHub repo configured, skipping")
        return settings


# Hook points (add as background tasks in these routes):
# - backend/app/routes/contacts.py: after create/update contact -> sync_contact()
# - backend/app/routes/crm.py: after deal stage change -> sync_deal()
# - backend/app/routes/autoresearch.py: after insight refresh -> sync_outreach_insights()
