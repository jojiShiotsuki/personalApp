"""
CRM-to-Vault auto-sync -- generates markdown files from CRM data
and pushes them to the crm-sync/ folder in the Obsidian vault GitHub repo.
"""

import logging
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.autoresearch import Insight
from app.models.crm import Contact, Deal, Interaction
from app.models.joji_ai import JojiAISettings
from app.services.encryption_service import EncryptionService
from app.services import obsidian_client
from app.services.vault_config import VAULT_REPO_DIR

logger = logging.getLogger(__name__)

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

    def _write_contact_file(self, db: Session, contact_id: int) -> bool:
        """Write a contact markdown file without pushing. Returns True if file was written."""
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            return False
        deals = db.query(Deal).filter(Deal.contact_id == contact_id).order_by(Deal.created_at.desc()).all()
        interactions = db.query(Interaction).filter(Interaction.contact_id == contact_id).order_by(Interaction.interaction_date.desc()).limit(10).all()
        md = self._render_contact_markdown(contact, deals, interactions)
        filename = self._sanitize_filename(contact.name)
        rel_path = f"crm-sync/contacts/{filename}.md"
        obsidian_client.write_file(rel_path, md)
        dest = CRM_SYNC_DIR / "contacts" / f"{filename}.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(md, encoding="utf-8")
        return True

    def _write_deal_file(self, db: Session, deal_id: int) -> bool:
        """Write a deal markdown file without pushing. Returns True if file was written."""
        deal = db.query(Deal).filter(Deal.id == deal_id).first()
        if not deal:
            return False
        contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
        md = self._render_deal_markdown(deal, contact)
        filename = self._sanitize_filename(deal.title)
        rel_path = f"crm-sync/deals/{filename}.md"
        obsidian_client.write_file(rel_path, md)
        dest = CRM_SYNC_DIR / "deals" / f"{filename}.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(md, encoding="utf-8")
        return True

    def batch_crm_sync(self, db: Session) -> dict:
        """Batch sync all recently modified contacts and deals, push once."""
        try:
            settings = self._get_settings(db)
            if settings is None:
                return {"status": "skipped", "reason": "no github repo configured"}
            cutoff = datetime.utcnow() - timedelta(minutes=35)
            written = 0
            contacts = db.query(Contact).filter(Contact.updated_at >= cutoff).all()
            for contact in contacts:
                if self._write_contact_file(db, contact.id):
                    written += 1
            deals = db.query(Deal).filter(Deal.updated_at >= cutoff).all()
            for deal in deals:
                if self._write_deal_file(db, deal.id):
                    written += 1
            insights = db.query(Insight).filter(Insight.is_active.is_(True)).order_by(Insight.created_at.desc()).all()
            md = self._render_insights_markdown(insights)
            dest = CRM_SYNC_DIR / "outreach" / "insights.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(md, encoding="utf-8")
            written += 1

            # --- Additional entity syncs ---
            sync_methods = [
                ("tasks", self._write_tasks_file),
                ("projects", self._write_projects_files),
                ("outreach_log", self._write_outreach_log_file),
                ("discovery_calls", self._write_discovery_calls_file),
                ("social_content", self._write_social_content_file),
            ]
            for label, method in sync_methods:
                try:
                    written += method(db)
                except Exception:
                    logger.exception("Batch CRM sync: %s sync failed", label)

            if written > 0:
                self._push_changes(settings)
            return {"status": "success", "files_written": written}
        except Exception:
            logger.exception("Batch CRM sync failed")
            return {"status": "failed"}

    def _write_template_file(self, relative_path: str, content: str) -> None:
        """Write a file to the vault repo at the given relative path.
        Tries Obsidian REST API first for instant visibility, always writes to disk for git."""
        # Instant update in Obsidian if it's running
        obsidian_client.write_file(relative_path, content)
        # Always write to filesystem (needed for git push)
        dest = VAULT_REPO_DIR / relative_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")

    def generate_starter_templates(self, db: Session) -> dict:
        """Generate starter template files from outreach experiments and push once."""
        from app.models.autoresearch import Experiment

        try:
            settings = self._get_settings(db)
            if settings is None:
                return {"status": "skipped", "reason": "no github repo configured"}

            experiments = (
                db.query(Experiment)
                .filter(Experiment.sent_at.isnot(None))
                .filter(Experiment.body.isnot(None))
                .limit(50)
                .all()
            )

            cold_emails = [e for e in experiments if getattr(e, "step_number", 1) == 1]
            follow_ups = [e for e in experiments if getattr(e, "step_number", 1) > 1]
            loom_scripts = [e for e in experiments if getattr(e, "loom_script", None)]

            files_written = 0
            today = datetime.utcnow().strftime("%Y-%m-%d")

            # --- voice/communication-style.md ---
            lines: list[str] = [
                "---",
                "type: voice",
                "tags: [communication, emails, outreach]",
                f"generated: {today}",
                "---",
                "",
                "# Communication Style",
                "",
            ]
            lines.append("## Cold Emails")
            lines.append("")
            if cold_emails:
                for e in cold_emails[:5]:
                    lines.append(f"### Subject: {getattr(e, 'subject', 'N/A')}")
                    lines.append("")
                    lines.append(e.body)
                    lines.append("")
            else:
                lines.append("_No outreach data found yet._")
                lines.append("")
            lines.append("## Follow-Ups")
            lines.append("")
            if follow_ups:
                for e in follow_ups[:5]:
                    lines.append(f"### Subject: {getattr(e, 'subject', 'N/A')}")
                    lines.append("")
                    lines.append(e.body)
                    lines.append("")
            else:
                lines.append("_No outreach data found yet._")
                lines.append("")
            self._write_template_file("voice/communication-style.md", "\n".join(lines))
            files_written += 1

            # --- voice/phrases-i-use.md ---
            lines = [
                "---",
                "type: voice",
                "tags: [phrases, greetings, sign-offs]",
                f"generated: {today}",
                "---",
                "",
                "# Phrases I Use",
                "",
            ]
            lines.append("## Greetings")
            lines.append("")
            greetings: list[str] = []
            sign_offs: list[str] = []
            for e in experiments:
                body_lines = (e.body or "").strip().split("\n")
                if body_lines:
                    first_line = body_lines[0].strip()
                    if first_line:
                        greetings.append(first_line)
                    non_empty = [ln.strip() for ln in body_lines if ln.strip()]
                    if non_empty:
                        sign_offs.append(non_empty[-1])
            if greetings:
                for g in sorted(set(greetings)):
                    lines.append(f"- {g}")
            else:
                lines.append("_No outreach data found yet._")
            lines.append("")
            lines.append("## Sign-Offs")
            lines.append("")
            if sign_offs:
                for s in sorted(set(sign_offs)):
                    lines.append(f"- {s}")
            else:
                lines.append("_No outreach data found yet._")
            lines.append("")
            self._write_template_file("voice/phrases-i-use.md", "\n".join(lines))
            files_written += 1

            # --- voice/tone-guide.md ---
            lines = [
                "---",
                "type: voice",
                "tags: [tone, style, writing]",
                f"generated: {today}",
                "---",
                "",
                "# Tone Guide",
                "",
            ]
            if experiments:
                word_counts = [len((e.body or "").split()) for e in experiments]
                avg_words = sum(word_counts) // len(word_counts) if word_counts else 0
                lines.append(f"**Average email word count:** {avg_words}")
                lines.append(f"**Sample size:** {len(experiments)} emails")
            else:
                lines.append("_No outreach data found yet._")
            lines.append("")
            lines.append("<!-- Fill in your style notes below -->")
            lines.append("## Style Notes")
            lines.append("")
            lines.append("<!-- e.g. casual, professional, direct, empathetic -->")
            lines.append("")
            self._write_template_file("voice/tone-guide.md", "\n".join(lines))
            files_written += 1

            # --- templates/cold-emails.md ---
            lines = [
                "---",
                "type: template",
                "tags: [cold-email, outreach, first-touch]",
                f"generated: {today}",
                "---",
                "",
                "# Cold Email Templates",
                "",
            ]
            if cold_emails:
                for e in cold_emails[:10]:
                    company = getattr(e, "company_name", None) or "N/A"
                    niche = getattr(e, "niche", None) or "N/A"
                    lines.append(f"## {company} ({niche})")
                    lines.append("")
                    lines.append(f"**Subject:** {getattr(e, 'subject', 'N/A')}")
                    lines.append("")
                    lines.append(e.body)
                    lines.append("")
                    lines.append("---")
                    lines.append("")
            else:
                lines.append("_No outreach data found yet._")
                lines.append("")
            self._write_template_file("templates/cold-emails.md", "\n".join(lines))
            files_written += 1

            # --- templates/follow-ups.md ---
            lines = [
                "---",
                "type: template",
                "tags: [follow-up, outreach, sequence]",
                f"generated: {today}",
                "---",
                "",
                "# Follow-Up Templates",
                "",
            ]
            if follow_ups:
                for e in follow_ups[:10]:
                    company = getattr(e, "company_name", None) or "N/A"
                    step = getattr(e, "step_number", "N/A")
                    lines.append(f"## Step {step} — {company}")
                    lines.append("")
                    lines.append(f"**Subject:** {getattr(e, 'subject', 'N/A')}")
                    lines.append("")
                    lines.append(e.body)
                    lines.append("")
                    lines.append("---")
                    lines.append("")
            else:
                lines.append("_No outreach data found yet._")
                lines.append("")
            self._write_template_file("templates/follow-ups.md", "\n".join(lines))
            files_written += 1

            # --- templates/loom-scripts.md ---
            lines = [
                "---",
                "type: template",
                "tags: [loom, video, outreach]",
                f"generated: {today}",
                "---",
                "",
                "# Loom Script Templates",
                "",
            ]
            if loom_scripts:
                for e in loom_scripts[:10]:
                    company = getattr(e, "company_name", None) or "N/A"
                    step = getattr(e, "step_number", "N/A")
                    lines.append(f"## {company} (Step {step})")
                    lines.append("")
                    lines.append(e.loom_script)
                    lines.append("")
                    lines.append("---")
                    lines.append("")
            else:
                lines.append("_No outreach data found yet._")
                lines.append("")
            self._write_template_file("templates/loom-scripts.md", "\n".join(lines))
            files_written += 1

            # --- sops/sales-process.md ---
            sales_process = "\n".join([
                "---",
                "type: sop",
                "tags: [sales, pipeline, outreach]",
                f"generated: {today}",
                "---",
                "",
                "# Sales Process",
                "",
                "## Autoresearch Pipeline",
                "",
                "1. **Website Audit** — Playwright screenshot + Claude Vision analysis",
                "2. **Cold Email** — Personalized first touch based on audit findings",
                "3. **Follow-Up Sequence** — 3-5 follow-ups spaced 3-5 days apart",
                "4. **Loom Video** — Personalized walkthrough of audit findings",
                "5. **LinkedIn Connect** — Connect with decision maker, reference email",
                "6. **Final Follow-Up** — Last touch with clear call to action",
                "",
            ])
            self._write_template_file("sops/sales-process.md", sales_process)
            files_written += 1

            # --- sops/pricing.md ---
            pricing = "\n".join([
                "---",
                "type: sop",
                "tags: [pricing, packages, rates]",
                f"generated: {today}",
                "---",
                "",
                "# Pricing",
                "",
                "## Packages",
                "",
                "<!-- Define your service packages here -->",
                "",
                "| Package | Description | Price |",
                "|---------|-------------|-------|",
                "| Starter | | $ |",
                "| Growth | | $ |",
                "| Premium | | $ |",
                "",
                "## Hourly Rate",
                "",
                "<!-- Define your hourly rate here -->",
                "",
                "- **Standard rate:** $___/hr",
                "- **Rush rate:** $___/hr",
                "",
            ])
            self._write_template_file("sops/pricing.md", pricing)
            files_written += 1

            # --- sops/client-onboarding.md ---
            onboarding = "\n".join([
                "---",
                "type: sop",
                "tags: [onboarding, client, checklist]",
                f"generated: {today}",
                "---",
                "",
                "# Client Onboarding",
                "",
                "## Checklist",
                "",
                "- [ ] 1. Send welcome email with next steps",
                "- [ ] 2. Schedule kickoff call",
                "- [ ] 3. Collect brand assets (logos, colors, fonts)",
                "- [ ] 4. Get access credentials (hosting, CMS, analytics)",
                "- [ ] 5. Set up project in CRM with tasks and milestones",
                "- [ ] 6. Create shared communication channel (Slack, email thread)",
                "- [ ] 7. Send project timeline and deliverables document",
                "- [ ] 8. First progress update within 48 hours",
                "",
            ])
            self._write_template_file("sops/client-onboarding.md", onboarding)
            files_written += 1

            # --- knowledge/tech-stack.md ---
            tech_stack = "\n".join([
                "---",
                "type: knowledge",
                "tags: [tech-stack, tools, infrastructure]",
                f"generated: {today}",
                "---",
                "",
                "# Tech Stack",
                "",
                "## Client Work",
                "",
                "- **WordPress** — Primary platform for client websites",
                "",
                "## Internal Tools",
                "",
                "- **React + TypeScript + Vite + TailwindCSS** — CRM frontend",
                "- **FastAPI + SQLAlchemy** — CRM backend",
                "- **Claude AI** — AI-powered outreach and analysis",
                "- **Playwright** — Website auditing and automation",
                "- **Obsidian** — Knowledge base and vault sync",
                "",
            ])
            self._write_template_file("knowledge/tech-stack.md", tech_stack)
            files_written += 1

            # --- knowledge/lessons-learned.md ---
            lessons = "\n".join([
                "---",
                "type: knowledge",
                "tags: [lessons, retrospective, learning]",
                f"generated: {today}",
                "---",
                "",
                "# Lessons Learned",
                "",
                "<!-- Add lessons from client work, outreach, and business operations -->",
                "",
                "## Outreach",
                "",
                "<!-- e.g. What subject lines work? What niches respond best? -->",
                "",
                "## Client Work",
                "",
                "<!-- e.g. Common project pitfalls, scope creep patterns -->",
                "",
                "## Business Operations",
                "",
                "<!-- e.g. Pricing mistakes, process improvements -->",
                "",
            ])
            self._write_template_file("knowledge/lessons-learned.md", lessons)
            files_written += 1

            # --- goals/business-vision.md ---
            vision = "\n".join([
                "---",
                "type: goal",
                "tags: [vision, strategy, goals]",
                f"generated: {today}",
                "---",
                "",
                "# Business Vision",
                "",
                "## Current Focus",
                "",
                "<!-- What are you focused on right now? -->",
                "",
                "## 2026 Goals",
                "",
                "<!-- Revenue targets, client count, service expansion -->",
                "",
                "## Dream Clients",
                "",
                "<!-- Ideal client profiles, industries, company sizes -->",
                "",
                "## Long-Term Vision",
                "",
                "<!-- Where do you want to be in 3-5 years? -->",
                "",
            ])
            self._write_template_file("goals/business-vision.md", vision)
            files_written += 1

            self._push_changes(settings)
            return {"status": "success", "files_written": files_written}

        except Exception:
            logger.exception("Generate starter templates failed")
            return {"status": "failed"}

    # ------------------------------------------------------------------
    # Batch sync: additional entity writers
    # ------------------------------------------------------------------

    def _write_tasks_file(self, db: Session) -> int:
        """Write active (non-completed) tasks grouped by priority. Returns files written."""
        from app.models.task import Task, TaskStatus, TaskPriority

        tasks = (
            db.query(Task)
            .filter(Task.status != TaskStatus.COMPLETED)
            .order_by(Task.due_date)
            .all()
        )

        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        lines: list[str] = ["# Active Tasks", f"_Last updated: {timestamp}_", ""]

        by_priority: dict[str, list] = {
            "URGENT": [],
            "HIGH": [],
            "MEDIUM": [],
            "LOW": [],
        }
        for task in tasks:
            prio = task.priority.value if task.priority else "MEDIUM"
            by_priority.setdefault(prio, []).append(task)

        for prio_label in ("URGENT", "HIGH", "MEDIUM", "LOW"):
            group = by_priority.get(prio_label, [])
            if not group:
                continue
            lines.append(f"## {prio_label.capitalize()}")
            lines.append("")
            for t in group:
                due = str(t.due_date) if t.due_date else "No date"
                project_name = t.project.name if t.project else "None"
                lines.append(f"- [ ] {t.title} — Due: {due} — Project: {project_name}")
            lines.append("")

        if not tasks:
            lines.append("_No active tasks._")
            lines.append("")

        dest = CRM_SYNC_DIR / "tasks" / "active-tasks.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("\n".join(lines), encoding="utf-8")
        return 1

    def _write_projects_files(self, db: Session) -> int:
        """Write one markdown file per active project. Returns files written."""
        from app.models.project import Project

        active_statuses = ["TODO", "SCOPING", "IN_PROGRESS", "REVIEW", "REVISIONS", "RETAINER"]
        projects = (
            db.query(Project)
            .filter(Project.status.in_(active_statuses))
            .all()
        )

        written = 0
        for proj in projects:
            contact_name = proj.contact.name if proj.contact else "N/A"
            deadline_str = str(proj.deadline) if proj.deadline else "N/A"
            rate_str = f"${proj.hourly_rate}" if proj.hourly_rate else "N/A"
            status_str = proj.status.value if proj.status else "N/A"

            lines: list[str] = [
                f"# {proj.name}",
                f"**Status:** {status_str}",
                f"**Progress:** {proj.progress or 0}%",
                f"**Client:** {contact_name}",
                f"**Deadline:** {deadline_str}",
                f"**Hourly Rate:** {rate_str}",
                "",
                "## Notes",
                proj.notes if proj.notes else "_No notes_",
                "",
            ]

            filename = self._sanitize_filename(proj.name)
            dest = CRM_SYNC_DIR / "projects" / f"{filename}.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text("\n".join(lines), encoding="utf-8")
            written += 1

        return written

    def _write_outreach_log_file(self, db: Session) -> int:
        """Write last 7 days of daily outreach logs. Returns files written."""
        from app.models.daily_outreach import DailyOutreachLog

        cutoff = datetime.utcnow() - timedelta(days=7)
        logs = (
            db.query(DailyOutreachLog)
            .filter(DailyOutreachLog.log_date >= cutoff.date())
            .order_by(DailyOutreachLog.log_date.desc())
            .all()
        )

        lines: list[str] = ["# Daily Outreach Log (Last 7 Days)", ""]

        if not logs:
            lines.append("_No outreach logs in the last 7 days._")
            lines.append("")
        else:
            for log in logs:
                lines.append(f"## {log.log_date}")
                lines.append(f"- Cold Emails: {log.cold_emails_sent}/{log.target_cold_emails}")
                lines.append(f"- LinkedIn: {log.linkedin_actions}/{log.target_linkedin}")
                lines.append(f"- Follow-up Calls: {log.follow_up_calls}/{log.target_calls}")
                lines.append(f"- Loom Audits: {log.loom_audits_sent}/{log.target_looms}")
                all_met = "Yes" if log.all_targets_met else "No"
                lines.append(f"- All Targets Met: {all_met}")
                lines.append("")

        dest = CRM_SYNC_DIR / "outreach" / "daily-log.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("\n".join(lines), encoding="utf-8")
        return 1

    def _write_discovery_calls_file(self, db: Session) -> int:
        """Write last 30 days of discovery calls. Returns files written."""
        from app.models.discovery_call import DiscoveryCall

        cutoff = datetime.utcnow() - timedelta(days=30)
        calls = (
            db.query(DiscoveryCall)
            .filter(DiscoveryCall.call_date >= cutoff)
            .order_by(DiscoveryCall.call_date.desc())
            .all()
        )

        lines: list[str] = ["# Recent Discovery Calls", ""]

        if not calls:
            lines.append("_No discovery calls in the last 30 days._")
            lines.append("")
        else:
            for call in calls:
                contact_name = call.contact.name if call.contact else "Unknown"
                lines.append(f"## {call.call_date} — {contact_name}")
                duration_str = f"{call.call_duration_minutes} min" if call.call_duration_minutes else "N/A"
                outcome_str = call.outcome.value if call.outcome else "N/A"
                budget_str = call.budget_range if call.budget_range else "Not discussed"
                next_steps_str = call.next_steps if call.next_steps else "N/A"
                lines.append(f"- Duration: {duration_str}")
                lines.append(f"- Outcome: {outcome_str}")
                lines.append(f"- Budget: {budget_str}")
                lines.append(f"- Next Steps: {next_steps_str}")
                lines.append("")

        dest = CRM_SYNC_DIR / "discovery-calls" / "recent.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("\n".join(lines), encoding="utf-8")
        return 1

    def _write_social_content_file(self, db: Session) -> int:
        """Write upcoming (non-posted) social content. Returns files written."""
        from app.models.social_content import SocialContent

        content = (
            db.query(SocialContent)
            .filter(SocialContent.status != "POSTED")
            .order_by(SocialContent.content_date)
            .all()
        )

        lines: list[str] = ["# Upcoming Social Content", ""]

        if not content:
            lines.append("_No upcoming social content._")
            lines.append("")
        else:
            for item in content:
                title = item.title or "Untitled"
                lines.append(f"## {item.content_date} — {title}")
                content_type = item.content_type.value if item.content_type else "N/A"
                status_str = item.status.value if item.status else "N/A"
                platforms = ", ".join(item.platforms) if item.platforms else "N/A"
                lines.append(f"- Type: {content_type}")
                lines.append(f"- Status: {status_str}")
                lines.append(f"- Platforms: {platforms}")
                lines.append("")

        dest = CRM_SYNC_DIR / "social" / "upcoming.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("\n".join(lines), encoding="utf-8")
        return 1

    @staticmethod
    def _format_duration(seconds: int | None) -> str:
        """Format duration in seconds as 'Xh Ym'."""
        if not seconds or seconds <= 0:
            return "0h 0m"
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours}h {minutes}m"

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
    # Conversation summary sync
    # ------------------------------------------------------------------

    def sync_conversation_summary(self, db: Session, conversation_id: int) -> None:
        """Generate a summary of a conversation and push it to the vault.

        Only runs when the conversation has 5+ messages. Uses Haiku for
        cheap, fast summarisation.
        """
        try:
            settings = self._get_settings(db)
            if settings is None:
                return

            from app.models.joji_ai import Conversation, ConversationMessage

            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            if not conversation:
                return

            messages = (
                db.query(ConversationMessage)
                .filter(ConversationMessage.conversation_id == conversation_id)
                .order_by(ConversationMessage.created_at)
                .all()
            )

            if len(messages) < 5:
                return

            # Build transcript for summarisation
            transcript_lines = []
            for msg in messages:
                role = "Joji" if msg.role == "user" else "AI"
                # Truncate very long messages
                content = (msg.content or "")[:500]
                transcript_lines.append(f"**{role}:** {content}")

            transcript = "\n\n".join(transcript_lines)

            # Generate summary via Haiku (cheapest model)
            summary = self._generate_summary_via_haiku(transcript, conversation.title)
            if not summary:
                return

            # Write to vault
            date_str = conversation.created_at.strftime("%Y-%m-%d")
            title_slug = self._sanitize_filename(conversation.title or "untitled")
            filename = f"conversations/{date_str}-{title_slug}.md"

            self._write_template_file(filename, summary)
            self._push_changes(settings)

            logger.info("Synced conversation %d summary to vault", conversation_id)

        except Exception:
            logger.exception("Conversation summary sync failed for %d", conversation_id)

    @staticmethod
    def _generate_summary_via_haiku(transcript: str, title: str | None) -> str | None:
        """Call Claude Haiku to summarise a conversation transcript."""
        import os

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            logger.warning("No ANTHROPIC_API_KEY set, skipping conversation summary")
            return None

        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": f"""Summarise this conversation between Joji (the user) and his AI assistant.
Extract:
1. Key decisions or preferences Joji expressed
2. Important facts about Joji or his business that were discussed
3. Any action items or next steps

Keep it concise — bullet points preferred. This summary will be stored in Joji's knowledge vault so his AI can reference it in future conversations.

Conversation title: {title or 'Untitled'}

Transcript:
{transcript}

Write the summary as a markdown document starting with:
# {title or 'Conversation Summary'}
""",
                }],
            )

            return response.content[0].text if response.content else None

        except Exception as exc:
            logger.warning("Haiku summary generation failed: %s", exc)
            return None

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
                logger.warning("CRM vault sync push failed, attempting pull --rebase: %s", push_err)
                try:
                    repo.remotes.origin.pull(rebase=True)
                    repo.remotes.origin.push()
                except git.GitCommandError as rebase_err:
                    logger.error("CRM vault sync pull-rebase failed, skipping push: %s", rebase_err)

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
