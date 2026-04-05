# Warm Leads Nurture Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Warm Leads" tab to OutreachHub with a 5-step nurture pipeline, time-based follow-up triggers, and deferred deal creation.

**Architecture:** New `NurtureLead` + `NurtureStepLog` models with a dedicated `/api/nurture/` route. Frontend gets a new `WarmLeadsTab` component in OutreachHub with kanban pipeline view. The existing `mark_replied` endpoint is modified to skip Deal creation on INTERESTED, and a new `/nurture/from-prospect/{id}` endpoint handles nurture entry.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (backend) / React, TypeScript, TanStack Query, TailwindCSS (frontend)

**Spec:** `docs/superpowers/specs/2026-04-05-warm-leads-nurture-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/models/nurture.py` | NurtureLead + NurtureStepLog SQLAlchemy models, enums |
| `backend/app/schemas/nurture.py` | Pydantic request/response schemas |
| `backend/app/routes/nurture.py` | All `/api/nurture/` endpoints |
| `backend/alembic/versions/xxxx_add_nurture_tables.py` | Migration (auto-generated) |
| `frontend/src/pages/outreach/WarmLeadsTab.tsx` | Main tab component with kanban + follow-up list |
| `frontend/src/components/NurtureLeadDetail.tsx` | Slide-out detail panel for a nurture lead |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/main.py:177` | Register nurture router |
| `backend/app/services/scheduler_service.py:141-178` | Add nurture follow-up check job |
| `backend/app/routes/cold_outreach.py:861-906` | Skip Deal creation on INTERESTED |
| `frontend/src/lib/api.ts` | Add `nurtureApi` object |
| `frontend/src/types/index.ts` | Add NurtureLead types + enums |
| `frontend/src/pages/OutreachHub.tsx:25-46,293-298` | Add Warm Leads tab |
| `frontend/src/components/ResponseOutcomeModal.tsx:65-90,109-156` | Call nurture entry on INTERESTED |

---

## Task 1: Backend Models + Migration

**Files:**
- Create: `backend/app/models/nurture.py`
- Modify: `backend/alembic/versions/` (auto-generated)

- [ ] **Step 1: Create the nurture models file**

```python
# backend/app/models/nurture.py
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.database import Base


class NurtureStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    QUIET = "QUIET"
    LONG_TERM = "LONG_TERM"
    CONVERTED = "CONVERTED"
    LOST = "LOST"


class FollowupStage(str, enum.Enum):
    DAY_2 = "DAY_2"
    DAY_5 = "DAY_5"
    DAY_10 = "DAY_10"
    LONG_TERM = "LONG_TERM"


# Predefined nurture steps (constants)
NURTURE_STEPS = {
    1: "Reply with value",
    2: "Free goodwill offer",
    3: "Deliver the free thing",
    4: "Book a call",
    5: "Make the offer / close",
}


