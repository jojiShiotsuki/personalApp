from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, case, nullslast
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.nurture import (
    NurtureLead, NurtureStepLog, NurtureStatus, FollowupStage, NURTURE_STEPS,
)
from app.models.outreach import OutreachProspect, ProspectStatus
from app.models.crm import Contact, ContactStatus, Deal, DealStage, Interaction, InteractionType
from app.schemas.nurture import (
    NurtureLeadResponse, NurtureLeadCreate, NurtureLeadUpdate,
    NurtureStepLogResponse, NurtureStatsResponse,
    CompleteStepRequest, LogFollowupRequest, ConvertRequest, MarkLostRequest,
)

router = APIRouter(prefix="/api/nurture", tags=["nurture"])


def _build_lead_response(lead: NurtureLead) -> NurtureLeadResponse:
    """Manually construct NurtureLeadResponse with joined fields from relationships."""
    prospect = lead.prospect
    campaign = lead.campaign
    contact = lead.contact

    step_logs = [
        NurtureStepLogResponse(
            id=log.id,
            step_number=log.step_number,
            step_name=NURTURE_STEPS.get(log.step_number, f"Step {log.step_number}"),
            completed_at=log.completed_at,
            notes=log.notes,
            created_at=log.created_at,
        )
        for log in (lead.step_logs or [])
    ]

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
        prospect_name=prospect.agency_name if prospect else None,
        prospect_contact_name=prospect.contact_name if prospect else None,
        prospect_email=prospect.email if prospect else None,
        prospect_website=prospect.website if prospect else None,
        prospect_niche=prospect.niche if prospect else None,
        prospect_linkedin_url=prospect.linkedin_url if prospect else None,
        prospect_facebook_url=prospect.facebook_url if prospect else None,
        prospect_instagram_url=prospect.instagram_url if prospect else None,
        prospect_linkedin_connected=prospect.linkedin_connected if prospect else False,
        campaign_name=campaign.name if campaign else None,
        contact_name=contact.name if contact else None,
        step_logs=step_logs,
    )


