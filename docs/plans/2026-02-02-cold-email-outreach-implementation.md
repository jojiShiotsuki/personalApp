# Cold Email Outreach System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a high-efficiency cold email outreach system with CSV import, daily queue, and CRM conversion.

**Architecture:** New database tables for campaigns/prospects/templates. New API routes under `/api/outreach/campaigns`. New frontend page `ColdOutreach.tsx` with queue-based workflow. Conversion creates CRM Contact + Deal.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), React + TanStack Query + TailwindCSS (frontend)

---

## Task 1: Backend Models

**Files:**
- Modify: `backend/app/models/outreach.py`

**Step 1: Add new models to outreach.py**

Add these models after the existing `OutreachTemplate` class:

```python
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ProspectStatus(str, enum.Enum):
    QUEUED = "queued"
    IN_SEQUENCE = "in_sequence"
    REPLIED = "replied"
    NOT_INTERESTED = "not_interested"
    CONVERTED = "converted"


class ResponseType(str, enum.Enum):
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    OTHER = "other"


class CampaignStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class OutreachCampaign(Base):
    __tablename__ = "outreach_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.ACTIVE)
    step_1_delay = Column(Integer, default=0)  # days
    step_2_delay = Column(Integer, default=3)
    step_3_delay = Column(Integer, default=5)
    step_4_delay = Column(Integer, default=7)
    step_5_delay = Column(Integer, default=7)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prospects = relationship("OutreachProspect", back_populates="campaign", cascade="all, delete-orphan")
    email_templates = relationship("OutreachEmailTemplate", back_populates="campaign", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OutreachCampaign(id={self.id}, name={self.name})>"


class OutreachProspect(Base):
    __tablename__ = "outreach_prospects"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False)
    agency_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False)
    website = Column(String(500), nullable=True)
    niche = Column(String(100), nullable=True)
    custom_fields = Column(JSON, nullable=True)
    status = Column(Enum(ProspectStatus), default=ProspectStatus.QUEUED)
    current_step = Column(Integer, default=1)
    next_action_date = Column(Date, nullable=True)
    last_contacted_at = Column(DateTime, nullable=True)
    response_type = Column(Enum(ResponseType), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("OutreachCampaign", back_populates="prospects")

    def __repr__(self):
        return f"<OutreachProspect(id={self.id}, agency={self.agency_name}, status={self.status})>"


class OutreachEmailTemplate(Base):
    __tablename__ = "outreach_email_templates"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)  # 1-5
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("OutreachCampaign", back_populates="email_templates")

    def __repr__(self):
        return f"<OutreachEmailTemplate(id={self.id}, campaign_id={self.campaign_id}, step={self.step_number})>"
```

**Step 2: Commit**

```bash
git add backend/app/models/outreach.py
git commit -m "feat(outreach): add campaign, prospect, and email template models"
```

---

## Task 2: Database Migration

**Files:**
- Create: `backend/alembic/versions/xxxx_add_cold_outreach_tables.py` (auto-generated)

**Step 1: Generate migration**

```bash
cd backend
venv/Scripts/alembic revision --autogenerate -m "add cold outreach tables"
```

**Step 2: Review the generated migration file**

Open the file and verify it creates:
- `outreach_campaigns` table
- `outreach_prospects` table
- `outreach_email_templates` table
- Appropriate indexes on `campaign_id`, `status`, `next_action_date`

**Step 3: Run migration**

```bash
venv/Scripts/alembic upgrade head
```

**Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat(outreach): add migration for cold outreach tables"
```

---

## Task 3: Backend Schemas

**Files:**
- Modify: `backend/app/schemas/outreach.py`

**Step 1: Add new schemas after existing ones**

```python
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, date
from typing import Optional, List, Any
from enum import Enum


# Enums for schemas
class ProspectStatus(str, Enum):
    QUEUED = "queued"
    IN_SEQUENCE = "in_sequence"
    REPLIED = "replied"
    NOT_INTERESTED = "not_interested"
    CONVERTED = "converted"


class ResponseType(str, Enum):
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    OTHER = "other"


class CampaignStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


# Campaign Schemas
class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    step_1_delay: int = Field(default=0, ge=0)
    step_2_delay: int = Field(default=3, ge=0)
    step_3_delay: int = Field(default=5, ge=0)
    step_4_delay: int = Field(default=7, ge=0)
    step_5_delay: int = Field(default=7, ge=0)


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[CampaignStatus] = None
    step_1_delay: Optional[int] = Field(None, ge=0)
    step_2_delay: Optional[int] = Field(None, ge=0)
    step_3_delay: Optional[int] = Field(None, ge=0)
    step_4_delay: Optional[int] = Field(None, ge=0)
    step_5_delay: Optional[int] = Field(None, ge=0)


class CampaignResponse(CampaignBase):
    id: int
    status: CampaignStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CampaignStats(BaseModel):
    total_prospects: int
    queued: int
    in_sequence: int
    replied: int
    not_interested: int
    converted: int
    to_contact_today: int
    response_rate: float
    total_pipeline_value: float


class CampaignWithStats(CampaignResponse):
    stats: CampaignStats


# Prospect Schemas
class ProspectBase(BaseModel):
    agency_name: str = Field(..., min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    email: str = Field(..., min_length=1, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    niche: Optional[str] = Field(None, max_length=100)
    custom_fields: Optional[dict] = None


class ProspectCreate(ProspectBase):
    pass


class ProspectUpdate(BaseModel):
    agency_name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, min_length=1, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    niche: Optional[str] = Field(None, max_length=100)
    custom_fields: Optional[dict] = None
    status: Optional[ProspectStatus] = None
    current_step: Optional[int] = Field(None, ge=1, le=5)
    next_action_date: Optional[date] = None
    notes: Optional[str] = None


class ProspectResponse(ProspectBase):
    id: int
    campaign_id: int
    status: ProspectStatus
    current_step: int
    next_action_date: Optional[date]
    last_contacted_at: Optional[datetime]
    response_type: Optional[ResponseType]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# CSV Import Schema
class CsvColumnMapping(BaseModel):
    agency_name: str  # CSV column name
    contact_name: Optional[str] = None
    email: str
    website: Optional[str] = None
    niche: Optional[str] = None


class CsvImportRequest(BaseModel):
    column_mapping: CsvColumnMapping
    data: List[dict]  # Raw CSV rows as dicts


class CsvImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    errors: List[str]


# Mark Sent Schema
class MarkSentResponse(BaseModel):
    prospect: ProspectResponse
    next_action_date: Optional[date]
    message: str


# Mark Replied Schema
class MarkRepliedRequest(BaseModel):
    response_type: ResponseType
    notes: Optional[str] = None


class MarkRepliedResponse(BaseModel):
    prospect: ProspectResponse
    contact_id: Optional[int] = None
    deal_id: Optional[int] = None
    message: str


# Email Template Schemas
class EmailTemplateBase(BaseModel):
    step_number: int = Field(..., ge=1, le=5)
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1)


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=500)
    body: Optional[str] = Field(None, min_length=1)


class EmailTemplateResponse(EmailTemplateBase):
    id: int
    campaign_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Rendered Email Schema (with variables filled in)
