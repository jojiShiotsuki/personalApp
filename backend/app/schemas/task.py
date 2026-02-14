from pydantic import BaseModel, Field, model_validator, field_validator
from datetime import datetime, date, time
from typing import Optional, List, Any
import json
from app.models.task import TaskPriority, TaskStatus, RecurrenceType

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING
    goal_id: Optional[int] = None
    project_id: Optional[int] = None
    sprint_day_id: Optional[int] = None
    phase: Optional[str] = None

    # Recurrence fields
    is_recurring: bool = False
    recurrence_type: Optional[RecurrenceType] = None
    recurrence_interval: Optional[int] = Field(None, ge=1, description="Repeat every N days/weeks/months/years")
    recurrence_days: Optional[List[str]] = None
    recurrence_end_date: Optional[date] = None
    recurrence_count: Optional[int] = Field(None, ge=1, description="Number of occurrences to create")

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    goal_id: Optional[int] = None
    project_id: Optional[int] = None
    sprint_day_id: Optional[int] = None
    phase: Optional[str] = None

    # Recurrence fields
    is_recurring: Optional[bool] = None
    recurrence_type: Optional[RecurrenceType] = None
    recurrence_interval: Optional[int] = Field(None, ge=1)
    recurrence_days: Optional[List[str]] = None
    recurrence_end_date: Optional[date] = None
    recurrence_count: Optional[int] = Field(None, ge=1)

class TaskLinkBase(BaseModel):
    url: str = Field(..., min_length=1, max_length=2000)
    label: Optional[str] = Field(None, max_length=255)

class TaskLinkCreate(TaskLinkBase):
    pass

class TaskLinkResponse(TaskLinkBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class TaskResponse(TaskBase):
    id: int
    phase: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    links: List[TaskLinkResponse] = []

    # Additional recurrence tracking fields
    occurrences_created: int = 0
    parent_task_id: Optional[int] = None

    @field_validator('recurrence_days', mode='before')
    @classmethod
    def parse_recurrence_days(cls, v: Any) -> Optional[List[str]]:
        """Parse recurrence_days from JSON string if needed."""
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else None
            except json.JSONDecodeError:
                return None
        return None

    class Config:
        from_attributes = True

class TaskParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)

class TaskBulkParseRequest(BaseModel):
    """Request schema for bulk task parsing endpoint.

    Accepts multiple task descriptions and parses them using the
    existing TaskParser service. Supports various formats including
    bulleted lists, numbered lists, and plain text.
    """

    lines: List[str] = Field(
        ...,
        min_length=1,  # Require at least one line
        max_length=500,  # Support large 90-day plans
        description="List of task descriptions to parse (one per line)"
    )

    @model_validator(mode='after')
    def validate_lines_content(self) -> 'TaskBulkParseRequest':
        # Filter out empty/whitespace-only lines
        non_empty_lines = [line.strip() for line in self.lines if line.strip()]

        if not non_empty_lines:
            raise ValueError("At least one non-empty task line is required")

        # Check individual line length (matching TaskParseRequest max_length=500)
        for i, line in enumerate(non_empty_lines):
            if len(line) > 500:
                raise ValueError(
                    f"Line {i+1} exceeds maximum length of 500 characters"
                )

        self.lines = non_empty_lines
        return self

    class Config:
        json_schema_extra = {
            "example": {
                "lines": [
                    "- Meeting tomorrow at 3pm",
                    "Call John high priority",
                    "Review proposal Friday"
                ]
            }
        }