def _load_lead(db: Session, lead_id: int) -> NurtureLead:
    """Load a NurtureLead with all relationships, or raise 404."""
    lead = (
        db.query(NurtureLead)
        .options(
            joinedload(NurtureLead.prospect),
            joinedload(NurtureLead.campaign),
            joinedload(NurtureLead.contact),
            joinedload(NurtureLead.deal),
            joinedload(NurtureLead.step_logs),
        )
        .filter(NurtureLead.id == lead_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Nurture lead not found")
    return lead


# ──────────────────────────────────────────
# GET /nurture/stats
# ──────────────────────────────────────────
@router.get("/stats", response_model=NurtureStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Counts for active, needs_followup, long_term, converted."""
    active = db.query(func.count(NurtureLead.id)).filter(
        NurtureLead.status == NurtureStatus.ACTIVE,
    ).scalar() or 0

    needs_followup = db.query(func.count(NurtureLead.id)).filter(
        NurtureLead.status.in_([NurtureStatus.ACTIVE, NurtureStatus.QUIET]),
        NurtureLead.next_followup_at <= datetime.utcnow(),
    ).scalar() or 0

    long_term = db.query(func.count(NurtureLead.id)).filter(
        NurtureLead.status == NurtureStatus.LONG_TERM,
    ).scalar() or 0

    converted = db.query(func.count(NurtureLead.id)).filter(
        NurtureLead.status == NurtureStatus.CONVERTED,
    ).scalar() or 0

    return NurtureStatsResponse(
        active=active,
        needs_followup=needs_followup,
        long_term=long_term,
        converted=converted,
    )


# ──────────────────────────────────────────
# GET /nurture/leads
# ──────────────────────────────────────────
@router.get("/leads", response_model=list[NurtureLeadResponse])
def list_leads(
    status: Optional[NurtureStatus] = None,
    current_step: Optional[int] = None,
    followup_stage: Optional[FollowupStage] = None,
    needs_followup: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List nurture leads with filters."""
    query = (
        db.query(NurtureLead)
        .options(
            joinedload(NurtureLead.prospect),
            joinedload(NurtureLead.campaign),
            joinedload(NurtureLead.contact),
            joinedload(NurtureLead.deal),
            joinedload(NurtureLead.step_logs),
        )
    )

    if status is not None:
        query = query.filter(NurtureLead.status == status)

    if current_step is not None:
        query = query.filter(NurtureLead.current_step == current_step)

    if followup_stage is not None:
        query = query.filter(NurtureLead.followup_stage == followup_stage)

    if needs_followup is True:
        query = query.filter(
            NurtureLead.status.in_([NurtureStatus.ACTIVE, NurtureStatus.QUIET]),
            NurtureLead.next_followup_at <= datetime.utcnow(),
        )

    if search:
        search_term = f"%{search}%"
        query = query.join(
            OutreachProspect, NurtureLead.prospect_id == OutreachProspect.id
        ).filter(
            or_(
                OutreachProspect.agency_name.ilike(search_term),
                OutreachProspect.contact_name.ilike(search_term),
                OutreachProspect.email.ilike(search_term),
            )
        )

    # Order: next_followup_at ASC NULLS LAST, then last_action_at DESC
    query = query.order_by(
        nullslast(NurtureLead.next_followup_at.asc()),
        NurtureLead.last_action_at.desc(),
    )

    leads = query.all()
    # Deduplicate leads that may appear multiple times due to joinedload + join
    seen_ids: set[int] = set()
    unique_leads: list[NurtureLead] = []
    for lead in leads:
        if lead.id not in seen_ids:
            seen_ids.add(lead.id)
            unique_leads.append(lead)

    return [_build_lead_response(lead) for lead in unique_leads]


# ──────────────────────────────────────────
# GET /nurture/leads/{lead_id}
# ──────────────────────────────────────────
@router.get("/leads/{lead_id}", response_model=NurtureLeadResponse)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    """Get a single nurture lead with step logs."""
    lead = _load_lead(db, lead_id)
    return _build_lead_response(lead)


# ──────────────────────────────────────────
# POST /nurture/from-prospect/{prospect_id}
# ──────────────────────────────────────────
@router.post("/from-prospect/{prospect_id}", response_model=NurtureLeadResponse)
def create_from_prospect(
    prospect_id: int,
    data: NurtureLeadCreate,
    db: Session = Depends(get_db),
):
    """Entry point from Response Outcome Modal. Creates NurtureLead + Contact if needed."""
    # Check prospect exists
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    # Check for duplicate nurture lead
    existing = db.query(NurtureLead).filter(NurtureLead.prospect_id == prospect_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="This prospect already has a nurture lead")

    # Create Contact if prospect doesn't have one
    if not prospect.converted_contact_id:
        contact = Contact(
            name=prospect.agency_name,
            email=prospect.email,
            company=prospect.agency_name,
            source=f"Nurture - {prospect.campaign.name}" if prospect.campaign else "Nurture Pipeline",
            status=ContactStatus.LEAD,
            notes=f"Converted from nurture pipeline.\nNiche: {prospect.niche or 'N/A'}\nWebsite: {prospect.website or 'N/A'}",
        )
        db.add(contact)
        db.flush()
        prospect.converted_contact_id = contact.id
    else:
        contact = db.query(Contact).filter(Contact.id == prospect.converted_contact_id).first()

    # Set prospect status to CONVERTED
    prospect.status = ProspectStatus.CONVERTED

    # Create NurtureLead at step 1
    now = datetime.utcnow()
    nurture_lead = NurtureLead(
        prospect_id=prospect.id,
        contact_id=prospect.converted_contact_id,
        campaign_id=prospect.campaign_id,
        source_channel=data.source_channel,
        current_step=1,
        status=NurtureStatus.ACTIVE,
        last_action_at=now,
        notes=data.notes,
    )
    db.add(nurture_lead)
    db.flush()

    # Create initial NurtureStepLog
    step_log = NurtureStepLog(
        nurture_lead_id=nurture_lead.id,
        step_number=1,
        notes="Lead entered nurture pipeline",
    )
    db.add(step_log)

    db.commit()

    # Re-load with relationships
    lead = _load_lead(db, nurture_lead.id)
    return _build_lead_response(lead)


# ──────────────────────────────────────────
# PUT /nurture/leads/{lead_id}
# ──────────────────────────────────────────
@router.put("/leads/{lead_id}", response_model=NurtureLeadResponse)
def update_lead(lead_id: int, data: NurtureLeadUpdate, db: Session = Depends(get_db)):
    """Update notes/status/current_step on a nurture lead."""
    lead = _load_lead(db, lead_id)

    if data.notes is not None:
        lead.notes = data.notes
    if data.status is not None:
        lead.status = data.status
    if data.current_step is not None and 1 <= data.current_step <= 5:
        # Create step log if moving to a new step that doesn't have one
        existing_log = (
            db.query(NurtureStepLog)
            .filter(NurtureStepLog.nurture_lead_id == lead_id, NurtureStepLog.step_number == data.current_step)
            .first()
        )
        if not existing_log:
            db.add(NurtureStepLog(nurture_lead_id=lead_id, step_number=data.current_step))
        lead.current_step = data.current_step
        lead.last_action_at = datetime.utcnow()

    lead.updated_at = datetime.utcnow()
    db.commit()

    lead = _load_lead(db, lead_id)
    return _build_lead_response(lead)


# ──────────────────────────────────────────
# POST /nurture/leads/{lead_id}/complete-step
# ──────────────────────────────────────────
@router.post("/leads/{lead_id}/complete-step", response_model=NurtureLeadResponse)
def complete_step(lead_id: int, data: CompleteStepRequest, db: Session = Depends(get_db)):
    """Mark current step done, advance to next, reset quiet state."""
    lead = _load_lead(db, lead_id)

    if lead.status in (NurtureStatus.CONVERTED, NurtureStatus.LOST):
        raise HTTPException(status_code=400, detail=f"Cannot complete step on a {lead.status.value} lead")

    now = datetime.utcnow()

    # Mark the current step log as completed
    current_log = (
        db.query(NurtureStepLog)
        .filter(
            NurtureStepLog.nurture_lead_id == lead.id,
            NurtureStepLog.step_number == lead.current_step,
        )
        .first()
    )
    if current_log:
        current_log.completed_at = now
        if data.notes:
            current_log.notes = data.notes

    # Advance to next step
    max_step = max(NURTURE_STEPS.keys())
    if lead.current_step < max_step:
        lead.current_step += 1

        # Create new step log for the next step
        new_log = NurtureStepLog(
            nurture_lead_id=lead.id,
            step_number=lead.current_step,
        )
        db.add(new_log)

    # Reset quiet state if needed
    if lead.status in (NurtureStatus.QUIET, NurtureStatus.LONG_TERM):
        lead.status = NurtureStatus.ACTIVE

    lead.quiet_since = None
    lead.last_action_at = now
    lead.updated_at = now

    db.commit()

    lead = _load_lead(db, lead_id)
    return _build_lead_response(lead)


# ──────────────────────────────────────────
# POST /nurture/leads/{lead_id}/log-followup
# ──────────────────────────────────────────
@router.post("/leads/{lead_id}/log-followup", response_model=NurtureLeadResponse)
def log_followup(lead_id: int, data: LogFollowupRequest, db: Session = Depends(get_db)):
    """Log follow-up, reset quiet timer."""
    lead = _load_lead(db, lead_id)

    if lead.status in (NurtureStatus.CONVERTED, NurtureStatus.LOST):
        raise HTTPException(status_code=400, detail=f"Cannot log follow-up on a {lead.status.value} lead")

    now = datetime.utcnow()

    # Reset quiet state if needed
    if lead.status in (NurtureStatus.QUIET, NurtureStatus.LONG_TERM):
        lead.status = NurtureStatus.ACTIVE

    lead.quiet_since = None
    lead.last_action_at = now
    lead.updated_at = now

    # Log an interaction on the contact if linked
    if lead.contact_id:
        interaction = Interaction(
            contact_id=lead.contact_id,
            type=InteractionType.FOLLOW_UP_EMAIL,
            notes=data.notes or f"Nurture follow-up (step {lead.current_step}: {NURTURE_STEPS.get(lead.current_step, '')})",
            date=now,
        )
        db.add(interaction)

    db.commit()

    lead = _load_lead(db, lead_id)
    return _build_lead_response(lead)


# ──────────────────────────────────────────
# POST /nurture/leads/{lead_id}/convert
# ──────────────────────────────────────────
@router.post("/leads/{lead_id}/convert", response_model=NurtureLeadResponse)
def convert_lead(lead_id: int, data: ConvertRequest, db: Session = Depends(get_db)):
    """Create Deal and set status to CONVERTED."""
    lead = _load_lead(db, lead_id)

    if lead.status == NurtureStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Lead is already converted")
    if lead.status == NurtureStatus.LOST:
        raise HTTPException(status_code=400, detail="Cannot convert a lost lead")

    now = datetime.utcnow()

    # Determine deal stage
    deal_stage = DealStage.PROPOSAL
    if data.deal_stage:
        try:
            deal_stage = DealStage(data.deal_stage)
        except ValueError:
            pass  # Fall back to PROPOSAL

    # Determine deal title
    prospect_name = lead.prospect.agency_name if lead.prospect else "Unknown"
    deal_title = data.deal_title or f"Nurture Deal - {prospect_name}"

    # Create Deal
    deal = Deal(
        contact_id=lead.contact_id,
        title=deal_title,
        value=data.deal_value,
        stage=deal_stage,
        probability=50,
    )
    db.add(deal)
    db.flush()

    lead.deal_id = deal.id
    lead.status = NurtureStatus.CONVERTED
    lead.last_action_at = now
    lead.updated_at = now

    db.commit()

    lead = _load_lead(db, lead_id)
    return _build_lead_response(lead)


# ──────────────────────────────────────────
# POST /nurture/leads/{lead_id}/mark-lost
# ──────────────────────────────────────────
@router.post("/leads/{lead_id}/mark-lost", response_model=NurtureLeadResponse)
def mark_lost(lead_id: int, data: MarkLostRequest, db: Session = Depends(get_db)):
    """Set status to LOST."""
    lead = _load_lead(db, lead_id)

    if lead.status == NurtureStatus.LOST:
        raise HTTPException(status_code=400, detail="Lead is already marked as lost")

    now = datetime.utcnow()
    lead.status = NurtureStatus.LOST
    lead.last_action_at = now
    lead.updated_at = now

    if data.notes:
        existing_notes = lead.notes or ""
        lead.notes = f"{existing_notes}\n[LOST] {data.notes}".strip()

    db.commit()

    lead = _load_lead(db, lead_id)
    return _build_lead_response(lead)
