# backend/app/schemas/coach.py
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class InsightType(str, Enum):
    ACTION = "action"
    TIME = "time"
    PATTERN = "pattern"


class InsightPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CoachInsightResponse(BaseModel):
    id: int
    type: InsightType
    priority: InsightPriority
    message: str
    suggested_action: Optional[str] = None
    action_params: Optional[dict[str, Any]] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    seen: bool
    dismissed: bool
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CheckInsightRequest(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class CoachSettingsRequest(BaseModel):
    coach_level: int  # 1, 2, or 3
    coach_enabled: bool = True
    stale_lead_days: int = 7
    stuck_deal_days: int = 14


class CoachSettingsResponse(BaseModel):
    coach_level: int
    coach_enabled: bool
    stale_lead_days: int
    stuck_deal_days: int
