from .task import TaskCreate, TaskUpdate, TaskResponse, TaskParseRequest
from .crm import (
    ContactCreate, ContactUpdate, ContactResponse,
    DealCreate, DealUpdate, DealResponse,
    InteractionCreate, InteractionUpdate, InteractionResponse
)
from .project import ProjectCreate, ProjectUpdate, ProjectResponse

__all__ = [
    "TaskCreate", "TaskUpdate", "TaskResponse", "TaskParseRequest",
    "ContactCreate", "ContactUpdate", "ContactResponse",
    "DealCreate", "DealUpdate", "DealResponse",
    "InteractionCreate", "InteractionUpdate", "InteractionResponse",
    "ProjectCreate", "ProjectUpdate", "ProjectResponse"
]