class RenderedEmail(BaseModel):
    to_email: str
    subject: str
    body: str
    prospect_id: int
    step_number: int
```

**Step 2: Commit**

```bash
git add backend/app/schemas/outreach.py
git commit -m "feat(outreach): add schemas for campaigns, prospects, templates"
```

---

## Task 4: Backend Campaign Routes

**Files:**
- Create: `backend/app/routes/cold_outreach.py`

**Step 1: Create the campaign routes file**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, timedelta

from app.database import get_db
from app.models.outreach import (
    OutreachCampaign, OutreachProspect, OutreachEmailTemplate,
    ProspectStatus, ResponseType, CampaignStatus
)
from app.models.crm import Contact, Deal, ContactStatus, DealStage, Interaction, InteractionType
from app.schemas.outreach import (
    CampaignCreate, CampaignUpdate, CampaignResponse, CampaignWithStats, CampaignStats,
    ProspectCreate, ProspectUpdate, ProspectResponse,
    CsvImportRequest, CsvImportResponse,
    MarkSentResponse, MarkRepliedRequest, MarkRepliedResponse,
    EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateResponse,
    RenderedEmail,
)

router = APIRouter(prefix="/api/outreach/campaigns", tags=["cold-outreach"])


# ============== CAMPAIGNS ==============

@router.get("/", response_model=List[CampaignResponse])
def list_campaigns(
    status: Optional[CampaignStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(OutreachCampaign)
    if status:
        query = query.filter(OutreachCampaign.status == status)
    else:
        # By default, only show active campaigns
        query = query.filter(OutreachCampaign.status == CampaignStatus.ACTIVE)
    return query.order_by(OutreachCampaign.created_at.desc()).all()


@router.post("/", response_model=CampaignResponse, status_code=201)
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db)):
    campaign = OutreachCampaign(**data.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignWithStats)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Calculate stats
    prospects = db.query(OutreachProspect).filter(OutreachProspect.campaign_id == campaign_id)
    total = prospects.count()

    today = date.today()
    stats = CampaignStats(
        total_prospects=total,
        queued=prospects.filter(OutreachProspect.status == ProspectStatus.QUEUED).count(),
        in_sequence=prospects.filter(OutreachProspect.status == ProspectStatus.IN_SEQUENCE).count(),
        replied=prospects.filter(OutreachProspect.status == ProspectStatus.REPLIED).count(),
        not_interested=prospects.filter(OutreachProspect.status == ProspectStatus.NOT_INTERESTED).count(),
        converted=prospects.filter(OutreachProspect.status == ProspectStatus.CONVERTED).count(),
        to_contact_today=prospects.filter(
            OutreachProspect.next_action_date <= today,
            OutreachProspect.status.in_([ProspectStatus.QUEUED, ProspectStatus.IN_SEQUENCE])
        ).count(),
        response_rate=0.0,
        total_pipeline_value=0.0,  # TODO: Calculate from converted deals
    )

    # Calculate response rate
    contacted = stats.in_sequence + stats.replied + stats.not_interested + stats.converted
    if contacted > 0:
        stats.response_rate = round((stats.replied + stats.converted) / contacted * 100, 1)

    return CampaignWithStats(
        **campaign.__dict__,
        stats=stats
    )


@router.put("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(campaign_id: int, data: CampaignUpdate, db: Session = Depends(get_db)):
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)

    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()


# ============== PROSPECTS ==============

@router.get("/{campaign_id}/prospects", response_model=List[ProspectResponse])
def list_prospects(
    campaign_id: int,
    status: Optional[ProspectStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(OutreachProspect).filter(OutreachProspect.campaign_id == campaign_id)
    if status:
        query = query.filter(OutreachProspect.status == status)
    return query.order_by(OutreachProspect.next_action_date.asc().nullslast()).all()


@router.get("/{campaign_id}/prospects/today", response_model=List[ProspectResponse])
def get_today_queue(campaign_id: int, db: Session = Depends(get_db)):
    """Get prospects that need action today (next_action_date <= today)"""
    today = date.today()
    return db.query(OutreachProspect).filter(
        OutreachProspect.campaign_id == campaign_id,
        OutreachProspect.next_action_date <= today,
        OutreachProspect.status.in_([ProspectStatus.QUEUED, ProspectStatus.IN_SEQUENCE])
    ).order_by(
        OutreachProspect.current_step.asc(),
        OutreachProspect.next_action_date.asc()
    ).all()


@router.post("/{campaign_id}/prospects", response_model=ProspectResponse, status_code=201)
def create_prospect(campaign_id: int, data: ProspectCreate, db: Session = Depends(get_db)):
    # Verify campaign exists
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    prospect = OutreachProspect(
        campaign_id=campaign_id,
        next_action_date=date.today(),
        **data.model_dump()
    )
    db.add(prospect)
    db.commit()
    db.refresh(prospect)
    return prospect


@router.post("/{campaign_id}/prospects/import", response_model=CsvImportResponse)
def import_prospects(campaign_id: int, data: CsvImportRequest, db: Session = Depends(get_db)):
    """Bulk import prospects from CSV data"""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    imported = 0
    skipped = 0
    errors = []
    today = date.today()

    for i, row in enumerate(data.data):
        try:
            mapping = data.column_mapping

            # Extract fields using mapping
            agency_name = row.get(mapping.agency_name, "").strip()
            email = row.get(mapping.email, "").strip()

            if not agency_name or not email:
                errors.append(f"Row {i+1}: Missing agency_name or email")
                skipped += 1
                continue

            # Check for duplicate email in this campaign
            existing = db.query(OutreachProspect).filter(
                OutreachProspect.campaign_id == campaign_id,
                OutreachProspect.email == email
            ).first()

            if existing:
                skipped += 1
                continue

            prospect = OutreachProspect(
                campaign_id=campaign_id,
                agency_name=agency_name,
                contact_name=row.get(mapping.contact_name, "").strip() if mapping.contact_name else None,
                email=email,
                website=row.get(mapping.website, "").strip() if mapping.website else None,
                niche=row.get(mapping.niche, "").strip() if mapping.niche else None,
                custom_fields={k: v for k, v in row.items() if k not in [
                    mapping.agency_name, mapping.email,
                    mapping.contact_name, mapping.website, mapping.niche
                ]},
                next_action_date=today,
            )
            db.add(prospect)
            imported += 1

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            skipped += 1

    db.commit()

    return CsvImportResponse(
        imported_count=imported,
        skipped_count=skipped,
        errors=errors[:10]  # Limit error messages
    )


@router.put("/prospects/{prospect_id}", response_model=ProspectResponse)
def update_prospect(prospect_id: int, data: ProspectUpdate, db: Session = Depends(get_db)):
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(prospect, key, value)

    db.commit()
    db.refresh(prospect)
    return prospect


@router.delete("/prospects/{prospect_id}", status_code=204)
def delete_prospect(prospect_id: int, db: Session = Depends(get_db)):
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    db.delete(prospect)
    db.commit()


@router.post("/prospects/{prospect_id}/mark-sent", response_model=MarkSentResponse)
def mark_sent(prospect_id: int, db: Session = Depends(get_db)):
    """Mark email as sent and schedule next follow-up"""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    campaign = prospect.campaign

    # Update last contacted
    prospect.last_contacted_at = datetime.utcnow()
    prospect.status = ProspectStatus.IN_SEQUENCE

    # Move to next step
    current = prospect.current_step
    if current < 5:
        prospect.current_step = current + 1

        # Get delay for next step
        delays = {
            2: campaign.step_2_delay,
            3: campaign.step_3_delay,
            4: campaign.step_4_delay,
            5: campaign.step_5_delay,
        }
        delay_days = delays.get(prospect.current_step, 3)
        prospect.next_action_date = date.today() + timedelta(days=delay_days)
        message = f"Marked sent. Follow-up #{prospect.current_step} scheduled for {prospect.next_action_date}"
    else:
        # Completed sequence with no response
        prospect.status = ProspectStatus.NOT_INTERESTED
        prospect.next_action_date = None
        message = "Sequence complete. Marked as no response."

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


@router.post("/prospects/{prospect_id}/mark-replied", response_model=MarkRepliedResponse)
def mark_replied(prospect_id: int, data: MarkRepliedRequest, db: Session = Depends(get_db)):
    """Mark prospect as replied and optionally convert to CRM"""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect.status = ProspectStatus.REPLIED
    prospect.response_type = data.response_type
    prospect.notes = data.notes
    prospect.next_action_date = None

    contact_id = None
    deal_id = None
    message = "Marked as replied."

    if data.response_type == ResponseType.INTERESTED:
        # Create CRM Contact
        contact = Contact(
            name=prospect.agency_name,
            email=prospect.email,
            company=prospect.agency_name,
            source="Cold Outreach",
            notes=f"Campaign: {prospect.campaign.name}\nNiche: {prospect.niche or 'N/A'}\n\n{data.notes or ''}",
            status=ContactStatus.LEAD,
        )
        db.add(contact)
        db.flush()  # Get contact.id

        # Create Deal
        deal = Deal(
            contact_id=contact.id,
            title=f"{prospect.agency_name} - Cold Outreach",
            stage=DealStage.LEAD,
            probability=10,
        )
        db.add(deal)
        db.flush()

        # Log interaction
        interaction = Interaction(
            contact_id=contact.id,
            type=InteractionType.EMAIL,
            subject="Cold outreach response - Interested",
            notes=data.notes,
            interaction_date=datetime.utcnow(),
        )
        db.add(interaction)

        prospect.status = ProspectStatus.CONVERTED
        contact_id = contact.id
        deal_id = deal.id
        message = f"Converted! Created contact and deal for {prospect.agency_name}"

    elif data.response_type == ResponseType.NOT_INTERESTED:
        prospect.status = ProspectStatus.NOT_INTERESTED
        message = "Marked as not interested."

    db.commit()
    db.refresh(prospect)

    return MarkRepliedResponse(
        prospect=prospect,
        contact_id=contact_id,
        deal_id=deal_id,
        message=message
    )


# ============== EMAIL TEMPLATES ==============

@router.get("/{campaign_id}/templates", response_model=List[EmailTemplateResponse])
def list_email_templates(campaign_id: int, db: Session = Depends(get_db)):
    return db.query(OutreachEmailTemplate).filter(
        OutreachEmailTemplate.campaign_id == campaign_id
    ).order_by(OutreachEmailTemplate.step_number).all()


@router.post("/{campaign_id}/templates", response_model=EmailTemplateResponse, status_code=201)
def create_or_update_email_template(
    campaign_id: int,
    data: EmailTemplateCreate,
    db: Session = Depends(get_db)
):
    """Create or update email template for a step"""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Check if template exists for this step
    existing = db.query(OutreachEmailTemplate).filter(
        OutreachEmailTemplate.campaign_id == campaign_id,
        OutreachEmailTemplate.step_number == data.step_number
    ).first()

    if existing:
        existing.subject = data.subject
        existing.body = data.body
        db.commit()
        db.refresh(existing)
        return existing

    template = OutreachEmailTemplate(
        campaign_id=campaign_id,
        **data.model_dump()
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/templates/{template_id}", status_code=204)
def delete_email_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(OutreachEmailTemplate).filter(OutreachEmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()


@router.get("/prospects/{prospect_id}/render-email", response_model=RenderedEmail)
def render_email(prospect_id: int, db: Session = Depends(get_db)):
    """Get the rendered email for a prospect's current step"""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    template = db.query(OutreachEmailTemplate).filter(
        OutreachEmailTemplate.campaign_id == prospect.campaign_id,
        OutreachEmailTemplate.step_number == prospect.current_step
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail=f"No template for step {prospect.current_step}")

    # Replace variables
    contact_name = prospect.contact_name or prospect.agency_name

    subject = template.subject
    subject = subject.replace("{agency_name}", prospect.agency_name)
    subject = subject.replace("{contact_name}", contact_name)
    subject = subject.replace("{niche}", prospect.niche or "")
    subject = subject.replace("{website}", prospect.website or "")

    body = template.body
    body = body.replace("{agency_name}", prospect.agency_name)
    body = body.replace("{contact_name}", contact_name)
    body = body.replace("{niche}", prospect.niche or "")
    body = body.replace("{website}", prospect.website or "")

    return RenderedEmail(
        to_email=prospect.email,
        subject=subject,
        body=body,
        prospect_id=prospect.id,
        step_number=prospect.current_step
    )
```

