from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional


class GenerateCombinationsRequest(BaseModel):
    country: str
    niche: str

    @field_validator('country', 'niche')
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()


class SearchPlannerCombinationResponse(BaseModel):
    id: int
    country: str
    city: str
    niche: str
    is_searched: bool
    searched_at: Optional[datetime] = None
    leads_found: int
    linkedin_searched: bool = False
    linkedin_searched_at: Optional[datetime] = None
    linkedin_leads_found: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateCombinationsResponse(BaseModel):
    created: int
    already_existed: int
    total: int


class SearchPlannerStatsResponse(BaseModel):
    total: int
    searched: int
    not_searched: int
    total_leads_found: int
    linkedin_searched: int = 0
    linkedin_not_searched: int = 0
    linkedin_leads_found: int = 0


class MarkSearchedRequest(BaseModel):
    leads_found: int = 0
