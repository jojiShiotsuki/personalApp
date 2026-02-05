from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List


# Activity Types
class OutreachActivityType:
    COLD_EMAIL = "cold_email"
    LINKEDIN = "linkedin"
    CALL = "call"
    LOOM = "loom"


# Single activity metric
class ActivityMetric(BaseModel):
    current: int
    target: int
    percentage: float

    @classmethod
    def from_values(cls, current: int, target: int) -> "ActivityMetric":
        percentage = min(100.0, (current / target * 100) if target > 0 else 0)
        return cls(current=current, target=target, percentage=percentage)


# Today's stats response
class DailyOutreachStatsResponse(BaseModel):
    date: date
    cold_emails: ActivityMetric
    linkedin: ActivityMetric
    calls: ActivityMetric
    looms: ActivityMetric
    all_targets_met: bool

    class Config:
        from_attributes = True


# Streak response
class OutreachStreakResponse(BaseModel):
    current_streak: int
    best_streak: int
    last_completed_date: Optional[date] = None


# Weekly summary item
class DailySummaryItem(BaseModel):
    date: date
    day_name: str  # Mon, Tue, etc.
    cold_emails: int
    linkedin: int
    calls: int
    looms: int
    targets_met: bool


# Weekly summary response
class WeeklySummaryResponse(BaseModel):
    days: List[DailySummaryItem]
    total_cold_emails: int
    total_linkedin: int
    total_calls: int
    total_looms: int
    days_met_target: int


# Log activity request
class LogActivityRequest(BaseModel):
    contact_id: Optional[int] = None
    notes: Optional[str] = None


# Log activity response
class LogActivityResponse(BaseModel):
    message: str
    activity_type: str
    new_count: int
    target: int
    interaction_id: Optional[int] = None


# Settings schemas
class OutreachSettingsBase(BaseModel):
    daily_cold_email_target: int = Field(default=10, ge=1, le=100)
    daily_linkedin_target: int = Field(default=10, ge=1, le=100)
    daily_call_target: int = Field(default=5, ge=1, le=50)
    daily_loom_target: int = Field(default=2, ge=1, le=20)


class OutreachSettingsUpdate(BaseModel):
    daily_cold_email_target: Optional[int] = Field(None, ge=1, le=100)
    daily_linkedin_target: Optional[int] = Field(None, ge=1, le=100)
    daily_call_target: Optional[int] = Field(None, ge=1, le=50)
    daily_loom_target: Optional[int] = Field(None, ge=1, le=20)


class OutreachSettingsResponse(OutreachSettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