**Step 2: Commit**

```bash
git add backend/app/routes/cold_outreach.py
git commit -m "feat(outreach): add campaign, prospect, and template API routes"
```

---

## Task 5: Register Routes in Main

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Import and register the new router**

Add this import at the top with other route imports:

```python
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects, social_content, dashboard, time, outreach, cold_outreach
```

Add this line after `app.include_router(outreach.router)`:

```python
app.include_router(cold_outreach.router)
```

**Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(outreach): register cold outreach routes"
```

---

## Task 6: Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add new types at the end of the file**

```typescript
// Cold Outreach Types
export enum ProspectStatus {
  QUEUED = "queued",
  IN_SEQUENCE = "in_sequence",
  REPLIED = "replied",
  NOT_INTERESTED = "not_interested",
  CONVERTED = "converted",
}

export enum ResponseType {
  INTERESTED = "interested",
  NOT_INTERESTED = "not_interested",
  OTHER = "other",
}

export enum CampaignStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export interface OutreachCampaign {
  id: number;
  name: string;
  status: CampaignStatus;
  step_1_delay: number;
  step_2_delay: number;
  step_3_delay: number;
  step_4_delay: number;
  step_5_delay: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  total_prospects: number;
  queued: number;
  in_sequence: number;
  replied: number;
  not_interested: number;
  converted: number;
  to_contact_today: number;
  response_rate: number;
  total_pipeline_value: number;
}

export interface CampaignWithStats extends OutreachCampaign {
  stats: CampaignStats;
}

export interface CampaignCreate {
  name: string;
  step_1_delay?: number;
  step_2_delay?: number;
  step_3_delay?: number;
  step_4_delay?: number;
  step_5_delay?: number;
}

