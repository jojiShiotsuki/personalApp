from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# Niche Schemas
class NicheBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class NicheCreate(NicheBase):
    pass


class NicheResponse(NicheBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Situation Schemas
class SituationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class SituationCreate(SituationBase):
    pass


class SituationResponse(SituationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Template Schemas
class TemplateBase(BaseModel):
    niche_id: int
    situation_id: int
    dm_number: int = Field(default=1, ge=1, le=5)  # 1-5 for DM sequence
    content: str = Field(..., min_length=1)


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    content: str = Field(..., min_length=1)


class TemplateResponse(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    niche: Optional[NicheResponse] = None
    situation: Optional[SituationResponse] = None

    class Config:
        from_attributes = True


# Add to Pipeline Schema
class AddToPipelineRequest(BaseModel):
    name: str = Field(..., min_length=1)
    niche: str
    situation: str


class AddToPipelineResponse(BaseModel):
    contact_id: int
    deal_id: int
    message: str
