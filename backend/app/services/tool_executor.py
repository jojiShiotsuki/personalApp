from typing import Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.task import Task
from app.models.crm import Deal, Contact

class ToolExecutor:
    def __init__(self, db: Session):
        self.db = db

    def execute(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call and return results"""

        # Map tool names to methods
        handlers = {
            "get_tasks": self._get_tasks,
            "create_task": self._create_task,
            "update_task": self._update_task,
            "get_deals": self._get_deals,
            "create_deal": self._create_deal,
            "get_contacts": self._get_contacts,
            "create_contact": self._create_contact,
        }

        handler = handlers.get(tool_name)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            return handler(tool_input)
        except Exception as e:
            return {"error": str(e)}

    # Task tools
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
            priority=params.get("priority", "medium"),
            status="pending"
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

    # Deal tools
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
                    "value": d.value,
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

    # Contact tools
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