export interface OutreachProspect {
  id: number;
  campaign_id: number;
  agency_name: string;
  contact_name?: string;
  email: string;
  website?: string;
  niche?: string;
  custom_fields?: Record<string, any>;
  status: ProspectStatus;
  current_step: number;
  next_action_date?: string;
  last_contacted_at?: string;
  response_type?: ResponseType;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProspectCreate {
  agency_name: string;
  contact_name?: string;
  email: string;
  website?: string;
  niche?: string;
  custom_fields?: Record<string, any>;
}

export interface CsvColumnMapping {
  agency_name: string;
  contact_name?: string;
  email: string;
  website?: string;
  niche?: string;
}

export interface CsvImportRequest {
  column_mapping: CsvColumnMapping;
  data: Record<string, any>[];
}

export interface CsvImportResponse {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

export interface MarkRepliedRequest {
  response_type: ResponseType;
  notes?: string;
}

export interface MarkRepliedResponse {
  prospect: OutreachProspect;
  contact_id?: number;
  deal_id?: number;
  message: string;
}

export interface OutreachEmailTemplate {
  id: number;
  campaign_id: number;
  step_number: number;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateCreate {
  step_number: number;
  subject: string;
  body: string;
}

export interface RenderedEmail {
  to_email: string;
  subject: string;
  body: string;
  prospect_id: number;
  step_number: number;
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(outreach): add TypeScript types for cold outreach"
```

---

## Task 7: Frontend API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add imports at the top**

Add these to the type imports:

```typescript
import type {
  // ... existing imports ...
  OutreachCampaign,
  CampaignWithStats,
  CampaignCreate,
  OutreachProspect,
  ProspectCreate,
  CsvImportRequest,
  CsvImportResponse,
  MarkRepliedRequest,
  MarkRepliedResponse,
  OutreachEmailTemplate,
  EmailTemplateCreate,
  RenderedEmail,
} from '../types/index';
```

**Step 2: Add the cold outreach API at the end of the file**

```typescript
// Cold Outreach API
export const coldOutreachApi = {
  // Campaigns
  getCampaigns: async (): Promise<OutreachCampaign[]> => {
    const response = await api.get('/api/outreach/campaigns');
    return response.data;
  },

  getCampaign: async (id: number): Promise<CampaignWithStats> => {
    const response = await api.get(`/api/outreach/campaigns/${id}`);
    return response.data;
  },

  createCampaign: async (data: CampaignCreate): Promise<OutreachCampaign> => {
    const response = await api.post('/api/outreach/campaigns', data);
    return response.data;
  },

  updateCampaign: async (id: number, data: Partial<CampaignCreate>): Promise<OutreachCampaign> => {
    const response = await api.put(`/api/outreach/campaigns/${id}`, data);
    return response.data;
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await api.delete(`/api/outreach/campaigns/${id}`);
  },

  // Prospects
  getProspects: async (campaignId: number): Promise<OutreachProspect[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/prospects`);
    return response.data;
  },

  getTodayQueue: async (campaignId: number): Promise<OutreachProspect[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/prospects/today`);
    return response.data;
  },

  createProspect: async (campaignId: number, data: ProspectCreate): Promise<OutreachProspect> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects`, data);
    return response.data;
  },

  importProspects: async (campaignId: number, data: CsvImportRequest): Promise<CsvImportResponse> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/import`, data);
    return response.data;
  },

  updateProspect: async (prospectId: number, data: Partial<OutreachProspect>): Promise<OutreachProspect> => {
    const response = await api.put(`/api/outreach/campaigns/prospects/${prospectId}`, data);
    return response.data;
  },

  deleteProspect: async (prospectId: number): Promise<void> => {
    await api.delete(`/api/outreach/campaigns/prospects/${prospectId}`);
  },

  markSent: async (prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/mark-sent`);
    return response.data;
  },

  markReplied: async (prospectId: number, data: MarkRepliedRequest): Promise<MarkRepliedResponse> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/mark-replied`, data);
    return response.data;
  },

  // Email Templates
  getTemplates: async (campaignId: number): Promise<OutreachEmailTemplate[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/templates`);
    return response.data;
  },

  createTemplate: async (campaignId: number, data: EmailTemplateCreate): Promise<OutreachEmailTemplate> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/templates`, data);
    return response.data;
  },

  deleteTemplate: async (templateId: number): Promise<void> => {
    await api.delete(`/api/outreach/campaigns/templates/${templateId}`);
  },

  // Render email for prospect
  renderEmail: async (prospectId: number): Promise<RenderedEmail> => {
    const response = await api.get(`/api/outreach/campaigns/prospects/${prospectId}/render-email`);
    return response.data;
  },
};
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(outreach): add cold outreach API client"
```

---

## Task 8: Frontend ColdOutreach Page - Basic Structure

**Files:**
- Create: `frontend/src/pages/ColdOutreach.tsx`

**Step 1: Create the basic page structure**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type {
  OutreachCampaign,
  CampaignWithStats,
  OutreachProspect,
  OutreachEmailTemplate,
  ProspectStatus,
} from '@/types';
import {
  Mail,
  Plus,
  Upload,
  Settings2,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Copy,
  Check,
  MessageSquare,
  Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TabType = 'today' | 'all' | 'replied';

export default function ColdOutreach() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: coldOutreachApi.getCampaigns,
  });

  // Fetch selected campaign with stats
  const { data: campaign } = useQuery({
    queryKey: ['outreach-campaign', selectedCampaignId],
    queryFn: () => coldOutreachApi.getCampaign(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  // Fetch today's queue
  const { data: todayQueue = [] } = useQuery({
    queryKey: ['outreach-today-queue', selectedCampaignId],
    queryFn: () => coldOutreachApi.getTodayQueue(selectedCampaignId!),
    enabled: !!selectedCampaignId && activeTab === 'today',
  });

  // Fetch all prospects
  const { data: allProspects = [] } = useQuery({
    queryKey: ['outreach-prospects', selectedCampaignId],
    queryFn: () => coldOutreachApi.getProspects(selectedCampaignId!),
    enabled: !!selectedCampaignId && activeTab === 'all',
  });

  // Fetch replied prospects
  const { data: repliedProspects = [] } = useQuery({
    queryKey: ['outreach-replied', selectedCampaignId],
    queryFn: async () => {
      const all = await coldOutreachApi.getProspects(selectedCampaignId!);
      return all.filter(p => p.status === 'replied');
    },
    enabled: !!selectedCampaignId && activeTab === 'replied',
  });

  // Auto-select first campaign
  if (campaigns.length > 0 && !selectedCampaignId) {
    setSelectedCampaignId(campaigns[0].id);
  }

  const stats = campaign?.stats;

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />

        <div className="relative px-8 pt-8 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4">
            <Mail className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">Cold Email</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Outreach <span className="text-[--exec-accent]">Queue</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg">
                High-efficiency cold email campaigns
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Campaign Selector */}
              <select
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(e.target.value ? Number(e.target.value) : null)}
                className="px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] text-[--exec-text] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all"
              >
                <option value="">Select Campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button
                onClick={() => setIsNewCampaignOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
              >
                <Plus className="w-4 h-4" />
                New
              </button>

              {selectedCampaignId && (
                <>
                  <button
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Import CSV
                  </button>

                  <button
                    onClick={() => setIsTemplatesOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
                  >
                    <Settings2 className="w-4 h-4" />
                    Templates
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="px-8 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bento-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                <Clock className="w-6 h-6 text-[--exec-accent]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
                  {stats.to_contact_today}
                </p>
                <p className="text-sm text-[--exec-text-muted]">To Contact Today</p>
              </div>
            </div>

            <div className="bento-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Send className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
                  {stats.in_sequence + stats.replied + stats.converted + stats.not_interested}
                </p>
                <p className="text-sm text-[--exec-text-muted]">Emails Sent</p>
              </div>
            </div>

            <div className="bento-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
                  {stats.replied + stats.converted}
                  <span className="text-sm font-normal text-[--exec-text-muted] ml-1">
                    ({stats.response_rate}%)
                  </span>
                </p>
                <p className="text-sm text-[--exec-text-muted]">Replied</p>
              </div>
            </div>

            <div className="bento-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
                  {stats.converted}
                </p>
                <p className="text-sm text-[--exec-text-muted]">Converted</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {selectedCampaignId && (
        <div className="px-8">
          <div className="flex items-center gap-2 border-b border-[--exec-border]">
            {(['today', 'all', 'replied'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
                  activeTab === tab
                    ? 'text-[--exec-accent] border-[--exec-accent]'
                    : 'text-[--exec-text-muted] border-transparent hover:text-[--exec-text]'
                )}
              >
                {tab === 'today' && `Today (${todayQueue.length})`}
                {tab === 'all' && 'All Prospects'}
                {tab === 'replied' && `Replied (${repliedProspects.length})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Queue Content */}
      <div className="px-8 py-6">
        {!selectedCampaignId ? (
          <div className="bento-card p-12 text-center">
            <Mail className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[--exec-text] mb-2">No Campaign Selected</h3>
            <p className="text-[--exec-text-muted] mb-4">
              Select a campaign or create a new one to get started.
            </p>
            <button
              onClick={() => setIsNewCampaignOpen(true)}
              className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all"
            >
              Create Campaign
            </button>
          </div>
        ) : activeTab === 'today' ? (
          <TodayQueue
            prospects={todayQueue}
            campaignId={selectedCampaignId}
          />
        ) : activeTab === 'all' ? (
          <AllProspects prospects={allProspects} />
        ) : (
          <RepliedProspects
            prospects={repliedProspects}
            campaignId={selectedCampaignId}
          />
        )}
      </div>

      {/* Modals will be added in subsequent tasks */}
    </div>
  );
}

