from typing import List, Dict, Any

# Tool definitions in Anthropic's format
TASK_TOOLS = [
    {
        "name": "get_tasks",
        "description": "Get list of tasks, optionally filtered by status, priority, or date range",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed"],
                    "description": "Filter by task status"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "Filter by priority level"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of tasks to return",
                    "default": 10
                }
            }
        }
    },
    {
        "name": "create_task",
        "description": "Create a new task with title and optional details",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Task title/description"
                },
                "due_date": {
                    "type": "string",
                    "description": "Due date in YYYY-MM-DD format"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "Task priority",
                    "default": "medium"
                }
            },
            "required": ["title"]
        }
    },
    {
        "name": "update_task",
        "description": "Update an existing task's properties",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "ID of the task to update"
                },
                "title": {"type": "string"},
                "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "due_date": {"type": "string"}
            },
            "required": ["task_id"]
        }
    }
]

DEAL_TOOLS = [
    {
        "name": "get_deals",
        "description": "Get list of deals, optionally filtered by stage",
        "input_schema": {
            "type": "object",
            "properties": {
                "stage": {
                    "type": "string",
                    "enum": ["lead", "qualified", "proposal", "negotiation", "closed"],
                    "description": "Filter by deal stage"
                },
                "limit": {"type": "integer", "default": 10}
            }
        }
    },
    {
        "name": "create_deal",
        "description": "Create a new deal",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Deal title"},
                "value": {"type": "number", "description": "Deal value in dollars"},
                "contact_id": {"type": "integer", "description": "Associated contact ID"},
                "stage": {
                    "type": "string",
                    "enum": ["lead", "qualified", "proposal", "negotiation", "closed"],
                    "default": "lead"
                }
            },
            "required": ["title"]
        }
    }
]

CONTACT_TOOLS = [
    {
        "name": "get_contacts",
        "description": "Get list of contacts, optionally filtered by search term",
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Search by name or email"},
                "limit": {"type": "integer", "default": 10}
            }
        }
    },
    {
        "name": "create_contact",
        "description": "Create a new contact",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Contact name"},
                "email": {"type": "string", "description": "Email address"},
                "phone": {"type": "string", "description": "Phone number"},
                "company": {"type": "string", "description": "Company name"}
            },
            "required": ["name"]
        }
    }
]

def get_tools_for_page(page: str) -> List[Dict[str, Any]]:
    """Return appropriate tools based on current page context"""
    tools_map = {
        "tasks": TASK_TOOLS,
        "deals": DEAL_TOOLS,
        "contacts": CONTACT_TOOLS,
    }
    return tools_map.get(page, [])