class NurtureLead(Base):
    __tablename__ = "nurture_leads"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("outreach_prospects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    deal_id = Column(Integer, ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True, index=True)
    campaign_id = Column(Integer, ForeignKey("outreach_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    source_channel = Column(String(50), nullable=True)
    current_step = Column(Integer, default=1, nullable=False)
    status = Column(Enum(NurtureStatus), default=NurtureStatus.ACTIVE, nullable=False)
    quiet_since = Column(DateTime, nullable=True)
    last_action_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    next_followup_at = Column(DateTime, nullable=True)
    followup_stage = Column(Enum(FollowupStage), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_nurture_leads_status", "status"),
        Index("ix_nurture_leads_followup_stage", "followup_stage"),
    )

    # Relationships
    prospect = relationship("OutreachProspect", foreign_keys=[prospect_id])
    contact = relationship("Contact", foreign_keys=[contact_id])
    deal = relationship("Deal", foreign_keys=[deal_id])
    campaign = relationship("OutreachCampaign", foreign_keys=[campaign_id])
    step_logs = relationship("NurtureStepLog", back_populates="nurture_lead", cascade="all, delete-orphan", order_by="NurtureStepLog.step_number")

    def __repr__(self):
        return f"<NurtureLead(id={self.id}, prospect_id={self.prospect_id}, step={self.current_step}, status={self.status})>"


class NurtureStepLog(Base):
    __tablename__ = "nurture_step_logs"

    id = Column(Integer, primary_key=True, index=True)
    nurture_lead_id = Column(Integer, ForeignKey("nurture_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nurture_lead = relationship("NurtureLead", back_populates="step_logs")

    def __repr__(self):
        return f"<NurtureStepLog(id={self.id}, nurture_lead_id={self.nurture_lead_id}, step={self.step_number})>"
```

- [ ] **Step 2: Generate and review the Alembic migration**

```bash
cd backend
venv/Scripts/alembic revision --autogenerate -m "add nurture_leads and nurture_step_logs tables"
```

Review the generated migration — ensure it creates both tables with all columns, indexes, and the unique constraint on `prospect_id`.

- [ ] **Step 3: Apply the migration**

```bash
cd backend
venv/Scripts/alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/nurture.py backend/alembic/versions/
git commit -m "feat: add NurtureLead and NurtureStepLog models with migration"
```

---

## Task 2: Backend Schemas

**Files:**
- Create: `backend/app/schemas/nurture.py`

- [ ] **Step 1: Create Pydantic schemas**

```python
# backend/app/schemas/nurture.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models.nurture import NurtureStatus, FollowupStage, NURTURE_STEPS


class NurtureStepLogResponse(BaseModel):
    id: int
    step_number: int
    step_name: str = ""
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NurtureLeadResponse(BaseModel):
    id: int
    prospect_id: int
    contact_id: Optional[int] = None
    deal_id: Optional[int] = None
    campaign_id: int
    source_channel: Optional[str] = None
    current_step: int
    current_step_name: str = ""
    status: NurtureStatus
    quiet_since: Optional[datetime] = None
    last_action_at: datetime
    next_followup_at: Optional[datetime] = None
    followup_stage: Optional[FollowupStage] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Joined fields
    prospect_name: Optional[str] = None
    prospect_email: Optional[str] = None
    prospect_website: Optional[str] = None
    prospect_niche: Optional[str] = None
    campaign_name: Optional[str] = None
    contact_name: Optional[str] = None
    step_logs: List[NurtureStepLogResponse] = []

    class Config:
        from_attributes = True


class NurtureLeadCreate(BaseModel):
    source_channel: Optional[str] = None
    notes: Optional[str] = None


class NurtureLeadUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[NurtureStatus] = None


class CompleteStepRequest(BaseModel):
    notes: Optional[str] = None


class LogFollowupRequest(BaseModel):
    notes: Optional[str] = None


class ConvertRequest(BaseModel):
    deal_title: Optional[str] = None
    deal_value: Optional[float] = None
    deal_stage: Optional[str] = None


class MarkLostRequest(BaseModel):
    notes: Optional[str] = None


class NurtureStatsResponse(BaseModel):
    active: int
    needs_followup: int
    long_term: int
    converted: int
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/nurture.py
git commit -m "feat: add Pydantic schemas for nurture pipeline"
```

---

## Task 3: Backend Routes

**Files:**
- Create: `backend/app/routes/nurture.py`
- Modify: `backend/app/main.py:177`

- [ ] **Step 1: Create the nurture routes file**

```python
# backend/app/routes/nurture.py
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.nurture import NurtureLead, NurtureStepLog, NurtureStatus, FollowupStage, NURTURE_STEPS
from app.models.outreach import OutreachProspect, ProspectStatus
from app.models.crm import Contact, ContactStatus, Deal, DealStage, Interaction, InteractionType
from app.schemas.nurture import (
    NurtureLeadResponse, NurtureLeadCreate, NurtureLeadUpdate,
    CompleteStepRequest, LogFollowupRequest, ConvertRequest, MarkLostRequest,
    NurtureStatsResponse, NurtureStepLogResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nurture", tags=["nurture"])


def _build_lead_response(lead: NurtureLead) -> NurtureLeadResponse:
    """Build a NurtureLeadResponse with joined fields from relationships."""
    return NurtureLeadResponse(
        id=lead.id,
        prospect_id=lead.prospect_id,
        contact_id=lead.contact_id,
        deal_id=lead.deal_id,
        campaign_id=lead.campaign_id,
        source_channel=lead.source_channel,
        current_step=lead.current_step,
        current_step_name=NURTURE_STEPS.get(lead.current_step, f"Step {lead.current_step}"),
        status=lead.status,
        quiet_since=lead.quiet_since,
        last_action_at=lead.last_action_at,
        next_followup_at=lead.next_followup_at,
        followup_stage=lead.followup_stage,
        notes=lead.notes,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        prospect_name=lead.prospect.agency_name if lead.prospect else None,
        prospect_email=lead.prospect.email if lead.prospect else None,
        prospect_website=lead.prospect.website if lead.prospect else None,
        prospect_niche=lead.prospect.niche if lead.prospect else None,
        campaign_name=lead.campaign.name if lead.campaign else None,
        contact_name=lead.contact.name if lead.contact else None,
        step_logs=[
            NurtureStepLogResponse(
                id=log.id,
                step_number=log.step_number,
                step_name=NURTURE_STEPS.get(log.step_number, f"Step {log.step_number}"),
                completed_at=log.completed_at,
                notes=log.notes,
                created_at=log.created_at,
            )
            for log in lead.step_logs
        ],
    )


# ── GET /nurture/stats ──
@router.get("/stats", response_model=NurtureStatsResponse)
def get_nurture_stats(db: Session = Depends(get_db)):
    active = db.query(NurtureLead).filter(NurtureLead.status == NurtureStatus.ACTIVE).count()
    needs_followup = db.query(NurtureLead).filter(
        NurtureLead.status == NurtureStatus.ACTIVE,
        NurtureLead.followup_stage.isnot(None),
    ).count()
    long_term = db.query(NurtureLead).filter(NurtureLead.status == NurtureStatus.LONG_TERM).count()
    converted = db.query(NurtureLead).filter(NurtureLead.status == NurtureStatus.CONVERTED).count()
    return NurtureStatsResponse(active=active, needs_followup=needs_followup, long_term=long_term, converted=converted)


# ── GET /nurture/leads ──
@router.get("/leads", response_model=List[NurtureLeadResponse])
def list_nurture_leads(
    status: Optional[NurtureStatus] = None,
    current_step: Optional[int] = None,
    followup_stage: Optional[FollowupStage] = None,
    needs_followup: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(NurtureLead)

    if status:
        query = query.filter(NurtureLead.status == status)
    if current_step:
        query = query.filter(NurtureLead.current_step == current_step)
    if followup_stage:
        query = query.filter(NurtureLead.followup_stage == followup_stage)
    if needs_followup:
        query = query.filter(NurtureLead.followup_stage.isnot(None))
    if search:
        query = query.join(OutreachProspect).filter(
            OutreachProspect.agency_name.ilike(f"%{search}%")
            | OutreachProspect.contact_name.ilike(f"%{search}%")
            | OutreachProspect.email.ilike(f"%{search}%")
        )

    leads = query.order_by(NurtureLead.next_followup_at.asc().nullslast(), NurtureLead.last_action_at.desc()).all()
    return [_build_lead_response(lead) for lead in leads]


# ── GET /nurture/leads/{id} ──
@router.get("/leads/{lead_id}", response_model=NurtureLeadResponse)
def get_nurture_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(NurtureLead).filter(NurtureLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Nurture lead not found")
    return _build_lead_response(lead)


# ── POST /nurture/from-prospect/{prospect_id} ──
@router.post("/from-prospect/{prospect_id}", response_model=NurtureLeadResponse)
def create_from_prospect(prospect_id: int, data: NurtureLeadCreate, db: Session = Depends(get_db)):
    """Create a NurtureLead from an outreach prospect (called by Response Outcome Modal)."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    # Check for duplicate
    existing = db.query(NurtureLead).filter(NurtureLead.prospect_id == prospect_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Prospect already has a nurture lead")

    # Reuse existing CRM Contact (created by mark_replied), or create one if missing
    contact_id = prospect.converted_contact_id
    if not contact_id:
        # Safety fallback — mark_replied should have created the contact already
        contact = Contact(
            name=prospect.agency_name,
            email=prospect.email,
            company=prospect.agency_name,
            source=f"Cold Outreach - {prospect.campaign.name}",
            status=ContactStatus.LEAD,
            notes=f"Converted from cold outreach.\nNiche: {prospect.niche or 'N/A'}\nWebsite: {prospect.website or 'N/A'}",
        )
        db.add(contact)
        db.flush()
        contact_id = contact.id
        prospect.converted_contact_id = contact_id

    # Determine source channel
    source_channel = data.source_channel
    if not source_channel and prospect.campaign:
        source_channel = prospect.campaign.campaign_type.value

    # Create NurtureLead
    now = datetime.utcnow()
    nurture_lead = NurtureLead(
        prospect_id=prospect_id,
        contact_id=contact_id,
        campaign_id=prospect.campaign_id,
        source_channel=source_channel,
        current_step=1,
        status=NurtureStatus.ACTIVE,
        last_action_at=now,
        notes=data.notes,
    )
    db.add(nurture_lead)
    db.flush()

    # Create initial step log
    step_log = NurtureStepLog(
        nurture_lead_id=nurture_lead.id,
        step_number=1,
    )
    db.add(step_log)

    db.commit()
    db.refresh(nurture_lead)
    return _build_lead_response(nurture_lead)


# ── PUT /nurture/leads/{id} ──
@router.put("/leads/{lead_id}", response_model=NurtureLeadResponse)
def update_nurture_lead(lead_id: int, data: NurtureLeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(NurtureLead).filter(NurtureLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Nurture lead not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)

    db.commit()
    db.refresh(lead)
    return _build_lead_response(lead)


# ── POST /nurture/leads/{id}/complete-step ──
@router.post("/leads/{lead_id}/complete-step", response_model=NurtureLeadResponse)
def complete_step(lead_id: int, data: CompleteStepRequest, db: Session = Depends(get_db)):
    lead = db.query(NurtureLead).filter(NurtureLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Nurture lead not found")
    if lead.status == NurtureStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Lead is already converted")
    if lead.status == NurtureStatus.LOST:
        raise HTTPException(status_code=400, detail="Lead is marked as lost")

    now = datetime.utcnow()

    # Mark current step log as completed
    current_log = (
        db.query(NurtureStepLog)
        .filter(NurtureStepLog.nurture_lead_id == lead_id, NurtureStepLog.step_number == lead.current_step)
        .first()
    )
    if current_log:
        current_log.completed_at = now
        current_log.notes = data.notes

    # Advance to next step
    if lead.current_step < 5:
        lead.current_step += 1
        # Create log for next step
        next_log = NurtureStepLog(nurture_lead_id=lead_id, step_number=lead.current_step)
        db.add(next_log)

    # Reset quiet state
    lead.status = NurtureStatus.ACTIVE
    lead.last_action_at = now
    lead.quiet_since = None
    lead.followup_stage = None
    lead.next_followup_at = None

    db.commit()
    db.refresh(lead)
    return _build_lead_response(lead)


# ── POST /nurture/leads/{id}/log-followup ──
@router.post("/leads/{lead_id}/log-followup", response_model=NurtureLeadResponse)
def log_followup(lead_id: int, data: LogFollowupRequest, db: Session = Depends(get_db)):
    lead = db.query(NurtureLead).filter(NurtureLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Nurture lead not found")

    now = datetime.utcnow()
    lead.status = NurtureStatus.ACTIVE
    lead.last_action_at = now
    lead.quiet_since = None
    lead.followup_stage = None
    lead.next_followup_at = None
    if data.notes:
        lead.notes = (lead.notes + "\n" + data.notes) if lead.notes else data.notes

    db.commit()
    db.refresh(lead)
    return _build_lead_response(lead)


# ── POST /nurture/leads/{id}/convert ──
@router.post("/leads/{lead_id}/convert", response_model=NurtureLeadResponse)
def convert_lead(lead_id: int, data: ConvertRequest, db: Session = Depends(get_db)):
    lead = db.query(NurtureLead).filter(NurtureLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Nurture lead not found")
    if lead.deal_id:
        raise HTTPException(status_code=400, detail="Lead already has a deal")

    # Create Deal
    deal_title = data.deal_title or f"{lead.prospect.agency_name} - Nurture Pipeline"
    deal_stage = DealStage.PROPOSAL
    if data.deal_stage:
        try:
            deal_stage = DealStage(data.deal_stage)
        except ValueError:
            pass  # Fall back to PROPOSAL

    deal = Deal(
        contact_id=lead.contact_id,
        title=deal_title,
        stage=deal_stage,
        value=data.deal_value,
        probability=50,
    )
    db.add(deal)
    db.flush()

    lead.deal_id = deal.id
    lead.status = NurtureStatus.CONVERTED

    # Also update prospect
    if lead.prospect:
        lead.prospect.converted_deal_id = deal.id

    db.commit()
    db.refresh(lead)
    return _build_lead_response(lead)


# ── POST /nurture/leads/{id}/mark-lost ──
@router.post("/leads/{lead_id}/mark-lost", response_model=NurtureLeadResponse)
def mark_lost(lead_id: int, data: MarkLostRequest, db: Session = Depends(get_db)):
    lead = db.query(NurtureLead).filter(NurtureLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Nurture lead not found")

    lead.status = NurtureStatus.LOST
    if data.notes:
        lead.notes = (lead.notes + "\n" + data.notes) if lead.notes else data.notes

    db.commit()
    db.refresh(lead)
    return _build_lead_response(lead)
```

- [ ] **Step 2: Register the router in `main.py`**

In `backend/app/main.py`, add after line 178 (`app.include_router(tiktok.router, ...)`):

```python
from app.routes import nurture
app.include_router(nurture.router, dependencies=auth_dep)
```

Add the import at the top with the other route imports.

- [ ] **Step 3: Verify the server starts**

```bash
cd backend
venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Hit `http://localhost:8000/docs` and confirm `/nurture/` endpoints appear.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routes/nurture.py backend/app/main.py
git commit -m "feat: add nurture pipeline API routes"
```

---

## Task 4: Modify mark_replied to Skip Deal Creation

**Files:**
- Modify: `backend/app/routes/cold_outreach.py:861-906`

- [ ] **Step 1: Edit the INTERESTED branch in `mark_replied`**

In `backend/app/routes/cold_outreach.py`, replace lines 861-906 (the `if data.response_type == ResponseType.INTERESTED:` block):

**Before (lines 861-906):** Creates Contact + Deal + Interaction + stores IDs.

**After:** Keep Contact + Interaction creation (safety net in case nurture call fails), but remove Deal creation. The `/nurture/from-prospect/` endpoint will reuse the contact via `prospect.converted_contact_id`.

```python
    if data.response_type == ResponseType.INTERESTED:
        # Convert to CRM — create Contact but NOT Deal (Deal deferred to nurture pipeline)
        prospect.status = ProspectStatus.CONVERTED

        # Create Contact (kept here as safety net — /nurture/from-prospect/ will reuse via converted_contact_id)
        contact = Contact(
            name=prospect.agency_name,
            email=prospect.email,
            company=prospect.agency_name,
            source=f"Cold Outreach - {prospect.campaign.name}",
            status=ContactStatus.LEAD,
            notes=f"Converted from cold outreach campaign.\nNiche: {prospect.niche or 'N/A'}\nWebsite: {prospect.website or 'N/A'}"
        )
        db.add(contact)
        db.flush()

        contact_id = contact.id

        # NO Deal creation — deferred to nurture pipeline "Convert to Deal" action

        # Store contact reference on prospect
        prospect.converted_contact_id = contact.id

        # Create Interaction
        is_linkedin = prospect.campaign.campaign_type == CampaignType.LINKEDIN
        interaction = Interaction(
            contact_id=contact.id,
            type=InteractionType.SOCIAL_MEDIA if is_linkedin else InteractionType.EMAIL,
            subject="LinkedIn Outreach Response" if is_linkedin else "Cold Outreach Response",
            notes=data.notes or f"Responded interested to {'LinkedIn' if is_linkedin else 'cold outreach'} campaign",
            interaction_date=datetime.utcnow()
        )
        db.add(interaction)

        message = "Prospect marked as interested. Move to Warm Leads to start nurturing."
```

In the experiment update block (lines 916-938), keep `converted_to_call = True` but **remove** the `latest_experiment.deal_id = deal_id` line (line 935), since no deal is created here. The deal will be linked later when the nurture lead converts.

- [ ] **Step 2: Update MarkRepliedResponse usage**

The response at line 943 still returns `contact_id` and `deal_id` — these will now be `None` for INTERESTED. The frontend will check this and call the nurture endpoint instead. No schema change needed.

- [ ] **Step 3: Verify the endpoint still works for NOT_INTERESTED and OTHER**

Test manually via the API docs:
```
POST /cold-outreach/prospects/{id}/mark-replied
Body: { "response_type": "NOT_INTERESTED" }
```
Should still work as before.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routes/cold_outreach.py
git commit -m "fix: skip deal creation on INTERESTED — deferred to nurture pipeline"
```

---

## Task 5: Scheduler Job for Quiet Detection

**Files:**
- Modify: `backend/app/services/scheduler_service.py`

- [ ] **Step 1: Add the nurture follow-up check function**

Add before `start_scheduler()` in `scheduler_service.py`:

```python
def _nurture_followup_check_blocking():
    """Check for quiet nurture leads and update follow-up stages."""
    from app.database.connection import SessionLocal
    from app.models.nurture import NurtureLead, NurtureStatus, FollowupStage
    from datetime import timedelta

    db = SessionLocal()
    try:
        active_leads = (
            db.query(NurtureLead)
            .filter(NurtureLead.status == NurtureStatus.ACTIVE)
            .all()
        )
        now = datetime.utcnow()
        for lead in active_leads:
            days_quiet = (now - lead.last_action_at).days

            if days_quiet >= 20:
                lead.status = NurtureStatus.LONG_TERM
                lead.followup_stage = FollowupStage.LONG_TERM
                lead.next_followup_at = None
            elif days_quiet >= 10:
                lead.followup_stage = FollowupStage.DAY_10
                lead.next_followup_at = lead.last_action_at + timedelta(days=10)
                if not lead.quiet_since:
                    lead.quiet_since = now
            elif days_quiet >= 5:
                lead.followup_stage = FollowupStage.DAY_5
                lead.next_followup_at = lead.last_action_at + timedelta(days=5)
                if not lead.quiet_since:
                    lead.quiet_since = now
            elif days_quiet >= 2:
                lead.followup_stage = FollowupStage.DAY_2
                lead.next_followup_at = lead.last_action_at + timedelta(days=2)
                if not lead.quiet_since:
                    lead.quiet_since = now
            else:
                lead.followup_stage = None
                lead.next_followup_at = None
                lead.quiet_since = None

        db.commit()
    except Exception as e:
        logger.error("Nurture follow-up check failed: %s", e)
    finally:
        db.close()


async def nurture_followup_check_job():
    """Scheduled job: check nurture leads for follow-up triggers."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _nurture_followup_check_blocking)
```

- [ ] **Step 2: Register the job in `start_scheduler()`**

Add inside `start_scheduler()`, before `scheduler.start()`:

```python
    scheduler.add_job(
        nurture_followup_check_job,
        "interval",
        minutes=30,
        id="nurture_followup_check",
        replace_existing=True,
    )
```

Update the logger message to include "nurture follow-up check every 30 min".

- [ ] **Step 3: Add missing import**

Add `from datetime import datetime` at the top of `scheduler_service.py` if not already present.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/scheduler_service.py
git commit -m "feat: add scheduled nurture follow-up check job"
```

---

## Task 6: Frontend Types + API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript types**

Add to `frontend/src/types/index.ts`:

```typescript
// Nurture Pipeline
export enum NurtureStatus {
  ACTIVE = "ACTIVE",
  QUIET = "QUIET",
  LONG_TERM = "LONG_TERM",
  CONVERTED = "CONVERTED",
  LOST = "LOST",
}

export enum FollowupStage {
  DAY_2 = "DAY_2",
  DAY_5 = "DAY_5",
  DAY_10 = "DAY_10",
  LONG_TERM = "LONG_TERM",
}

export interface NurtureStepLog {
  id: number;
  step_number: number;
  step_name: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface NurtureLead {
  id: number;
  prospect_id: number;
  contact_id: number | null;
  deal_id: number | null;
  campaign_id: number;
  source_channel: string | null;
  current_step: number;
  current_step_name: string;
  status: NurtureStatus;
  quiet_since: string | null;
  last_action_at: string;
  next_followup_at: string | null;
  followup_stage: FollowupStage | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_website: string | null;
  prospect_niche: string | null;
  campaign_name: string | null;
  contact_name: string | null;
  step_logs: NurtureStepLog[];
}

export interface NurtureStats {
  active: number;
  needs_followup: number;
  long_term: number;
  converted: number;
}
```

- [ ] **Step 2: Add API client**

Add to `frontend/src/lib/api.ts`:

```typescript
export const nurtureApi = {
  getStats: async (): Promise<NurtureStats> => {
    const res = await api.get('/nurture/stats');
    return res.data;
  },

  getLeads: async (params?: {
    status?: string;
    current_step?: number;
    needs_followup?: boolean;
    search?: string;
  }): Promise<NurtureLead[]> => {
    const res = await api.get('/nurture/leads', { params });
    return res.data;
  },

  getLead: async (id: number): Promise<NurtureLead> => {
    const res = await api.get(`/nurture/leads/${id}`);
    return res.data;
  },

  createFromProspect: async (prospectId: number, data: {
    source_channel?: string;
    notes?: string;
  }): Promise<NurtureLead> => {
    const res = await api.post(`/nurture/from-prospect/${prospectId}`, data);
    return res.data;
  },

  updateLead: async (id: number, data: {
    notes?: string;
    status?: string;
  }): Promise<NurtureLead> => {
    const res = await api.put(`/nurture/leads/${id}`, data);
    return res.data;
  },

  completeStep: async (id: number, data?: { notes?: string }): Promise<NurtureLead> => {
    const res = await api.post(`/nurture/leads/${id}/complete-step`, data || {});
    return res.data;
  },

  logFollowup: async (id: number, data?: { notes?: string }): Promise<NurtureLead> => {
    const res = await api.post(`/nurture/leads/${id}/log-followup`, data || {});
    return res.data;
  },

  convert: async (id: number, data?: {
    deal_title?: string;
    deal_value?: number;
    deal_stage?: string;
  }): Promise<NurtureLead> => {
    const res = await api.post(`/nurture/leads/${id}/convert`, data || {});
    return res.data;
  },

  markLost: async (id: number, data?: { notes?: string }): Promise<NurtureLead> => {
    const res = await api.post(`/nurture/leads/${id}/mark-lost`, data || {});
    return res.data;
  },
};
```

Add `NurtureLead`, `NurtureStats` to the imports from `@/types` at the top of `api.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat: add nurture pipeline types and API client"
```

---

## Task 7: Frontend — WarmLeadsTab Component

**Files:**
- Create: `frontend/src/pages/outreach/WarmLeadsTab.tsx`

- [ ] **Step 1: Create the WarmLeadsTab component**

This is the main tab component with the stats bar, kanban pipeline, and follow-up list. The full code is described below.

**Component structure:**
1. Fetch data with `useQuery` — `nurtureApi.getLeads()` and `nurtureApi.getStats()`
2. Stats bar — 4 cards: Active, Needs Follow-up, Long-term, Converted
3. Kanban board — 5 columns, one per NURTURE_STEPS. Group leads by `current_step`, filter to ACTIVE/QUIET status.
4. Lead cards — show prospect_name, campaign_name, source_channel, days in step, followup badge
5. "Complete Step" button on each card — calls `nurtureApi.completeStep()`
6. Follow-up section — list of leads where `followup_stage !== null`, sorted by urgency
7. "Done" button on follow-up items — calls `nurtureApi.logFollowup()`
8. Card click → opens `NurtureLeadDetail` slide-out panel

**Key patterns to follow:**
- Use the same card styling as `MultiTouchCampaignsTab` (see existing component)
- Use `cn()` from `@/lib/utils` for conditional classes
- All dark mode pairs from CLAUDE.md
- Use `useMutation` + `queryClient.invalidateQueries({ queryKey: ['nurture-leads'] })` for all mutations

**Kanban column constants:**

```typescript
const NURTURE_STEPS = [
  { step: 1, name: 'Reply with value', color: 'blue' },
  { step: 2, name: 'Free goodwill offer', color: 'purple' },
  { step: 3, name: 'Deliver the free thing', color: 'amber' },
  { step: 4, name: 'Book a call', color: 'green' },
  { step: 5, name: 'Make the offer / close', color: 'emerald' },
];
```

**Follow-up badge logic:**

```typescript
function getFollowupBadge(followup_stage: FollowupStage | null) {
  if (!followup_stage) return { label: 'On track', color: 'green' };
  if (followup_stage === FollowupStage.DAY_2 || followup_stage === FollowupStage.DAY_5)
    return { label: 'Check-in due', color: 'yellow' };
  if (followup_stage === FollowupStage.DAY_10)
    return { label: 'Re-engage', color: 'red' };
  return { label: 'Long-term', color: 'gray' };
}
```

- [ ] **Step 2: Verify it renders**

Start the frontend dev server and navigate to the OutreachHub. The tab won't be wired up yet (that's Task 9), but the component should compile without errors.

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/outreach/WarmLeadsTab.tsx
git commit -m "feat: add WarmLeadsTab component with kanban pipeline"
```

---

## Task 8: Frontend — NurtureLeadDetail Panel

**Files:**
- Create: `frontend/src/components/NurtureLeadDetail.tsx`

- [ ] **Step 1: Create the detail panel component**

Slide-out panel that shows when clicking a lead card. Structure:

1. **Header** — prospect_name, company, campaign badge, close button
2. **Step timeline** — vertical timeline of all 5 steps. Completed steps show green check + date + notes. Current step highlighted. Future steps grayed out.
3. **Actions:**
   - "Mark Step Complete" button (with notes textarea) — `nurtureApi.completeStep()`
   - "Log Follow-up" button (with notes textarea) — `nurtureApi.logFollowup()`
   - "Convert to Deal" button — opens inline form for deal_title, deal_value, deal_stage, calls `nurtureApi.convert()`
   - "Mark Lost" button — `nurtureApi.markLost()`
4. **Info section** — email, website, niche, source channel, entered date
5. **Link** — "View original prospect" link back to outreach campaign

**Follow existing modal/panel patterns** from CLAUDE.md (slide-out from right, `bg-[--exec-surface]`, `border-stone-600/40`).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NurtureLeadDetail.tsx
git commit -m "feat: add NurtureLeadDetail slide-out panel"
```

---

## Task 9: Frontend — Wire Up OutreachHub + ResponseOutcomeModal

**Files:**
- Modify: `frontend/src/pages/OutreachHub.tsx:25-46,293-298`
- Modify: `frontend/src/components/ResponseOutcomeModal.tsx:65-90,109-156`

- [ ] **Step 1: Add Warm Leads tab to OutreachHub**

In `OutreachHub.tsx`:

1. Update the `TabType` union (line 25):
```typescript
type TabType = 'dm-scripts' | 'linkedin-campaigns' | 'multi-touch' | 'warm-leads';
```

2. Add to the `tabs` array (after the multi-touch entry, around line 46):
```typescript
  {
    id: 'warm-leads' as TabType,
    name: 'Warm Leads',
    icon: Heart,  // from lucide-react
    description: 'Nurture replied prospects',
  },
```

3. Add the import for `Heart` from `lucide-react` and `WarmLeadsTab`:
```typescript
import { Heart } from 'lucide-react';
import WarmLeadsTab from './outreach/WarmLeadsTab';
```

4. Add the tab content rendering (after line 297):
```typescript
{activeTab === 'warm-leads' && <WarmLeadsTab />}
```

- [ ] **Step 2: Modify ResponseOutcomeModal for INTERESTED flow**

In `ResponseOutcomeModal.tsx`:

1. Add import for `nurtureApi`:
```typescript
import { coldOutreachApi, nurtureApi } from '@/lib/api';
```

2. Replace the mutation (lines 65-90) with a two-step mutation for INTERESTED:

```typescript
  const markRepliedMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Always call markReplied (updates prospect status + experiment data)
      const result = await coldOutreachApi.markReplied(prospect.id, {
        response_type: selectedOutcome!,
        notes: notes.trim() || undefined,
      });

      // Step 2: If INTERESTED, also create nurture lead
      if (selectedOutcome === ResponseType.INTERESTED) {
        try {
          await nurtureApi.createFromProspect(prospect.id, {
            notes: notes.trim() || undefined,
          });
        } catch (err: unknown) {
          // 409 = already exists, not an error
          if (err instanceof Error && 'response' in err) {
            const axiosErr = err as { response?: { status?: number } };
            if (axiosErr.response?.status !== 409) throw err;
          }
        }
      }

      return result;
    },
    onSuccess: (data) => {
      if (selectedOutcome === ResponseType.INTERESTED) {
        toast.success('Moved to Warm Leads → Reply with value');
        queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
        queryClient.invalidateQueries({ queryKey: ['nurture-stats'] });
      } else {
        toast.success(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign'] });
      queryClient.invalidateQueries({ queryKey: ['multi-touch-campaigns'] });
      onClose();
    },
    onError: () => {
      toast.error('Failed to record response');
    },
  });
```

3. Clean up the success state code:
   - Remove the `successResult` state variable (line 61: `const [successResult, setSuccessResult] = useState<MarkRepliedResponse | null>(null);`)
   - Remove the entire success state rendering block (lines 109-156, the `if (successResult && successResult.contact_id)` block)
   - Remove the `setSuccessResult(null)` from `handleClose` (line 103)
   - Remove the `CheckCircle`, `ExternalLink` imports from lucide-react, the `Link` import from react-router-dom, and `MarkRepliedResponse` from types import — if no longer used
   - The modal now just closes via `onClose()` in the mutation's `onSuccess` handler

- [ ] **Step 3: Verify the full flow**

1. Start backend + frontend
2. Go to OutreachHub → confirm "Warm Leads" tab appears
3. Go to a multi-touch campaign → click a prospect → Mark Response → select "Interested"
4. Confirm toast says "Moved to Warm Leads → Reply with value"
5. Click "Warm Leads" tab → confirm the lead appears in step 1 column

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/OutreachHub.tsx frontend/src/components/ResponseOutcomeModal.tsx
git commit -m "feat: wire warm leads tab + update response modal for nurture flow"
```

---

## Task 10: Final Verification + Deploy

- [ ] **Step 1: Verify backend starts clean**

```bash
cd backend && venv/Scripts/python -m uvicorn app.main:app --port 8000
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Test the complete flow end-to-end**

1. Mark a prospect as INTERESTED → nurture lead created
2. View in Warm Leads tab → card appears in step 1
3. Click card → detail panel opens
4. Complete step → card moves to step 2
5. Wait (or manually test quiet detection logic via API)
6. Convert to deal → deal created, status = CONVERTED

- [ ] **Step 4: Push to deploy**

```bash
git push
```

Render auto-deploys from main. Verify the migration runs on the production database.