// Placeholder components - will be fully implemented in next tasks
function TodayQueue({ prospects, campaignId }: { prospects: OutreachProspect[]; campaignId: number }) {
  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">All caught up!</h3>
        <p className="text-[--exec-text-muted]">No prospects need action today.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prospects.map((prospect) => (
        <ProspectCard key={prospect.id} prospect={prospect} campaignId={campaignId} />
      ))}
    </div>
  );
}

function AllProspects({ prospects }: { prospects: OutreachProspect[] }) {
  return (
    <div className="bento-card overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-[--exec-surface-alt]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase">Agency</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase">Niche</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase">Step</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase">Next Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[--exec-border]">
          {prospects.map((prospect) => (
            <tr key={prospect.id} className="hover:bg-[--exec-surface-alt]/50">
              <td className="px-4 py-3 text-sm text-[--exec-text]">{prospect.agency_name}</td>
              <td className="px-4 py-3 text-sm text-[--exec-text-muted]">{prospect.email}</td>
              <td className="px-4 py-3 text-sm text-[--exec-text-muted]">{prospect.niche || '-'}</td>
              <td className="px-4 py-3">
                <StatusBadge status={prospect.status} />
              </td>
              <td className="px-4 py-3 text-sm text-[--exec-text]">{prospect.current_step}/5</td>
              <td className="px-4 py-3 text-sm text-[--exec-text-muted]">{prospect.next_action_date || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepliedProspects({ prospects, campaignId }: { prospects: OutreachProspect[]; campaignId: number }) {
  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <MessageSquare className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No replies yet</h3>
        <p className="text-[--exec-text-muted]">Replies will appear here when prospects respond.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prospects.map((prospect) => (
        <div key={prospect.id} className="bento-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-[--exec-text]">{prospect.agency_name}</h3>
              <p className="text-sm text-[--exec-text-muted]">{prospect.email}</p>
            </div>
            <StatusBadge status={prospect.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProspectCard({ prospect, campaignId }: { prospect: OutreachProspect; campaignId: number }) {
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const markSentMutation = useMutation({
    mutationFn: () => coldOutreachApi.markSent(prospect.id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
    },
  });

  const isStep1 = prospect.current_step === 1;

  return (
    <div className="bento-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-3 h-3 rounded-full',
            isStep1 ? 'bg-green-500' : 'bg-blue-500'
          )} />
          <div>
            <h3 className="font-medium text-[--exec-text]">{prospect.agency_name}</h3>
            <p className="text-sm text-[--exec-text-muted]">{prospect.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-[--exec-text]">
              Step {prospect.current_step} {isStep1 ? '(Initial)' : '(Follow-up)'}
            </p>
            <p className="text-xs text-[--exec-text-muted]">{prospect.niche || 'No niche'}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCopyModalOpen(true)}
              className="px-3 py-1.5 bg-[--exec-accent] text-white text-sm font-medium rounded-lg hover:bg-[--exec-accent-dark] transition-all"
            >
              Copy Email
            </button>
            <button
              onClick={() => markSentMutation.mutate()}
              disabled={markSentMutation.isPending}
              className="px-3 py-1.5 bg-[--exec-surface-alt] text-[--exec-text-secondary] text-sm font-medium rounded-lg hover:bg-[--exec-surface] border border-[--exec-border] transition-all"
            >
              {markSentMutation.isPending ? 'Sending...' : 'Mark Sent'}
            </button>
          </div>
        </div>
      </div>

      {/* Copy Email Modal will be implemented in Task 9 */}
    </div>
  );
}

function StatusBadge({ status }: { status: ProspectStatus }) {
  const config: Record<ProspectStatus, { bg: string; text: string; label: string }> = {
    queued: { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Queued' },
    in_sequence: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'In Sequence' },
    replied: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', label: 'Replied' },
    not_interested: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Not Interested' },
    converted: { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Converted' },
  };

  const c = config[status];

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', c.bg, c.text)}>
      {c.label}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/ColdOutreach.tsx
git commit -m "feat(outreach): add ColdOutreach page with queue UI"
```

---

## Task 9: Frontend Modals - CSV Import

**Files:**
- Create: `frontend/src/components/CsvImportModal.tsx`

**Step 1: Create the CSV import modal**

```tsx
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
}

export default function CsvImportModal({ isOpen, onClose, campaignId }: CsvImportModalProps) {
  const [csvData, setCsvData] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    agency_name: '',
    email: '',
    contact_name: '',
    website: '',
    niche: '',
  });
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: () => coldOutreachApi.importProspects(campaignId, {
      column_mapping: {
        agency_name: mapping.agency_name,
        email: mapping.email,
        contact_name: mapping.contact_name || undefined,
        website: mapping.website || undefined,
        niche: mapping.niche || undefined,
      },
      data: csvData,
    }),
    onSuccess: (result) => {
      toast.success(`Imported ${result.imported_count} prospects. ${result.skipped_count} skipped.`);
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      handleClose();
    },
    onError: () => {
      toast.error('Failed to import prospects');
    },
  });

  const handleClose = () => {
    setCsvData([]);
    setHeaders([]);
    setMapping({ agency_name: '', email: '', contact_name: '', website: '', niche: '' });
    setStep('upload');
    onClose();
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        toast.error('CSV file must have headers and at least one row');
        return;
      }

      // Parse headers
      const headerLine = lines[0];
      const parsedHeaders = parseCSVLine(headerLine);
      setHeaders(parsedHeaders);

      // Parse data rows
      const rows: Record<string, any>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, any> = {};
        parsedHeaders.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }

      setCsvData(rows);
      setStep('map');

      // Auto-detect common column names
      const autoMapping = { ...mapping };
      parsedHeaders.forEach(h => {
        const lower = h.toLowerCase();
        if (lower.includes('agency') || lower.includes('company') || lower.includes('name')) {
          if (!autoMapping.agency_name) autoMapping.agency_name = h;
        }
        if (lower.includes('email')) {
          if (!autoMapping.email) autoMapping.email = h;
        }
        if (lower.includes('contact') || lower.includes('person')) {
          if (!autoMapping.contact_name) autoMapping.contact_name = h;
        }
        if (lower.includes('website') || lower.includes('url') || lower.includes('site')) {
          if (!autoMapping.website) autoMapping.website = h;
        }
        if (lower.includes('niche') || lower.includes('industry') || lower.includes('category')) {
          if (!autoMapping.niche) autoMapping.niche = h;
        }
      });
      setMapping(autoMapping);
    };

    reader.readAsText(file);
  }, [mapping]);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const canProceedToPreview = mapping.agency_name && mapping.email;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border]">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-[--exec-accent]" />
            <h2 className="text-xl font-bold text-[--exec-text]">Import CSV</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 rounded-lg hover:bg-[--exec-surface-alt] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'upload' && (
            <div className="border-2 border-dashed border-[--exec-border] rounded-xl p-12 text-center">
              <Upload className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
              <p className="text-[--exec-text] mb-2">Drag & drop your CSV file here</p>
              <p className="text-sm text-[--exec-text-muted] mb-4">or</p>
              <label className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl cursor-pointer hover:bg-[--exec-accent-dark] transition-all">
                Browse Files
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-[--exec-text-muted]">
                Map your CSV columns to prospect fields. Agency Name and Email are required.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'agency_name', label: 'Agency Name', required: true },
                  { key: 'email', label: 'Email', required: true },
                  { key: 'contact_name', label: 'Contact Name', required: false },
                  { key: 'website', label: 'Website', required: false },
                  { key: 'niche', label: 'Niche', required: false },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-[--exec-text] mb-1">
                      {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={mapping[key as keyof typeof mapping]}
                      onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                      className="w-full px-3 py-2 bg-[--exec-surface-alt] border border-[--exec-border] rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                    >
                      <option value="">Select column</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-sm">
                {canProceedToPreview ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span className={canProceedToPreview ? 'text-green-500' : 'text-yellow-500'}>
                  {canProceedToPreview ? 'Ready to preview' : 'Map required fields'}
                </span>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-[--exec-text-muted]">
                Preview of first 5 rows. {csvData.length} total rows will be imported.
              </p>

              <div className="overflow-x-auto border border-[--exec-border] rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-[--exec-surface-alt]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[--exec-text-muted]">Agency</th>
                      <th className="px-3 py-2 text-left text-[--exec-text-muted]">Email</th>
                      <th className="px-3 py-2 text-left text-[--exec-text-muted]">Contact</th>
                      <th className="px-3 py-2 text-left text-[--exec-text-muted]">Website</th>
                      <th className="px-3 py-2 text-left text-[--exec-text-muted]">Niche</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--exec-border]">
                    {csvData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-[--exec-text]">{row[mapping.agency_name]}</td>
                        <td className="px-3 py-2 text-[--exec-text-muted]">{row[mapping.email]}</td>
                        <td className="px-3 py-2 text-[--exec-text-muted]">{row[mapping.contact_name] || '-'}</td>
                        <td className="px-3 py-2 text-[--exec-text-muted]">{row[mapping.website] || '-'}</td>
                        <td className="px-3 py-2 text-[--exec-text-muted]">{row[mapping.niche] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-[--exec-border]">
          {step === 'map' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!canProceedToPreview}
                className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('map')}
                className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all disabled:opacity-50"
              >
                {importMutation.isPending ? 'Importing...' : `Import ${csvData.length} Prospects`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/CsvImportModal.tsx
git commit -m "feat(outreach): add CSV import modal component"
```

---

## Task 10: Frontend Modals - Copy Email & Response

**Files:**
- Create: `frontend/src/components/CopyEmailModal.tsx`
- Create: `frontend/src/components/ResponseOutcomeModal.tsx`

**Step 1: Create CopyEmailModal.tsx**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachProspect } from '@/types';
import { X, Copy, Check, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: OutreachProspect;
}

export default function CopyEmailModal({ isOpen, onClose, prospect }: CopyEmailModalProps) {
  const [copiedField, setCopiedField] = useState<'email' | 'subject' | 'body' | 'all' | null>(null);
  const queryClient = useQueryClient();

  const { data: rendered, isLoading } = useQuery({
    queryKey: ['rendered-email', prospect.id],
    queryFn: () => coldOutreachApi.renderEmail(prospect.id),
    enabled: isOpen,
  });

  const markSentMutation = useMutation({
    mutationFn: () => coldOutreachApi.markSent(prospect.id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      onClose();
    },
  });

  const copyToClipboard = async (text: string, field: 'email' | 'subject' | 'body' | 'all') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllAndSend = async () => {
    if (!rendered) return;

    const fullText = `To: ${rendered.to_email}\nSubject: ${rendered.subject}\n\n${rendered.body}`;
    await copyToClipboard(fullText, 'all');
    markSentMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border]">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[--exec-accent]" />
            <h2 className="text-xl font-bold text-[--exec-text]">Email Preview</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-[--exec-accent-bg] text-[--exec-accent] rounded-full">
              Step {prospect.current_step}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 rounded-lg hover:bg-[--exec-surface-alt] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-[--exec-text-muted]">Loading template...</div>
          ) : !rendered ? (
            <div className="text-center py-8 text-[--exec-text-muted]">
              No template found for step {prospect.current_step}.
              <br />Create one in Templates settings.
            </div>
          ) : (
            <>
              {/* Email To */}
              <div className="flex items-center justify-between p-3 bg-[--exec-surface-alt] rounded-lg">
                <div>
                  <p className="text-xs text-[--exec-text-muted] mb-0.5">To:</p>
                  <p className="text-sm text-[--exec-text]">{rendered.to_email}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(rendered.to_email, 'email')}
                  className="p-2 hover:bg-[--exec-surface] rounded-lg transition-colors"
                >
                  {copiedField === 'email' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-[--exec-text-muted]" />
                  )}
                </button>
              </div>

              {/* Subject */}
              <div className="flex items-center justify-between p-3 bg-[--exec-surface-alt] rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[--exec-text-muted] mb-0.5">Subject:</p>
                  <p className="text-sm text-[--exec-text] truncate">{rendered.subject}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(rendered.subject, 'subject')}
                  className="p-2 hover:bg-[--exec-surface] rounded-lg transition-colors flex-shrink-0"
                >
                  {copiedField === 'subject' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-[--exec-text-muted]" />
                  )}
                </button>
              </div>

              {/* Body */}
              <div className="relative">
                <div className="p-4 bg-[--exec-surface-alt] rounded-lg min-h-[200px] max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-[--exec-text] whitespace-pre-wrap">{rendered.body}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(rendered.body, 'body')}
                  className="absolute top-2 right-2 p-2 bg-[--exec-surface] hover:bg-[--exec-border] rounded-lg transition-colors"
                >
                  {copiedField === 'body' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-[--exec-text-muted]" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-[--exec-border]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopyAllAndSend}
            disabled={!rendered || markSentMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {markSentMutation.isPending ? 'Marking...' : 'Copy All & Mark Sent'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create ResponseOutcomeModal.tsx**

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachProspect, ResponseType } from '@/types';
import { X, ThumbsUp, ThumbsDown, MessageCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface ResponseOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: OutreachProspect;
}

export default function ResponseOutcomeModal({ isOpen, onClose, prospect }: ResponseOutcomeModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<ResponseType | null>(null);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<{ contact_id?: number; deal_id?: number } | null>(null);
  const queryClient = useQueryClient();

  const markRepliedMutation = useMutation({
    mutationFn: () => coldOutreachApi.markReplied(prospect.id, {
      response_type: selectedOutcome!,
      notes: notes || undefined,
    }),
    onSuccess: (data) => {
      toast.success(data.message);
      if (data.contact_id) {
        setResult({ contact_id: data.contact_id, deal_id: data.deal_id });
      } else {
        handleClose();
      }
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-replied'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: () => {
      toast.error('Failed to record response');
    },
  });

  const handleClose = () => {
    setSelectedOutcome(null);
    setNotes('');
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  // Show success state with link to deal
  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <ThumbsUp className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-[--exec-text] mb-2">Converted!</h2>
          <p className="text-[--exec-text-muted] mb-6">
            Created contact and deal for {prospect.agency_name}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
            >
              Close
            </button>
            <Link
              to={`/deals`}
              onClick={handleClose}
              className="flex items-center gap-2 px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all"
            >
              View Deal
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border]">
          <h2 className="text-xl font-bold text-[--exec-text]">{prospect.agency_name} replied!</h2>
          <button
            onClick={handleClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 rounded-lg hover:bg-[--exec-surface-alt] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-[--exec-text-muted]">What was the outcome?</p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'interested' as ResponseType, label: 'Interested', icon: ThumbsUp, color: 'green' },
              { value: 'not_interested' as ResponseType, label: 'Not Interested', icon: ThumbsDown, color: 'red' },
              { value: 'other' as ResponseType, label: 'Other', icon: MessageCircle, color: 'yellow' },
            ].map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setSelectedOutcome(value)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  selectedOutcome === value
                    ? `border-${color}-500 bg-${color}-500/10`
                    : 'border-[--exec-border] hover:border-[--exec-accent]'
                )}
              >
                <Icon className={cn(
                  'w-6 h-6',
                  selectedOutcome === value ? `text-${color}-500` : 'text-[--exec-text-muted]'
                )} />
                <span className={cn(
                  'text-sm font-medium',
                  selectedOutcome === value ? `text-${color}-500` : 'text-[--exec-text]'
                )}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-[--exec-text] mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Wants a call next Tuesday..."
              className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl text-[--exec-text] placeholder-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-[--exec-border]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => markRepliedMutation.mutate()}
            disabled={!selectedOutcome || markRepliedMutation.isPending}
            className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {markRepliedMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/CopyEmailModal.tsx frontend/src/components/ResponseOutcomeModal.tsx
git commit -m "feat(outreach): add copy email and response outcome modals"
```

---

## Task 11: Wire Up Modals in ColdOutreach Page

**Files:**
- Modify: `frontend/src/pages/ColdOutreach.tsx`

**Step 1: Add modal imports at the top**

```tsx
import CsvImportModal from '@/components/CsvImportModal';
import CopyEmailModal from '@/components/CopyEmailModal';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
```

**Step 2: Update the ProspectCard component to use modals**

Replace the existing ProspectCard function with:

```tsx
function ProspectCard({ prospect, campaignId }: { prospect: OutreachProspect; campaignId: number }) {
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const markSentMutation = useMutation({
    mutationFn: () => coldOutreachApi.markSent(prospect.id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
    },
  });

  const isStep1 = prospect.current_step === 1;

  return (
    <>
      <div className="bento-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-3 h-3 rounded-full',
              isStep1 ? 'bg-green-500' : 'bg-blue-500'
            )} />
            <div>
              <h3 className="font-medium text-[--exec-text]">{prospect.agency_name}</h3>
              <p className="text-sm text-[--exec-text-muted]">{prospect.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-[--exec-text]">
                Step {prospect.current_step} {isStep1 ? '(Initial)' : '(Follow-up)'}
              </p>
              <p className="text-xs text-[--exec-text-muted]">{prospect.niche || 'No niche'}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCopyModalOpen(true)}
                className="px-3 py-1.5 bg-[--exec-accent] text-white text-sm font-medium rounded-lg hover:bg-[--exec-accent-dark] transition-all"
              >
                Copy Email
              </button>
              <button
                onClick={() => markSentMutation.mutate()}
                disabled={markSentMutation.isPending}
                className="px-3 py-1.5 bg-[--exec-surface-alt] text-[--exec-text-secondary] text-sm font-medium rounded-lg hover:bg-[--exec-surface] border border-[--exec-border] transition-all"
              >
                {markSentMutation.isPending ? '...' : 'Mark Sent'}
              </button>
              {prospect.current_step > 1 && (
                <button
                  onClick={() => setIsResponseModalOpen(true)}
                  className="px-3 py-1.5 bg-green-500/10 text-green-500 text-sm font-medium rounded-lg hover:bg-green-500/20 transition-all"
                >
                  They Replied
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <CopyEmailModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        prospect={prospect}
      />

      <ResponseOutcomeModal
        isOpen={isResponseModalOpen}
        onClose={() => setIsResponseModalOpen(false)}
        prospect={prospect}
      />
    </>
  );
}
```

**Step 3: Add modal components at the bottom of the main component JSX (before the closing `</div>`)**

Find where the comment says `{/* Modals will be added in subsequent tasks */}` and replace with:

```tsx
{/* Modals */}
{selectedCampaignId && (
  <CsvImportModal
    isOpen={isImportOpen}
    onClose={() => setIsImportOpen(false)}
    campaignId={selectedCampaignId}
  />
)}
```

**Step 4: Commit**

```bash
git add frontend/src/pages/ColdOutreach.tsx
git commit -m "feat(outreach): wire up modals in ColdOutreach page"
```

---

## Task 12: Add New Campaign Modal

**Files:**
- Create: `frontend/src/components/NewCampaignModal.tsx`
- Modify: `frontend/src/pages/ColdOutreach.tsx`

**Step 1: Create NewCampaignModal.tsx**

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import { X, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (campaignId: number) => void;
}

export default function NewCampaignModal({ isOpen, onClose, onCreated }: NewCampaignModalProps) {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => coldOutreachApi.createCampaign({ name }),
    onSuccess: (campaign) => {
      toast.success('Campaign created!');
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      onCreated(campaign.id);
      handleClose();
    },
    onError: () => {
      toast.error('Failed to create campaign');
    },
  });

  const handleClose = () => {
    setName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border]">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-[--exec-accent]" />
            <h2 className="text-xl font-bold text-[--exec-text]">New Campaign</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 rounded-lg hover:bg-[--exec-surface-alt] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <label className="block text-sm font-medium text-[--exec-text] mb-1.5">
            Campaign Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Web Design Agencies - Feb 2026"
            className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl text-[--exec-text] placeholder-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all"
            autoFocus
          />
          <p className="mt-2 text-xs text-[--exec-text-muted]">
            You can customize follow-up delays in campaign settings after creation.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-[--exec-border]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
            className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add import and modal to ColdOutreach.tsx**

Add import:
```tsx
import NewCampaignModal from '@/components/NewCampaignModal';
```

Add modal at the bottom with other modals:
```tsx
<NewCampaignModal
  isOpen={isNewCampaignOpen}
  onClose={() => setIsNewCampaignOpen(false)}
  onCreated={(id) => setSelectedCampaignId(id)}
/>
```

**Step 3: Commit**

```bash
git add frontend/src/components/NewCampaignModal.tsx frontend/src/pages/ColdOutreach.tsx
git commit -m "feat(outreach): add new campaign modal"
```

---

## Task 13: Add Email Templates Modal

**Files:**
- Create: `frontend/src/components/EmailTemplatesModal.tsx`
- Modify: `frontend/src/pages/ColdOutreach.tsx`

**Step 1: Create EmailTemplatesModal.tsx**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachEmailTemplate } from '@/types';
import { X, Mail, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EmailTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
}

export default function EmailTemplatesModal({ isOpen, onClose, campaignId }: EmailTemplatesModalProps) {
  const [selectedStep, setSelectedStep] = useState(1);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['outreach-templates', campaignId],
    queryFn: () => coldOutreachApi.getTemplates(campaignId),
    enabled: isOpen,
  });

  // Load template when step changes
  const currentTemplate = templates.find(t => t.step_number === selectedStep);

  const handleStepChange = (step: number) => {
    setSelectedStep(step);
    const template = templates.find(t => t.step_number === step);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    } else {
      setSubject('');
      setBody('');
    }
  };

  // Initialize on first load
  if (isOpen && templates.length > 0 && !subject && !body) {
    const first = templates.find(t => t.step_number === 1);
    if (first) {
      setSubject(first.subject);
      setBody(first.body);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => coldOutreachApi.createTemplate(campaignId, {
      step_number: selectedStep,
      subject,
      body,
    }),
    onSuccess: () => {
      toast.success('Template saved!');
      queryClient.invalidateQueries({ queryKey: ['outreach-templates', campaignId] });
    },
    onError: () => {
      toast.error('Failed to save template');
    },
  });

  if (!isOpen) return null;

  const stepLabels = ['Initial', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Final'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border]">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[--exec-accent]" />
            <h2 className="text-xl font-bold text-[--exec-text]">Email Templates</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 rounded-lg hover:bg-[--exec-surface-alt] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-[--exec-border] overflow-x-auto">
          {[1, 2, 3, 4, 5].map((step) => {
            const hasTemplate = templates.some(t => t.step_number === step);
            return (
              <button
                key={step}
                onClick={() => handleStepChange(step)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
                  selectedStep === step
                    ? 'bg-[--exec-accent] text-white'
                    : hasTemplate
                    ? 'bg-[--exec-surface-alt] text-[--exec-text]'
                    : 'text-[--exec-text-muted] hover:bg-[--exec-surface-alt]'
                )}
              >
                Step {step}: {stepLabels[step - 1]}
                {hasTemplate && selectedStep !== step && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Variables Help */}
          <div className="p-3 bg-[--exec-surface-alt] rounded-lg text-sm">
            <p className="font-medium text-[--exec-text] mb-1">Available variables:</p>
            <code className="text-[--exec-accent]">
              {'{agency_name}'} {'{contact_name}'} {'{niche}'} {'{website}'}
            </code>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[--exec-text] mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Quick question for {agency_name}"
              className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl text-[--exec-text] placeholder-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 transition-all"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-[--exec-text] mb-1.5">
              Email Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email template here..."
              className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl text-[--exec-text] placeholder-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 transition-all resize-none"
              rows={12}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-[--exec-border]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!subject.trim() || !body.trim() || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add import and modal to ColdOutreach.tsx**

Add import:
```tsx
import EmailTemplatesModal from '@/components/EmailTemplatesModal';
```

Add modal at the bottom:
```tsx
{selectedCampaignId && (
  <EmailTemplatesModal
    isOpen={isTemplatesOpen}
    onClose={() => setIsTemplatesOpen(false)}
    campaignId={selectedCampaignId}
  />
)}
```

**Step 3: Commit**

```bash
git add frontend/src/components/EmailTemplatesModal.tsx frontend/src/pages/ColdOutreach.tsx
git commit -m "feat(outreach): add email templates modal"
```

---

## Task 14: Add Route and Navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Add route to App.tsx**

Add import:
```tsx
import ColdOutreach from './pages/ColdOutreach';
```

Add route (after the Outreach route):
```tsx
<Route path="/cold-outreach" element={<ColdOutreach />} />
```

**Step 2: Add navigation item to Layout.tsx**

Find the "Clients" navigation group and add after "Outreach":
```tsx
{ name: 'Cold Outreach', href: '/cold-outreach', icon: Mail },
```

Make sure `Mail` is imported from lucide-react.

**Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(outreach): add cold outreach route and navigation"
```

---

## Task 15: Test the Full Flow

**Step 1: Start backend**

```bash
cd backend
venv/Scripts/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Step 2: Start frontend**

```bash
cd frontend
npm run dev
```

**Step 3: Manual testing checklist**

- [ ] Navigate to Cold Outreach page
- [ ] Create a new campaign
- [ ] Set up email templates for steps 1-5
- [ ] Import a CSV file with prospects
- [ ] Verify prospects appear in Today queue
- [ ] Click "Copy Email" and verify template renders with variables
- [ ] Click "Mark Sent" and verify prospect moves to next step
- [ ] Click "They Replied" and test each outcome (Interested, Not Interested, Other)
- [ ] Verify "Interested" creates Contact and Deal
- [ ] Verify stats update correctly

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(outreach): complete cold email outreach system"
```

---

## Summary

This plan implements:

1. **Backend**: New models (Campaign, Prospect, EmailTemplate), schemas, and API routes
2. **Database**: Alembic migration for new tables
3. **Frontend**: New ColdOutreach page with:
   - Campaign selector and creation
   - CSV import with column mapping
   - Today's queue for efficient outreach
   - Copy email modal with variable substitution
   - Response outcome modal with CRM conversion
   - Email templates editor
   - Campaign statistics

The system is designed for speed - minimum clicks to get through your daily outreach queue.
