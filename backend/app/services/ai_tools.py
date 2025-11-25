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
                    "enum": ["pending", "in_progress", "completed", "delayed"],
                    "description": "Filter by task status"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
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
                    "description": "Task title/description (max 255 characters)",
                    "maxLength": 255
                },
                "due_date": {
                    "type": "string",
                    "description": "Due date in YYYY-MM-DD format"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
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
                "title": {"type": "string", "maxLength": 255},
                "status": {"type": "string", "enum": ["pending", "in_progress", "completed", "delayed"]},
                "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                "due_date": {"type": "string"}
            },
            "required": ["task_id"]
        }
    },
    {
        "name": "delete_task",
        "description": "Delete a task by ID",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "ID of the task to delete"
                }
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
                    "enum": ["lead", "prospect", "proposal", "negotiation", "closed_won", "closed_lost"],
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
                "title": {"type": "string", "description": "Deal title", "maxLength": 255},
                "value": {"type": "number", "description": "Deal value in dollars"},
                "contact_id": {"type": "integer", "description": "Associated contact ID"},
                "stage": {
                    "type": "string",
                    "enum": ["lead", "prospect", "proposal", "negotiation", "closed_won", "closed_lost"],
                    "default": "lead"
                }
            },
            "required": ["title"]
        }
    },
    {
        "name": "update_deal",
        "description": "Update an existing deal's properties",
        "input_schema": {
            "type": "object",
            "properties": {
                "deal_id": {
                    "type": "integer",
                    "description": "ID of the deal to update"
                },
                "title": {"type": "string", "maxLength": 255},
                "value": {"type": "number"},
                "stage": {
                    "type": "string",
                    "enum": ["lead", "prospect", "proposal", "negotiation", "closed_won", "closed_lost"]
                }
            },
            "required": ["deal_id"]
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
                "name": {"type": "string", "description": "Contact name", "maxLength": 255},
                "email": {"type": "string", "description": "Email address", "maxLength": 255},
                "phone": {"type": "string", "description": "Phone number", "maxLength": 50},
                "company": {"type": "string", "description": "Company name", "maxLength": 255}
            },
            "required": ["name"]
        }
    }
]

PROJECT_TOOLS = [
    {
        "name": "get_projects",
        "description": "Get list of all projects with their progress",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 10}
            }
        }
    },
    {
        "name": "create_project",
        "description": "Create a new project",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Project name", "maxLength": 255},
                "description": {"type": "string", "description": "Project description"}
            },
            "required": ["name"]
        }
    }
]

GOAL_TOOLS = [
    {
        "name": "get_goals",
        "description": "Get list of goals, optionally filtered by year",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer", "description": "Filter by year"},
                "limit": {"type": "integer", "default": 10}
            }
        }
    },
    {
        "name": "create_goal",
        "description": "Create a new goal",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Goal title", "maxLength": 255},
                "description": {"type": "string", "description": "Goal description"},
                "target_date": {"type": "string", "description": "Target date in YYYY-MM-DD format"},
                "category": {
                    "type": "string",
                    "enum": ["health", "career", "finance", "personal", "education", "relationships"],
                    "description": "Goal category"
                }
            },
            "required": ["title"]
        }
    }
]

def get_tools_for_page(page: str) -> List[Dict[str, Any]]:
    """Return all tools regardless of page to allow cross-functional assistance"""
    return TASK_TOOLS + DEAL_TOOLS + CONTACT_TOOLS + PROJECT_TOOLS + GOAL_TOOLS
