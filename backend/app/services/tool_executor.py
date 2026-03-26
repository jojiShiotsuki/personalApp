import logging
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.task import Task
from app.models.crm import Deal, Contact
from app.models.project import Project
from app.models.goal import Goal
from app.models.outreach import OutreachCampaign, OutreachProspect, ProspectStatus
from app.models.autoresearch import Experiment
from app.services.vault_search_service import VaultSearchService
from app.services import obsidian_client
from app.services.vault_config import VAULT_REPO_DIR

logger = logging.getLogger(__name__)

# Module-level singleton so the embedding cache persists across requests
_vault_search_service = VaultSearchService()


class ToolExecutor:
    def __init__(self, db: Session):
        self.db = db

    def execute(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call and return results"""

        # Map tool names to methods
        handlers = {
            # Tasks
            "get_tasks": self._get_tasks,
            "create_task": self._create_task,
            "update_task": self._update_task,
            "delete_task": self._delete_task,
            # Deals
            "get_deals": self._get_deals,
            "create_deal": self._create_deal,
            "update_deal": self._update_deal,
            # Contacts
            "get_contacts": self._get_contacts,
            "create_contact": self._create_contact,
            # Projects
            "get_projects": self._get_projects,
            "create_project": self._create_project,
            # Goals
            "get_goals": self._get_goals,
            "create_goal": self._create_goal,
            # Vault
            "search_vault": self._search_vault,
            "write_vault_file": self._write_vault_file,
            "read_vault_file": self._read_vault_file,
            "list_vault_files": self._list_vault_files,
            # Outreach
            "get_outreach_stats": self._get_outreach_stats,
            "get_prospect_info": self._get_prospect_info,
        }

        handler = handlers.get(tool_name)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            return handler(tool_input)
        except Exception as e:
            return {"error": str(e)}

    # ------------------------------------------------------------------
    # Task tools
    # ------------------------------------------------------------------

    def _get_tasks(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Task)

        if "status" in params:
            query = query.filter(Task.status == params["status"])
        if "priority" in params:
            query = query.filter(Task.priority == params["priority"])

        limit = params.get("limit", 10)
        tasks = query.limit(limit).all()

        return {
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                    "due_date": str(t.due_date) if t.due_date else None
                }
                for t in tasks
            ]
        }

    def _create_task(self, params: Dict[str, Any]) -> Dict[str, Any]:
        task = Task(
            title=params["title"],
            priority=params.get("priority", "MEDIUM"),
            status="PENDING"
        )

        if "due_date" in params:
            try:
                task.due_date = datetime.strptime(params["due_date"], "%Y-%m-%d").date()
            except ValueError:
                # Try ISO format just in case
                try:
                    task.due_date = datetime.fromisoformat(params["due_date"]).date()
                except ValueError:
                    return {"error": f"Invalid date format: {params['due_date']}. Use YYYY-MM-DD"}

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return {
            "success": True,
            "task_id": task.id,
            "message": f"Created task: {task.title}"
        }

    def _update_task(self, params: Dict[str, Any]) -> Dict[str, Any]:
        task = self.db.query(Task).filter(Task.id == params["task_id"]).first()

        if not task:
            return {"error": f"Task {params['task_id']} not found"}

        # Update fields
        for field in ["title", "status", "priority"]:
            if field in params:
                setattr(task, field, params[field])

        if "due_date" in params:
            task.due_date = datetime.strptime(params["due_date"], "%Y-%m-%d").date()

        self.db.commit()

        return {
            "success": True,
            "message": f"Updated task {task.id}"
        }

    def _delete_task(self, params: Dict[str, Any]) -> Dict[str, Any]:
        task = self.db.query(Task).filter(Task.id == params["task_id"]).first()

        if not task:
            return {"error": f"Task {params['task_id']} not found"}

        task_title = task.title
        self.db.delete(task)
        self.db.commit()

        return {
            "success": True,
            "message": f"Deleted task {params['task_id']}: {task_title}"
        }

    # ------------------------------------------------------------------
    # Deal tools
    # ------------------------------------------------------------------

    def _get_deals(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Deal)

        if "stage" in params:
            query = query.filter(Deal.stage == params["stage"])

        limit = params.get("limit", 10)
        deals = query.limit(limit).all()

        return {
            "deals": [
                {
                    "id": d.id,
                    "title": d.title,
                    "value": float(d.value) if d.value else None,
                    "stage": d.stage
                }
                for d in deals
            ]
        }

    def _create_deal(self, params: Dict[str, Any]) -> Dict[str, Any]:
        deal = Deal(
            title=params["title"],
            value=params.get("value", 0),
            stage=params.get("stage", "lead"),
            contact_id=params.get("contact_id")
        )

        self.db.add(deal)
        self.db.commit()
        self.db.refresh(deal)

        return {
            "success": True,
            "deal_id": deal.id,
            "message": f"Created deal: {deal.title}"
        }

    def _update_deal(self, params: Dict[str, Any]) -> Dict[str, Any]:
        deal = self.db.query(Deal).filter(Deal.id == params["deal_id"]).first()

        if not deal:
            return {"error": f"Deal {params['deal_id']} not found"}

        for field in ["title", "stage"]:
            if field in params:
                setattr(deal, field, params[field])

        if "value" in params:
            deal.value = params["value"]

        self.db.commit()

        return {
            "success": True,
            "message": f"Updated deal {deal.id}"
        }

    # ------------------------------------------------------------------
    # Contact tools
    # ------------------------------------------------------------------

    def _get_contacts(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Contact)

        if "search" in params:
            search = f"%{params['search']}%"
            query = query.filter(
                (Contact.name.ilike(search)) | (Contact.email.ilike(search))
            )

        limit = params.get("limit", 10)
        contacts = query.limit(limit).all()

        return {
            "contacts": [
                {
                    "id": c.id,
                    "name": c.name,
                    "email": c.email,
                    "company": c.company
                }
                for c in contacts
            ]
        }

    def _create_contact(self, params: Dict[str, Any]) -> Dict[str, Any]:
        contact = Contact(
            name=params["name"],
            email=params.get("email"),
            phone=params.get("phone"),
            company=params.get("company")
        )

        self.db.add(contact)
        self.db.commit()
        self.db.refresh(contact)

        return {
            "success": True,
            "contact_id": contact.id,
            "message": f"Created contact: {contact.name}"
        }

    # ------------------------------------------------------------------
    # Project tools
    # ------------------------------------------------------------------

    def _get_projects(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Project)

        limit = params.get("limit", 10)
        projects = query.limit(limit).all()

        return {
            "projects": [
                {
                    "id": p.id,
                    "name": p.name,
                    "status": p.status.value if p.status else None,
                    "progress": p.progress
                }
                for p in projects
            ]
        }

    def _create_project(self, params: Dict[str, Any]) -> Dict[str, Any]:
        project = Project(
            name=params["name"],
            description=params.get("description")
        )

        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)

        return {
            "success": True,
            "project_id": project.id,
            "message": f"Created project: {project.name}"
        }

    # ------------------------------------------------------------------
    # Goal tools
    # ------------------------------------------------------------------

    def _get_goals(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Goal)

        if "year" in params:
            query = query.filter(Goal.year == params["year"])

        limit = params.get("limit", 10)
        goals = query.limit(limit).all()

        return {
            "goals": [
                {
                    "id": g.id,
                    "title": g.title,
                    "description": g.description,
                    "year": g.year,
                    "quarter": g.quarter.value if g.quarter else None,
                    "progress": g.progress,
                    "priority": g.priority.value if g.priority else None
                }
                for g in goals
            ]
        }

    def _create_goal(self, params: Dict[str, Any]) -> Dict[str, Any]:
        # Derive quarter and month from target_date if provided, else use sensible defaults
        now = datetime.utcnow()
        year = now.year
        quarter = "Q1"
        month = "JANUARY"

        if "target_date" in params:
            try:
                target = datetime.strptime(params["target_date"], "%Y-%m-%d")
                year = target.year
                month_num = target.month
                month_names = [
                    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
                ]
                month = month_names[month_num - 1]
                if month_num <= 3:
                    quarter = "Q1"
                elif month_num <= 6:
                    quarter = "Q2"
                elif month_num <= 9:
                    quarter = "Q3"
                else:
                    quarter = "Q4"
            except ValueError:
                return {"error": f"Invalid date format: {params['target_date']}. Use YYYY-MM-DD"}

        goal = Goal(
            title=params["title"],
            description=params.get("description"),
            year=year,
            quarter=quarter,
            month=month,
            target_date=params.get("target_date"),
        )

        # Set category as priority if provided (map category string to priority)
        if "category" in params:
            goal.description = f"[{params['category']}] {goal.description or ''}"

        self.db.add(goal)
        self.db.commit()
        self.db.refresh(goal)

        return {
            "success": True,
            "goal_id": goal.id,
            "message": f"Created goal: {goal.title}"
        }

    # ------------------------------------------------------------------
    # Vault tools
    # ------------------------------------------------------------------

    def _search_vault(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = params["query"]
        top_k = params.get("top_k", 5)

        results = _vault_search_service.search(self.db, query, top_k)

        return {
            "results": [
                {
                    "file_path": r.get("file_path", ""),
                    "heading": r.get("heading_context", ""),
                    "content": r.get("content", ""),
                    "score": r.get("score", 0.0)
                }
                for r in results
            ],
            "total": len(results)
        }

    def _write_vault_file(self, params: Dict[str, Any]) -> Dict[str, Any]:
        file_path = params["file_path"]
        content = params["content"]
        commit_msg = params.get("commit_message", f"AI: update {file_path}")

        # Validate path
        if not file_path.endswith(".md"):
            return {"error": "File path must end in .md"}
        if ".." in file_path or file_path.startswith("/"):
            return {"error": "Invalid file path — must be relative, no '..'"}

        if not VAULT_REPO_DIR.exists() or not (VAULT_REPO_DIR / ".git").exists():
            return {"error": "Vault repo not cloned yet. Please sync the vault first from Settings."}

        dest = VAULT_REPO_DIR / file_path
        is_new = not dest.exists()

        # Try Obsidian REST API first (instant visibility in Obsidian)
        wrote_via_api = obsidian_client.write_file(file_path, content)

        # Always write to filesystem too (needed for git + vault search indexing)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")

        # Push to GitHub (uses git locally, GitHub API on Render)
        try:
            from app.services.vault_utils import push_vault_changes
            push_vault_changes(self.db, [file_path], commit_msg)
        except Exception as exc:
            logger.warning("Vault push failed for %s: %s", file_path, exc)

        # Re-index this file immediately so it's searchable right away
        try:
            from app.services.conversation_learner import _reindex_files
            _reindex_files(self.db, [file_path])
        except Exception as idx_exc:
            logger.warning("Immediate re-index failed for %s: %s", file_path, idx_exc)

        return {
            "status": "created" if is_new else "updated",
            "file_path": file_path,
            "size_bytes": len(content.encode("utf-8")),
            "obsidian_live": wrote_via_api,
        }

    def _read_vault_file(self, params: Dict[str, Any]) -> Dict[str, Any]:
        file_path = params["file_path"]

        if ".." in file_path or file_path.startswith("/"):
            return {"error": "Invalid file path — must be relative, no '..'"}

        # Try Obsidian REST API first (gets latest content even if not yet git-pulled)
        api_content = obsidian_client.read_file(file_path)
        if api_content is not None:
            return {
                "file_path": file_path,
                "content": api_content,
                "size_bytes": len(api_content.encode("utf-8")),
                "source": "obsidian",
            }

        # Fall back to filesystem
        if not VAULT_REPO_DIR.exists():
            return {"error": "Vault repo not cloned yet."}

        target = VAULT_REPO_DIR / file_path
        if not target.exists():
            return {"error": f"File not found: {file_path}"}
        if not target.is_file():
            return {"error": f"Not a file: {file_path}"}

        content = target.read_text(encoding="utf-8")
        return {
            "file_path": file_path,
            "content": content,
            "size_bytes": len(content.encode("utf-8")),
            "source": "filesystem",
        }

    def _list_vault_files(self, params: Dict[str, Any]) -> Dict[str, Any]:
        directory = params.get("directory", "")

        if ".." in directory:
            return {"error": "Invalid directory — no '..' allowed"}

        # Try Obsidian REST API first
        api_listing = obsidian_client.list_directory(directory)
        if api_listing is not None:
            # API returns flat list of file paths — convert to our format
            items = []
            prefix = f"{directory}/" if directory else ""
            for path_str in api_listing:
                # Only show direct children (not nested)
                relative = path_str[len(prefix):] if path_str.startswith(prefix) else path_str
                if "/" in relative:
                    # It's a nested path — extract the directory name
                    dir_name = relative.split("/")[0]
                    entry = {"name": dir_name, "type": "directory", "path": f"{prefix}{dir_name}"}
                    if entry not in items:
                        items.append(entry)
                else:
                    items.append({"name": relative, "type": "file", "path": path_str})
            return {"directory": directory or "/", "items": items, "total": len(items), "source": "obsidian"}

        # Fall back to filesystem
        if not VAULT_REPO_DIR.exists():
            return {"error": "Vault repo not cloned yet."}

        target_dir = VAULT_REPO_DIR / directory if directory else VAULT_REPO_DIR
        if not target_dir.exists() or not target_dir.is_dir():
            return {"error": f"Directory not found: {directory or '/'}"}

        items = []
        for entry in sorted(target_dir.iterdir()):
            # Skip .git and hidden files
            if entry.name.startswith("."):
                continue
            items.append({
                "name": entry.name,
                "type": "directory" if entry.is_dir() else "file",
                "path": str(entry.relative_to(VAULT_REPO_DIR)),
            })

        return {"directory": directory or "/", "items": items, "total": len(items), "source": "filesystem"}

    # ------------------------------------------------------------------
    # Outreach tools
    # ------------------------------------------------------------------

    def _push_vault_repo(self, repo) -> None:
        """Push vault repo with auth token injected if needed."""
        import git
        import re
        try:
            repo.remotes.origin.push()
        except git.GitCommandError:
            # Remote URL might lack credentials — inject token from settings
            try:
                from app.models.joji_ai import JojiAISettings
                from app.services.encryption_service import EncryptionService
                settings = self.db.query(JojiAISettings).first()
                if settings and settings.github_token_encrypted:
                    token = EncryptionService.decrypt(settings.github_token_encrypted)
                    current_url = repo.remotes.origin.url
                    auth_url = re.sub(r"^https://", f"https://{token}@", current_url)
                    repo.remotes.origin.set_url(auth_url)
                    try:
                        repo.remotes.origin.push()
                    finally:
                        # Restore clean URL (don't leave token on disk)
                        repo.remotes.origin.set_url(current_url)
                else:
                    repo.remotes.origin.pull(rebase=True)
                    repo.remotes.origin.push()
            except Exception:
                repo.remotes.origin.pull(rebase=True)
                repo.remotes.origin.push()

    def _get_outreach_stats(self, params: Dict[str, Any]) -> Dict[str, Any]:
        campaign_id = params.get("campaign_id")

        if campaign_id:
            campaigns = self.db.query(OutreachCampaign).filter(
                OutreachCampaign.id == campaign_id
            ).all()
        else:
            campaigns = self.db.query(OutreachCampaign).all()

        if not campaigns:
            return {"campaigns": [], "message": "No campaigns found"}

        campaign_stats = []
        for campaign in campaigns:
            total = self.db.query(func.count(OutreachProspect.id)).filter(
                OutreachProspect.campaign_id == campaign.id
            ).scalar() or 0

            replied = self.db.query(func.count(OutreachProspect.id)).filter(
                OutreachProspect.campaign_id == campaign.id,
                OutreachProspect.status == ProspectStatus.REPLIED
            ).scalar() or 0

            converted = self.db.query(func.count(OutreachProspect.id)).filter(
                OutreachProspect.campaign_id == campaign.id,
                OutreachProspect.status == ProspectStatus.CONVERTED
            ).scalar() or 0

            not_interested = self.db.query(func.count(OutreachProspect.id)).filter(
                OutreachProspect.campaign_id == campaign.id,
                OutreachProspect.status == ProspectStatus.NOT_INTERESTED
            ).scalar() or 0

            reply_rate = (replied / total * 100) if total > 0 else 0.0
            conversion_rate = (converted / total * 100) if total > 0 else 0.0

            campaign_stats.append({
                "campaign_id": campaign.id,
                "name": campaign.name,
                "campaign_type": campaign.campaign_type.value if campaign.campaign_type else None,
                "status": campaign.status.value if campaign.status else None,
                "total_prospects": total,
                "replied": replied,
                "converted": converted,
                "not_interested": not_interested,
                "reply_rate_pct": round(reply_rate, 1),
                "conversion_rate_pct": round(conversion_rate, 1)
            })

        return {"campaigns": campaign_stats}

    def _get_prospect_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        prospect = self.db.query(OutreachProspect).filter(
            OutreachProspect.id == params["prospect_id"]
        ).first()

        if not prospect:
            return {"error": f"Prospect {params['prospect_id']} not found"}

        # Get campaign name
        campaign = self.db.query(OutreachCampaign).filter(
            OutreachCampaign.id == prospect.campaign_id
        ).first()

        # Get email history from experiments
        experiments = (
            self.db.query(Experiment)
            .filter(Experiment.prospect_id == prospect.id)
            .order_by(Experiment.step_number)
            .all()
        )

        email_history = [
            {
                "id": exp.id,
                "step_number": exp.step_number,
                "subject": exp.subject,
                "status": exp.status,
                "sent_at": str(exp.sent_at) if exp.sent_at else None,
                "replied": exp.replied,
                "reply_at": str(exp.reply_at) if exp.reply_at else None,
                "sentiment": exp.sentiment
            }
            for exp in experiments
        ]

        return {
            "prospect": {
                "id": prospect.id,
                "agency_name": prospect.agency_name,
                "contact_name": prospect.contact_name,
                "email": prospect.email,
                "website": prospect.website,
                "niche": prospect.niche,
                "status": prospect.status.value if prospect.status else None,
                "current_step": prospect.current_step,
                "last_contacted_at": str(prospect.last_contacted_at) if prospect.last_contacted_at else None,
                "campaign_name": campaign.name if campaign else None,
                "notes": prospect.notes
            },
            "email_history": email_history,
            "total_emails_sent": len(email_history)
        }
