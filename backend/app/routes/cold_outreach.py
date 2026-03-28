from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.outreach import (
    OutreachCampaign, OutreachProspect, OutreachEmailTemplate,
    OutreachTemplate, OutreachNiche, MultiTouchStep, CampaignSearchKeyword,
    ProspectStatus, ResponseType, CampaignStatus, CampaignType, StepChannelType,
    ProspectStepLog,
)
from app.models.crm import Contact, Deal, ContactStatus, DealStage, Interaction, InteractionType
from app.schemas.outreach import (
    CampaignCreate, CampaignUpdate, CampaignResponse, CampaignWithStats, CampaignStats,
    ProspectCreate, ProspectUpdate, ProspectResponse,
    CsvImportRequest, CsvImportResponse,
    MarkSentResponse, MarkRepliedRequest, MarkRepliedResponse,
    EmailTemplateCreate, EmailTemplateResponse,
    RenderedEmail,
    MultiTouchStepCreate, MultiTouchStepResponse,
    SearchKeywordBulkCreate, SearchKeywordResponse, SearchKeywordUpdate,
)

from app.models.autoresearch import Experiment, AuditResult

router = APIRouter(prefix="/api/outreach/campaigns", tags=["cold-outreach"])


def _create_step_experiment(
    db: Session,
    prospect: OutreachProspect,
    step_number: int,
    subject: str | None = None,
    body: str | None = None,
    channel: str = "email",
    loom_script: str | None = None,
) -> None:
    """
    Auto-create an Experiment record when a step is sent/advanced.
    This feeds the autoresearch learning engine with data from ALL steps,
    not just the AI-audited step 1.
    """
    try:
        # Check if an experiment already exists for this prospect + step
        existing = (
            db.query(Experiment)
            .filter(
                Experiment.prospect_id == prospect.id,
                Experiment.step_number == step_number,
            )
            .first()
        )
        if existing:
            # Update sent_at if it was a draft
            if existing.status == "draft":
                existing.status = "sent"
                now = datetime.utcnow()
                existing.sent_at = now
                existing.day_of_week = now.strftime("%A")
                existing.sent_hour = now.hour
            return

        # Try to find the audit for this prospect (for linking)
        audit = (
            db.query(AuditResult)
            .filter(AuditResult.prospect_id == prospect.id)
            .order_by(AuditResult.created_at.desc())
            .first()
        )

        experiment = Experiment(
            prospect_id=prospect.id,
            campaign_id=prospect.campaign_id,
            audit_id=audit.id if audit else None,
            status="sent",
            step_number=step_number,
            # Denormalized audit data (from the original audit if available)
            issue_type=audit.issue_type if audit else None,
            issue_detail=audit.issue_detail if audit else None,
            secondary_issue=audit.secondary_issue if audit else None,
            secondary_detail=audit.secondary_detail if audit else None,
            confidence=audit.confidence if audit else None,
            site_quality=audit.site_quality if audit else None,
            # Email content for this specific step
            subject=subject or prospect.custom_email_subject,
            body=body or prospect.custom_email_body,
            word_count=len((body or prospect.custom_email_body or "").split()) if (body or prospect.custom_email_body) else None,
            was_edited=False,
            # Prospect context snapshot
            niche=prospect.niche,
            city=None,
            state=None,
            company=prospect.agency_name,
            # Send data
            sent_at=datetime.utcnow(),
            day_of_week=datetime.utcnow().strftime("%A"),
            sent_hour=datetime.utcnow().hour,
            step_delay_days=(
                (datetime.utcnow() - prospect.last_contacted_at).days
                if prospect.last_contacted_at and step_number > 1
                else None
            ),
            # Loom data
            loom_script=loom_script or (prospect.custom_fields or {}).get("loom_script"),
            loom_sent=channel.lower() == "loom_email",
        )
        db.add(experiment)
        db.flush()
        logger.info(
            "Auto-created experiment for prospect %d step %d (experiment #%d)",
            prospect.id, step_number, experiment.id,
        )
    except Exception as e:
        logger.warning("Failed to auto-create experiment for prospect %d step %d: %s", prospect.id, step_number, e)


# ============== HELPER FUNCTIONS ==============

def find_next_step(steps: dict, current_step: int, prospect=None):
    """Find the next step after current_step by sorted step numbers.
    Handles non-contiguous step numbers (e.g., steps 1, 2, 4, 5 after step 3 was deleted).
    No longer skips conditional steps — conditions are evaluated at display/execution time."""
    sorted_nums = sorted(steps.keys())
    for num in sorted_nums:
        if num > current_step:
            return num, steps[num]
    return None, None


def evaluate_condition(step, prospect, step_logs: list) -> bool:
    """Returns True if condition is met (proceed normally), False if not met (use fallback).
    If no condition_type is set, always returns True."""
    condition = getattr(step, 'condition_type', None)
    if not condition:
        return True

    condition = condition.upper() if isinstance(condition, str) else condition

    if condition == "LINKEDIN_CONNECTED":
        return getattr(prospect, 'linkedin_connected', False) is True
    elif condition == "EMAIL_REPLIED":
        return any(
            log.outcome.upper() == "REPLIED"
            for log in step_logs
        )
    elif condition == "EMAIL_OPENED":
        return getattr(prospect, 'email_opened', False) is True
    elif condition == "EMAIL_DELIVERED":
        return getattr(prospect, 'email_bounced', False) is not True
    elif condition == "LINKEDIN_REPLIED":
        return getattr(prospect, 'linkedin_replied', False) is True
    elif condition == "STEP_COMPLETED":
        ref = getattr(step, 'condition_step_ref', None)
        return any(
            log.step_number == ref and log.outcome.upper() == "COMPLETED"
            for log in step_logs
        )
    elif condition == "STEP_SKIPPED":
        ref = getattr(step, 'condition_step_ref', None)
        return any(
            log.step_number == ref and log.outcome.upper() == "SKIPPED"
            for log in step_logs
        )
    return True  # Unknown condition — proceed normally


def resolve_step(step, prospect, step_logs: list) -> dict:
    """Returns the effective channel, content, and outcome for a step after condition evaluation.
    Logic: if condition is MET, use FALLBACK. If NOT met, use ORIGINAL.
    This matches the mental model: 'If [condition], do [fallback]; otherwise do [original].'"""
    condition_met = evaluate_condition(step, prospect, step_logs)

    if not condition_met or not step.condition_type:
        # No condition or condition not met — use original step
        return {
            "channel": step.channel_type,
            "subject": step.template_subject,
            "content": step.template_content,
            "instruction": step.instruction_text,
            "outcome": "COMPLETED",
        }
    elif step.fallback_channel_type:
        # Condition met — use fallback
        return {
            "channel": step.fallback_channel_type,
            "subject": getattr(step, 'fallback_template_subject', None),
            "content": getattr(step, 'fallback_template_content', None),
            "instruction": getattr(step, 'fallback_instruction_text', None),
            "outcome": "FALLBACK_USED",
        }
    else:
        # Condition met but no fallback configured — skip
        return {"channel": None, "outcome": "SKIPPED"}


def log_step_outcome(db: Session, prospect, campaign_id: int, step_number: int, outcome: str, channel_used: str = None):
    """Log step outcome to prospect_step_log. Upserts if entry already exists."""
    existing = db.query(ProspectStepLog).filter(
        ProspectStepLog.prospect_id == prospect.id,
        ProspectStepLog.campaign_id == campaign_id,
        ProspectStepLog.step_number == step_number,
    ).first()
    if existing:
        existing.outcome = outcome
        existing.channel_used = channel_used
        existing.completed_at = datetime.utcnow()
    else:
        log_entry = ProspectStepLog(
            prospect_id=prospect.id,
            campaign_id=campaign_id,
            step_number=step_number,
            outcome=outcome,
            channel_used=channel_used,
        )
        db.add(log_entry)


# Minimum days between steps when advancing
MIN_STEP_DELAY_DAYS = 3


def calc_next_action_date(current_date, delay_days: int):
    """Calculate next action date from today or the current follow-up date, whichever is later.
    This ensures the next date is always in the future even if the prospect was overdue."""
    today = date.today()
    base = max(current_date, today) if current_date else today
    return base + timedelta(days=max(delay_days, MIN_STEP_DELAY_DAYS))


def get_campaign_stats(campaign: OutreachCampaign, db: Session) -> CampaignStats:
    """Calculate statistics for a campaign using aggregate queries (avoids loading all prospects)."""
    campaign_id = campaign.id

    # Single aggregate query for all status counts
    status_counts = dict(
        db.query(OutreachProspect.status, func.count(OutreachProspect.id))
        .filter(OutreachProspect.campaign_id == campaign_id)
        .group_by(OutreachProspect.status)
        .all()
    )

    queued = status_counts.get(ProspectStatus.QUEUED, 0)
    in_sequence = status_counts.get(ProspectStatus.IN_SEQUENCE, 0)
    replied = status_counts.get(ProspectStatus.REPLIED, 0)
    not_interested = status_counts.get(ProspectStatus.NOT_INTERESTED, 0)
    converted = status_counts.get(ProspectStatus.CONVERTED, 0)
    pending_connection = status_counts.get(ProspectStatus.PENDING_CONNECTION, 0)
    connected = 0  # LinkedIn connection now tracked via linkedin_connected boolean
    skipped = status_counts.get(ProspectStatus.SKIPPED, 0)
    pending_engagement = status_counts.get(ProspectStatus.PENDING_ENGAGEMENT, 0)
    total = sum(status_counts.values())

    # Count prospects to contact today
    today = date.today()
    actionable_statuses = [ProspectStatus.QUEUED, ProspectStatus.IN_SEQUENCE, ProspectStatus.PENDING_ENGAGEMENT, ProspectStatus.LINKEDIN_FOLLOWUP]
    to_contact_today = db.query(func.count(OutreachProspect.id)).filter(
        OutreachProspect.campaign_id == campaign_id,
        or_(
            OutreachProspect.next_action_date <= today,
            OutreachProspect.next_action_date.is_(None),
        ),
        OutreachProspect.status.in_(actionable_statuses)
    ).scalar() or 0

    # Response rate: (replied + not_interested + converted) / total contacted
    contacted = total - queued - pending_connection - pending_engagement
    response_rate = ((replied + not_interested + converted) / contacted * 100) if contacted > 0 else 0.0

    # Total pipeline value from converted prospects (single join query)
    total_pipeline_value = 0.0
    pipeline_sum = db.query(func.coalesce(func.sum(Deal.value), 0)).join(
        OutreachProspect, OutreachProspect.converted_deal_id == Deal.id
    ).filter(
        OutreachProspect.campaign_id == campaign_id,
        OutreachProspect.converted_deal_id.isnot(None)
    ).scalar()
    total_pipeline_value = float(pipeline_sum or 0)

    return CampaignStats(
        total_prospects=total,
        queued=queued,
        in_sequence=in_sequence,
        replied=replied,
        not_interested=not_interested,
        converted=converted,
        to_contact_today=to_contact_today,
        response_rate=round(response_rate, 1),
        total_pipeline_value=total_pipeline_value,
        skipped=skipped,
        pending_connection=pending_connection,
        connected=connected,
        pending_engagement=pending_engagement,
    )


def get_step_delay(campaign: OutreachCampaign, step: int) -> int:
    """Get the delay in days for a specific step."""
    delays = {
        1: campaign.step_1_delay,
        2: campaign.step_2_delay,
        3: campaign.step_3_delay,
        4: campaign.step_4_delay,
        5: campaign.step_5_delay,
    }
    return delays.get(step, 7)


# ============== GLOBAL PROSPECT SEARCH ==============

@router.get("/search/prospects", response_model=List[ProspectResponse])
def search_prospects(
    q: str,
    db: Session = Depends(get_db)
):
    """Search prospects across all campaigns by agency name, contact name, email, niche, website, notes, or social URLs."""
    if not q or len(q.strip()) < 2:
        return []

    sanitized = q.strip().replace("%", "\\%").replace("_", "\\_")
    search_term = f"%{sanitized}%"
    prospects = db.query(OutreachProspect).filter(
        or_(
            OutreachProspect.agency_name.ilike(search_term),
            OutreachProspect.contact_name.ilike(search_term),
            OutreachProspect.email.ilike(search_term),
            OutreachProspect.niche.ilike(search_term),
            OutreachProspect.website.ilike(search_term),
            OutreachProspect.notes.ilike(search_term),
            OutreachProspect.linkedin_url.ilike(search_term),
            OutreachProspect.facebook_url.ilike(search_term),
            OutreachProspect.instagram_url.ilike(search_term),
        )
    ).order_by(OutreachProspect.id.desc()).limit(50).all()

    return prospects


# ============== CAMPAIGNS ==============

@router.get("", response_model=List[CampaignResponse])
def list_campaigns(
    status: Optional[str] = "ACTIVE",
    campaign_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all campaigns, optionally filtered by status and campaign_type."""
    query = db.query(OutreachCampaign)

    if status:
        try:
            campaign_status = CampaignStatus(status)
            query = query.filter(OutreachCampaign.status == campaign_status)
        except ValueError:
            pass  # Invalid status, return all

    if campaign_type:
        try:
            ct = CampaignType(campaign_type)
            query = query.filter(OutreachCampaign.campaign_type == ct)
        except ValueError:
            pass

    return query.order_by(OutreachCampaign.created_at.desc()).all()


@router.post("", response_model=CampaignResponse, status_code=201)
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db)):
    """Create a new campaign."""
    campaign = OutreachCampaign(
        name=data.name.strip(),
        campaign_type=data.campaign_type,
        step_1_delay=data.step_1_delay,
        step_2_delay=data.step_2_delay,
        step_3_delay=data.step_3_delay,
        step_4_delay=data.step_4_delay,
        step_5_delay=data.step_5_delay,
    )
    db.add(campaign)
    db.flush()

    # Create multi-touch steps if provided
    if data.steps and data.campaign_type == CampaignType.MULTI_TOUCH:
        for step_data in data.steps:
            step = MultiTouchStep(
                campaign_id=campaign.id,
                step_number=step_data.step_number,
                channel_type=step_data.channel_type,
                delay_days=step_data.delay_days,
                template_subject=step_data.template_subject,
                template_content=step_data.template_content,
                instruction_text=step_data.instruction_text,
                loom_script=step_data.loom_script,
                condition_type=step_data.condition_type.value if step_data.condition_type else None,
                condition_step_ref=step_data.condition_step_ref,
                fallback_template_subject=step_data.fallback_template_subject,
                fallback_template_content=step_data.fallback_template_content,
                fallback_instruction_text=step_data.fallback_instruction_text,
            )
            db.add(step)

    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignWithStats)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Get a single campaign with statistics."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    stats = get_campaign_stats(campaign, db)

    return CampaignWithStats(
        id=campaign.id,
        name=campaign.name,
        status=campaign.status,
        campaign_type=campaign.campaign_type,
        step_1_delay=campaign.step_1_delay,
        step_2_delay=campaign.step_2_delay,
        step_3_delay=campaign.step_3_delay,
        step_4_delay=campaign.step_4_delay,
        step_5_delay=campaign.step_5_delay,
        multi_touch_steps=[
            MultiTouchStepResponse.model_validate(s, from_attributes=True)
            for s in campaign.multi_touch_steps
        ],
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        stats=stats
    )


@router.put("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(campaign_id: int, data: CampaignUpdate, db: Session = Depends(get_db)):
    """Update a campaign."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "name" and value:
            value = value.strip()
        setattr(campaign, field, value)

    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Delete a campaign and all its prospects and templates."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db.delete(campaign)
    db.commit()


# ============== PROSPECTS ==============

@router.get("/{campaign_id}/prospects", response_model=List[ProspectResponse])
def list_prospects(
    campaign_id: int,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List prospects for a campaign, optionally filtered by status and/or search term."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(OutreachProspect).filter(OutreachProspect.campaign_id == campaign_id)

    if status:
        try:
            prospect_status = ProspectStatus(status)
            query = query.filter(OutreachProspect.status == prospect_status)
        except ValueError:
            pass  # Invalid status, return all

    if search and len(search.strip()) >= 2:
        sanitized = search.strip().replace("%", "\\%").replace("_", "\\_")
        search_term = f"%{sanitized}%"
        query = query.filter(
            or_(
                OutreachProspect.agency_name.ilike(search_term),
                OutreachProspect.contact_name.ilike(search_term),
                OutreachProspect.email.ilike(search_term),
                OutreachProspect.niche.ilike(search_term),
            )
        )

    return query.order_by(OutreachProspect.id.asc()).all()


@router.get("/{campaign_id}/prospects/today", response_model=List[ProspectResponse])
def get_todays_queue(campaign_id: int, db: Session = Depends(get_db)):
    """Get prospects that need to be contacted today."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    today = date.today()

    prospects = db.query(OutreachProspect).filter(
        OutreachProspect.campaign_id == campaign_id,
        or_(
            OutreachProspect.next_action_date <= today,
            OutreachProspect.next_action_date.is_(None),
        ),
        OutreachProspect.status.in_([
            ProspectStatus.QUEUED, ProspectStatus.IN_SEQUENCE, ProspectStatus.PENDING_ENGAGEMENT, ProspectStatus.LINKEDIN_FOLLOWUP
        ])
    ).order_by(OutreachProspect.id.asc()).all()

    # Enrich multi-touch prospects with step detail and warnings
    if campaign.campaign_type == CampaignType.MULTI_TOUCH:
        steps_map = {s.step_number: s for s in campaign.multi_touch_steps}
        enriched = []
        for p in prospects:
            resp = ProspectResponse.model_validate(p)
            step = steps_map.get(p.current_step)
            if step:
                resp.current_step_detail = MultiTouchStepResponse.model_validate(step)
                # Check for missing data
                warnings = []
                if step.channel_type in (StepChannelType.LINKEDIN_CONNECT.value, StepChannelType.LINKEDIN_MESSAGE.value, StepChannelType.LINKEDIN_ENGAGE.value):
                    if not p.linkedin_url:
                        warnings.append("No LinkedIn URL")
                if step.channel_type in (StepChannelType.EMAIL.value, StepChannelType.FOLLOW_UP_EMAIL.value):
                    if not p.email:
                        warnings.append("No email address")
                resp.missing_data_warnings = warnings if warnings else None

                # Evaluate condition and set step_outcome
                step_logs = db.query(ProspectStepLog).filter(
                    ProspectStepLog.prospect_id == p.id,
                    ProspectStepLog.campaign_id == campaign.id,
                ).all()
                resolved = resolve_step(step, p, step_logs)
                resp.step_outcome = resolved["outcome"]
            enriched.append(resp)
        return enriched

    return prospects


@router.post("/{campaign_id}/prospects", response_model=ProspectResponse, status_code=201)
def create_prospect(campaign_id: int, data: ProspectCreate, db: Session = Depends(get_db)):
    """Create a single prospect."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    prospect = OutreachProspect(
        campaign_id=campaign_id,
        agency_name=data.agency_name.strip(),
        contact_name=data.contact_name.strip() if data.contact_name else None,
        email=data.email.strip() if data.email else '',
        website=data.website.strip() if data.website else None,
        niche=data.niche.strip() if data.niche else None,
        linkedin_url=data.linkedin_url.strip() if data.linkedin_url else None,
        custom_fields=data.custom_fields,
        status=ProspectStatus.QUEUED,
        current_step=1,
        next_action_date=None,
    )
    db.add(prospect)
    db.commit()
    db.refresh(prospect)
    return prospect


@router.post("/{campaign_id}/prospects/import", response_model=CsvImportResponse)
def import_prospects(campaign_id: int, data: CsvImportRequest, db: Session = Depends(get_db)):
    """Bulk import prospects from CSV data."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    imported_count = 0
    skipped_count = 0
    errors = []

    is_linkedin = campaign.campaign_type == CampaignType.LINKEDIN
    is_multi_touch = campaign.campaign_type == CampaignType.MULTI_TOUCH
    mapping = data.column_mapping

    # --- Batch duplicate check: load existing emails & linkedin URLs in 2 queries ---
    existing_emails: set[str] = set()
    existing_linkedin: set[str] = set()

    email_rows = (
        db.query(OutreachProspect.email)
        .filter(OutreachProspect.campaign_id == campaign_id, OutreachProspect.email.isnot(None))
        .all()
    )
    existing_emails = {r[0].lower() for r in email_rows if r[0]}

    li_rows = (
        db.query(OutreachProspect.linkedin_url)
        .filter(OutreachProspect.campaign_id == campaign_id, OutreachProspect.linkedin_url.isnot(None))
        .all()
    )
    existing_linkedin = {r[0].lower() for r in li_rows if r[0]}

    # Also track values seen within this import batch to catch intra-CSV duplicates
    seen_emails: set[str] = set()
    seen_linkedin: set[str] = set()

    CHUNK_SIZE = 100
    pending_prospects: list[OutreachProspect] = []

    for idx, row in enumerate(data.data, start=1):
        try:
            agency_name = row.get(mapping.agency_name, "").strip()
            email = row.get(mapping.email, "").strip() if mapping.email else ""
            linkedin_url = row.get(mapping.linkedin_url, "").strip() if mapping.linkedin_url else ""

            if not agency_name:
                skipped_count += 1
                errors.append(f"Row {idx}: Missing required field (agency_name)")
                continue

            # Validate required channels per campaign type
            if is_linkedin and not linkedin_url:
                skipped_count += 1
                errors.append(f"Row {idx}: Missing LinkedIn URL")
                continue
            elif not is_linkedin and not is_multi_touch and not email:
                skipped_count += 1
                errors.append(f"Row {idx}: Missing email")
                continue
            elif is_multi_touch and not email and not linkedin_url:
                skipped_count += 1
                errors.append(f"Row {idx}: Missing email and LinkedIn URL (need at least one)")
                continue

            # Duplicate check against DB + already-seen in this batch
            email_lower = email.lower() if email else ""
            li_lower = linkedin_url.lower() if linkedin_url else ""

            is_dup = False
            if is_linkedin and li_lower:
                if li_lower in existing_linkedin or li_lower in seen_linkedin:
                    skipped_count += 1
                    errors.append(f"Row {idx}: Duplicate LinkedIn URL '{linkedin_url}'")
                    is_dup = True
            elif is_multi_touch:
                if email_lower and (email_lower in existing_emails or email_lower in seen_emails):
                    skipped_count += 1
                    errors.append(f"Row {idx}: Duplicate email '{email}'")
                    is_dup = True
                elif li_lower and (li_lower in existing_linkedin or li_lower in seen_linkedin):
                    skipped_count += 1
                    errors.append(f"Row {idx}: Duplicate LinkedIn URL '{linkedin_url}'")
                    is_dup = True
            elif email_lower:
                if email_lower in existing_emails or email_lower in seen_emails:
                    skipped_count += 1
                    errors.append(f"Row {idx}: Duplicate email '{email}'")
                    is_dup = True

            if is_dup:
                continue

            # Track this row's values so later rows can't duplicate them
            if email_lower:
                seen_emails.add(email_lower)
            if li_lower:
                seen_linkedin.add(li_lower)

            # Extract optional fields
            contact_name = None
            if mapping.contact_name:
                contact_name = row.get(mapping.contact_name, "").strip() or None
            if not contact_name and (mapping.first_name or mapping.last_name):
                first = row.get(mapping.first_name, "").strip() if mapping.first_name else ""
                last = row.get(mapping.last_name, "").strip() if mapping.last_name else ""
                combined = f"{first} {last}".strip()
                if combined:
                    contact_name = combined

            website = None
            if mapping.website:
                website = row.get(mapping.website, "").strip() or None

            niche = None
            if mapping.niche:
                niche = row.get(mapping.niche, "").strip() or None

            pending_prospects.append(OutreachProspect(
                campaign_id=campaign_id,
                agency_name=agency_name,
                contact_name=contact_name,
                email=email or None,
                website=website,
                niche=niche,
                linkedin_url=linkedin_url or None,
                status=ProspectStatus.QUEUED,
                current_step=1,
                next_action_date=None,
            ))
            imported_count += 1

            # Flush in chunks to avoid huge single transaction
            if len(pending_prospects) >= CHUNK_SIZE:
                try:
                    db.bulk_save_objects(pending_prospects)
                    db.commit()
                except Exception as e:
                    logger.error(f"Bulk insert failed at chunk ending row {idx}: {e}")
                    db.rollback()
                    raise
                pending_prospects.clear()

        except Exception as e:
            skipped_count += 1
            errors.append(f"Row {idx}: {str(e)}")

    # Commit remaining prospects
    if pending_prospects:
        try:
            db.bulk_save_objects(pending_prospects)
            db.commit()
        except Exception as e:
            logger.error(f"Final bulk insert failed: {e}")
            db.rollback()
            raise

    return CsvImportResponse(
        imported_count=imported_count,
        skipped_count=skipped_count,
        errors=errors[:50]  # Limit errors returned
    )


@router.put("/prospects/{prospect_id}", response_model=ProspectResponse)
def update_prospect(prospect_id: int, data: ProspectUpdate, db: Session = Depends(get_db)):
    """Update a prospect."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("agency_name", "contact_name", "email", "website", "niche", "linkedin_url", "facebook_url", "instagram_url") and value:
            value = value.strip()
        setattr(prospect, field, value)

    db.commit()
    db.refresh(prospect)
    return prospect


@router.delete("/prospects/{prospect_id}", status_code=204)
def delete_prospect(prospect_id: int, db: Session = Depends(get_db)):
    """Delete a prospect."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    db.delete(prospect)
    db.commit()


@router.post("/prospects/{prospect_id}/mark-sent", response_model=MarkSentResponse)
def mark_email_sent(prospect_id: int, db: Session = Depends(get_db)):
    """Mark an email as sent, schedule next follow-up."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    campaign = prospect.campaign

    # Update last contacted
    prospect.last_contacted_at = datetime.utcnow()
    prospect.status = ProspectStatus.IN_SEQUENCE

    current_step = prospect.current_step

    # Check if this was the final step (step 5)
    if current_step >= 5:
        # Sequence complete with no response
        prospect.status = ProspectStatus.NOT_INTERESTED
        prospect.next_action_date = None
        message = f"Sequence complete. Prospect marked as not interested after {current_step} emails."
    else:
        # Schedule next step
        next_step = current_step + 1
        delay = max(get_step_delay(campaign, next_step), MIN_STEP_DELAY_DAYS)
        prospect.current_step = next_step
        prospect.next_action_date = calc_next_action_date(prospect.next_action_date, delay)
        message = f"Email {current_step} sent. Next follow-up scheduled for {prospect.next_action_date}."

    # Auto-create experiment for autoresearch learning
    _create_step_experiment(db, prospect, step_number=current_step)

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


@router.post("/prospects/{prospect_id}/mark-replied", response_model=MarkRepliedResponse)
def mark_replied(prospect_id: int, data: MarkRepliedRequest, db: Session = Depends(get_db)):
    """Record a response from a prospect."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect.response_type = data.response_type
    prospect.notes = data.notes
    prospect.next_action_date = None

    contact_id = None
    deal_id = None
    message = ""

    if data.response_type == ResponseType.INTERESTED:
        # Convert to CRM
        prospect.status = ProspectStatus.CONVERTED

        # Create Contact
        contact = Contact(
            name=prospect.agency_name,
            email=prospect.email,
            company=prospect.agency_name,
            source=f"Cold Outreach - {prospect.campaign.name}",
            status=ContactStatus.LEAD,
            notes=f"Converted from cold outreach campaign.\nNiche: {prospect.niche or 'N/A'}\nWebsite: {prospect.website or 'N/A'}"
        )
        db.add(contact)
        db.flush()  # Get the contact ID

        contact_id = contact.id

        # Create Deal
        deal = Deal(
            contact_id=contact.id,
            title=f"{prospect.agency_name} - Cold Outreach",
            stage=DealStage.LEAD,
            probability=10,
        )
        db.add(deal)
        db.flush()

        deal_id = deal.id

        # Store conversion references on prospect
        prospect.converted_contact_id = contact.id
        prospect.converted_deal_id = deal.id

        # Create Interaction - use appropriate type based on campaign
        is_linkedin = prospect.campaign.campaign_type == CampaignType.LINKEDIN
        interaction = Interaction(
            contact_id=contact.id,
            type=InteractionType.SOCIAL_MEDIA if is_linkedin else InteractionType.EMAIL,
            subject="LinkedIn Outreach Response" if is_linkedin else "Cold Outreach Response",
            notes=data.notes or f"Responded interested to {'LinkedIn' if is_linkedin else 'cold outreach'} campaign",
            interaction_date=datetime.utcnow()
        )
        db.add(interaction)

        message = f"Prospect converted to CRM. Contact #{contact_id} and Deal #{deal_id} created."

    elif data.response_type == ResponseType.NOT_INTERESTED:
        prospect.status = ProspectStatus.NOT_INTERESTED
        message = "Prospect marked as not interested."

    else:  # OTHER
        prospect.status = ProspectStatus.REPLIED
        message = "Response recorded. Review notes and decide on next steps."

    # Update the most recent experiment for this prospect with reply data
    try:
        latest_experiment = (
            db.query(Experiment)
            .filter(Experiment.prospect_id == prospect.id)
            .order_by(Experiment.step_number.desc())
            .first()
        )
        if latest_experiment:
            latest_experiment.replied = True
            latest_experiment.reply_at = datetime.utcnow()
            latest_experiment.status = "replied"
            latest_experiment.sentiment = "positive" if data.response_type == ResponseType.INTERESTED else "negative" if data.response_type == ResponseType.NOT_INTERESTED else "neutral"
            latest_experiment.category = data.response_type.value if data.response_type else None
            if latest_experiment.sent_at:
                diff = datetime.utcnow() - latest_experiment.sent_at
                latest_experiment.response_time_minutes = int(diff.total_seconds() / 60)
            if data.response_type == ResponseType.INTERESTED:
                latest_experiment.converted_to_call = True
                latest_experiment.deal_id = deal_id
            logger.info("Updated experiment #%d with reply data for prospect %d", latest_experiment.id, prospect.id)
    except Exception as e:
        logger.warning("Failed to update experiment with reply data for prospect %d: %s", prospect.id, e)

    db.commit()
    db.refresh(prospect)

    return MarkRepliedResponse(
        prospect=prospect,
        contact_id=contact_id,
        deal_id=deal_id,
        message=message
    )


# ============== LINKEDIN-SPECIFIC ENDPOINTS ==============

@router.post("/prospects/{prospect_id}/mark-connection-sent", response_model=MarkSentResponse)
def mark_connection_sent(prospect_id: int, db: Session = Depends(get_db)):
    """Mark a LinkedIn connection request as sent."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect.status = ProspectStatus.PENDING_CONNECTION
    prospect.last_contacted_at = datetime.utcnow()
    prospect.next_action_date = None  # Wait for them to accept

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=None,
        message="Connection request sent. Waiting for acceptance."
    )


@router.post("/prospects/{prospect_id}/mark-connected", response_model=MarkSentResponse)
def mark_connected(prospect_id: int, db: Session = Depends(get_db)):
    """Mark that a LinkedIn prospect accepted the connection."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    campaign = prospect.campaign

    prospect.linkedin_connected = True
    prospect.status = ProspectStatus.IN_SEQUENCE
    # Set current_step to 2 (first message after connection) and schedule for today
    prospect.current_step = 2
    prospect.next_action_date = date.today()

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message="Connection accepted! Ready to send first message."
    )


@router.post("/prospects/{prospect_id}/mark-message-sent", response_model=MarkSentResponse)
def mark_message_sent(prospect_id: int, db: Session = Depends(get_db)):
    """Mark a LinkedIn message as sent (for connected prospects)."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    campaign = prospect.campaign

    prospect.last_contacted_at = datetime.utcnow()
    prospect.status = ProspectStatus.IN_SEQUENCE

    current_step = prospect.current_step

    if current_step >= 5:
        prospect.status = ProspectStatus.NOT_INTERESTED
        prospect.next_action_date = None
        message = f"Sequence complete. Prospect marked as not interested after {current_step} messages."
    else:
        next_step = current_step + 1
        delay = max(get_step_delay(campaign, next_step), MIN_STEP_DELAY_DAYS)
        prospect.current_step = next_step
        prospect.next_action_date = calc_next_action_date(prospect.next_action_date, delay)
        message = f"Message {current_step} sent. Next follow-up scheduled for {prospect.next_action_date}."

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


@router.post("/prospects/{prospect_id}/skip")
def skip_prospect(prospect_id: int, db: Session = Depends(get_db)):
    """Skip/reject a prospect — removes from active queue but keeps for reference."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect.status = ProspectStatus.SKIPPED
    prospect.next_action_date = None
    db.commit()
    db.refresh(prospect)
    return {"message": f"Skipped {prospect.agency_name}", "prospect": prospect}


@router.post("/prospects/{prospect_id}/unskip")
def unskip_prospect(prospect_id: int, db: Session = Depends(get_db)):
    """Restore a skipped prospect back to the queue."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect.status = ProspectStatus.QUEUED
    prospect.current_step = 1
    prospect.next_action_date = None
    db.commit()
    db.refresh(prospect)
    return {"message": f"Restored {prospect.agency_name} to queue", "prospect": prospect}


# ============== MULTI-TOUCH ENDPOINTS ==============

@router.get("/{campaign_id}/steps", response_model=List[MultiTouchStepResponse])
def get_campaign_steps(campaign_id: int, db: Session = Depends(get_db)):
    """Get the ordered list of multi-touch steps for a campaign."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return db.query(MultiTouchStep).filter(
        MultiTouchStep.campaign_id == campaign_id
    ).order_by(MultiTouchStep.step_number).all()


@router.put("/{campaign_id}/steps", response_model=List[MultiTouchStepResponse])
def update_campaign_steps(campaign_id: int, steps: List[MultiTouchStepCreate], db: Session = Depends(get_db)):
    """Replace all steps for a multi-touch campaign."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if len(steps) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 steps allowed")

    # Delete existing steps
    db.query(MultiTouchStep).filter(MultiTouchStep.campaign_id == campaign_id).delete()

    # Create new steps
    new_steps = []
    for step_data in steps:
        step = MultiTouchStep(
            campaign_id=campaign_id,
            step_number=step_data.step_number,
            channel_type=step_data.channel_type,
            delay_days=step_data.delay_days,
            template_subject=step_data.template_subject,
            template_content=step_data.template_content,
            instruction_text=step_data.instruction_text,
            fallback_channel_type=step_data.fallback_channel_type,
            loom_script=step_data.loom_script,
            condition_type=step_data.condition_type.value if step_data.condition_type else None,
            condition_step_ref=step_data.condition_step_ref,
            fallback_template_subject=step_data.fallback_template_subject,
            fallback_template_content=step_data.fallback_template_content,
            fallback_instruction_text=step_data.fallback_instruction_text,
        )
        db.add(step)
        new_steps.append(step)

    db.commit()
    for s in new_steps:
        db.refresh(s)
    return new_steps


@router.post("/{campaign_id}/prospects/{prospect_id}/advance", response_model=MarkSentResponse)
def advance_multi_touch_prospect(campaign_id: int, prospect_id: int, db: Session = Depends(get_db)):
    """Advance a multi-touch prospect to the next step."""
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    campaign = prospect.campaign
    if campaign.campaign_type != CampaignType.MULTI_TOUCH:
        raise HTTPException(status_code=400, detail="Not a multi-touch campaign")

    steps = {s.step_number: s for s in campaign.multi_touch_steps}
    current_step = prospect.current_step

    # Fetch step logs for condition evaluation
    step_logs = db.query(ProspectStepLog).filter(
        ProspectStepLog.prospect_id == prospect.id,
        ProspectStepLog.campaign_id == campaign.id,
    ).all()

    # Log the current step's outcome before advancing
    current_step_obj = steps.get(prospect.current_step)
    if current_step_obj:
        resolved = resolve_step(current_step_obj, prospect, step_logs)
        log_step_outcome(db, prospect, campaign.id, prospect.current_step, resolved["outcome"], resolved.get("channel"))

    prospect.last_contacted_at = datetime.utcnow()

    # Find the actual next step (handles non-contiguous step numbers)
    next_step_num, next_step = find_next_step(steps, current_step, prospect)

    # Re-fetch logs after logging current step
    step_logs = db.query(ProspectStepLog).filter(
        ProspectStepLog.prospect_id == prospect.id,
        ProspectStepLog.campaign_id == campaign.id,
    ).all()

    # Auto-skip consecutive steps whose condition is unmet and have no fallback
    while next_step:
        resolved_next = resolve_step(next_step, prospect, step_logs)
        if resolved_next["outcome"] == "SKIPPED":
            log_step_outcome(db, prospect, campaign.id, next_step_num, "SKIPPED")
            next_step_num, next_step = find_next_step(steps, next_step_num, prospect)
        else:
            break

    if not next_step:
        # Sequence complete — check if we should enter LinkedIn follow-up mode
        if getattr(prospect, 'linkedin_replied', False) and getattr(prospect, 'linkedin_followup_count', 0) < 5:
            prospect.status = ProspectStatus.LINKEDIN_FOLLOWUP
            prospect.next_action_date = calc_next_action_date(date.today(), MIN_STEP_DELAY_DAYS)
            message = f"Sequence complete after step {current_step}. Prospect replied on LinkedIn — entering LinkedIn follow-up mode ({prospect.linkedin_followup_count}/5)."
        else:
            prospect.status = ProspectStatus.NOT_INTERESTED
            prospect.next_action_date = None
            message = f"Sequence complete after step {current_step}."
    else:
        prospect.current_step = next_step_num
        prospect.next_action_date = calc_next_action_date(prospect.next_action_date, next_step.delay_days)

        # Keep status as IN_SEQUENCE — LinkedIn connection is tracked separately
        prospect.status = ProspectStatus.IN_SEQUENCE

        message = f"Step {current_step} complete. Next: step {next_step_num} ({next_step.channel_type}) on {prospect.next_action_date}."

    # Auto-create experiment for autoresearch learning
    current_mt_step = steps.get(current_step)
    _create_step_experiment(
        db, prospect, step_number=current_step,
        subject=current_mt_step.template_subject if current_mt_step else None,
        body=current_mt_step.template_content if current_mt_step else None,
    )

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


@router.post("/{campaign_id}/prospects/{prospect_id}/advance-linkedin-followup")
def advance_linkedin_followup(campaign_id: int, prospect_id: int, db: Session = Depends(get_db)):
    """Advance a LinkedIn follow-up prospect. Increments count, schedules next follow-up or ends sequence."""
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    if prospect.status != ProspectStatus.LINKEDIN_FOLLOWUP:
        raise HTTPException(status_code=400, detail="Prospect is not in LinkedIn follow-up mode")

    prospect.linkedin_followup_count = (prospect.linkedin_followup_count or 0) + 1
    prospect.last_contacted_at = datetime.utcnow()

    if prospect.linkedin_followup_count >= 5:
        # 5 follow-ups done — end the sequence
        prospect.status = ProspectStatus.NOT_INTERESTED
        prospect.next_action_date = None
        message = f"LinkedIn follow-up {prospect.linkedin_followup_count}/5 complete. Sequence ended."
    else:
        # Schedule next follow-up in 3 days
        prospect.next_action_date = calc_next_action_date(date.today(), MIN_STEP_DELAY_DAYS)
        message = f"LinkedIn follow-up {prospect.linkedin_followup_count}/5 sent. Next follow-up on {prospect.next_action_date}."

    db.commit()
    db.refresh(prospect)
    return {"prospect_id": prospect.id, "message": message, "linkedin_followup_count": prospect.linkedin_followup_count, "next_action_date": str(prospect.next_action_date) if prospect.next_action_date else None}


@router.post("/{campaign_id}/prospects/{prospect_id}/mark-engaged", response_model=MarkSentResponse)
def mark_engaged(campaign_id: int, prospect_id: int, db: Session = Depends(get_db)):
    """Mark LinkedIn engagement step as complete for multi-touch campaigns."""
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    campaign = prospect.campaign
    steps = {s.step_number: s for s in campaign.multi_touch_steps}
    current_step = prospect.current_step

    # Log the current step's outcome before advancing
    step_logs = db.query(ProspectStepLog).filter(
        ProspectStepLog.prospect_id == prospect.id,
        ProspectStepLog.campaign_id == campaign.id,
    ).all()
    current_step_obj = steps.get(prospect.current_step)
    if current_step_obj:
        resolved = resolve_step(current_step_obj, prospect, step_logs)
        log_step_outcome(db, prospect, campaign.id, prospect.current_step, resolved["outcome"], resolved.get("channel"))

    # Find the actual next step (handles non-contiguous step numbers)
    next_step_num, next_step = find_next_step(steps, current_step, prospect)

    if not next_step:
        prospect.status = ProspectStatus.NOT_INTERESTED
        prospect.next_action_date = None
        message = f"Engagement logged. Sequence complete after step {current_step}."
    else:
        prospect.current_step = next_step_num
        prospect.next_action_date = calc_next_action_date(prospect.next_action_date, next_step.delay_days)

        # Keep status as IN_SEQUENCE — LinkedIn connection is tracked separately
        prospect.status = ProspectStatus.IN_SEQUENCE

        message = f"Engagement logged. Next: step {next_step_num} ({next_step.channel_type}) on {prospect.next_action_date}."

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


@router.post("/{campaign_id}/prospects/{prospect_id}/mark-mt-connected", response_model=MarkSentResponse)
def mark_mt_connected(campaign_id: int, prospect_id: int, db: Session = Depends(get_db)):
    """Toggle LinkedIn connection accepted status (separate from pipeline status)."""
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect.linkedin_connected = not prospect.linkedin_connected
    message = "LinkedIn connection confirmed" if prospect.linkedin_connected else "LinkedIn connection unmarked"

    # Track LinkedIn acceptance in autoresearch experiments
    if prospect.linkedin_connected:
        try:
            # Find the linkedin_connect experiment for this prospect
            linkedin_exp = (
                db.query(Experiment)
                .filter(
                    Experiment.prospect_id == prospect.id,
                    Experiment.step_number == prospect.current_step,
                )
                .order_by(Experiment.created_at.desc())
                .first()
            )
            if linkedin_exp:
                linkedin_exp.replied = True
                linkedin_exp.reply_at = datetime.utcnow()
                linkedin_exp.sentiment = "positive"
                linkedin_exp.category = "linkedin_accepted"
                if linkedin_exp.sent_at:
                    diff = datetime.utcnow() - linkedin_exp.sent_at
                    linkedin_exp.response_time_minutes = int(diff.total_seconds() / 60)
                logger.info("Tracked LinkedIn acceptance for prospect %d (experiment %d)", prospect.id, linkedin_exp.id)
        except Exception as e:
            logger.warning("Failed to track LinkedIn acceptance for prospect %d: %s", prospect.id, e)

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


@router.post("/{campaign_id}/prospects/{prospect_id}/mark-email-opened")
def mark_email_opened(campaign_id: int, prospect_id: int, db: Session = Depends(get_db)):
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id,
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospect.email_opened = True
    db.commit()
    return {"message": "Email opened marked"}


@router.post("/{campaign_id}/prospects/{prospect_id}/mark-email-bounced")
def mark_email_bounced(campaign_id: int, prospect_id: int, db: Session = Depends(get_db)):
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id,
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospect.email_bounced = True
    db.commit()
    return {"message": "Email bounced marked"}


@router.post("/{campaign_id}/prospects/{prospect_id}/mark-linkedin-replied")
def mark_linkedin_replied(campaign_id: int, prospect_id: int, db: Session = Depends(get_db)):
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id,
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospect.linkedin_replied = True
    log_step_outcome(db, prospect, campaign_id, prospect.current_step, "REPLIED")
    db.commit()
    return {"message": "LinkedIn replied marked"}


# ============== EMAIL TEMPLATES ==============

@router.get("/{campaign_id}/templates", response_model=List[EmailTemplateResponse])
def list_templates(campaign_id: int, db: Session = Depends(get_db)):
    """List email templates for a campaign."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    templates = db.query(OutreachEmailTemplate).filter(
        OutreachEmailTemplate.campaign_id == campaign_id
    ).order_by(OutreachEmailTemplate.step_number).all()

    return templates


@router.post("/{campaign_id}/templates", response_model=EmailTemplateResponse, status_code=201)
def create_or_update_template(campaign_id: int, data: EmailTemplateCreate, db: Session = Depends(get_db)):
    """Create or update an email template (upsert by step_number)."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Check if template exists for this step
    existing = db.query(OutreachEmailTemplate).filter(
        OutreachEmailTemplate.campaign_id == campaign_id,
        OutreachEmailTemplate.step_number == data.step_number
    ).first()

    if existing:
        # Update existing
        existing.subject = data.subject
        existing.body = data.body
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        template = OutreachEmailTemplate(
            campaign_id=campaign_id,
            step_number=data.step_number,
            subject=data.subject,
            body=data.body
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return template


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete an email template."""
    template = db.query(OutreachEmailTemplate).filter(OutreachEmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()


@router.get("/prospects/{prospect_id}/render-email", response_model=RenderedEmail)
def render_email(prospect_id: int, template_type: Optional[str] = None, db: Session = Depends(get_db)):
    """Get the rendered email for a prospect using unified outreach templates.

    If template_type is provided, use that directly. Otherwise, map from prospect's current_step.
    """
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    if not template_type:
        # Map step number to template_type
        step_to_type = {1: 'email_1', 2: 'email_2', 3: 'email_3', 4: 'email_4', 5: 'email_5'}
        template_type = step_to_type.get(prospect.current_step)
        if not template_type:
            raise HTTPException(status_code=400, detail=f"Invalid step {prospect.current_step}")

    # Match prospect niche string to OutreachNiche
    matched_niche = None
    if prospect.niche:
        matched_niche = db.query(OutreachNiche).filter(
            func.lower(OutreachNiche.name) == func.lower(prospect.niche)
        ).first()

    niche_id = matched_niche.id if matched_niche else None

    # Fallback chain: exact niche match → null niche (All Niches default)
    template = None
    if niche_id is not None:
        # Try exact niche match first (any situation, then null situation)
        template = db.query(OutreachTemplate).filter(
            OutreachTemplate.niche_id == niche_id,
            OutreachTemplate.template_type == template_type
        ).first()
    if not template:
        # Fall back to All Niches (null niche_id)
        template = db.query(OutreachTemplate).filter(
            OutreachTemplate.niche_id.is_(None),
            OutreachTemplate.template_type == template_type
        ).first()
    if not template:
        # Last resort: any template with this type
        template = db.query(OutreachTemplate).filter(
            OutreachTemplate.template_type == template_type
        ).first()

    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"No template found for step {prospect.current_step} ({template_type}). Set up templates in the Manage Templates modal."
        )

    # Replace variables
    contact_name = prospect.contact_name or prospect.agency_name

    replacements = {
        "{agency_name}": prospect.agency_name or "",
        "{contact_name}": contact_name or "",
        "{name}": contact_name or "",
        "{company}": prospect.agency_name or "",
        "{niche}": prospect.niche or "",
        "{website}": prospect.website or "",
    }

    subject = template.subject or ""
    body = template.content

    for placeholder, value in replacements.items():
        subject = subject.replace(placeholder, value)
        body = body.replace(placeholder, value)

    return RenderedEmail(
        to_email=prospect.email or "",
        subject=subject,
        body=body,
        prospect_id=prospect.id,
        step_number=prospect.current_step
    )


# ============== SEARCH KEYWORDS ==============

@router.get("/{campaign_id}/search-keywords", response_model=List[SearchKeywordResponse])
def get_search_keywords(campaign_id: int, db: Session = Depends(get_db)):
    """List all search keywords for a campaign."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    keywords = db.query(CampaignSearchKeyword).filter(
        CampaignSearchKeyword.campaign_id == campaign_id
    ).order_by(CampaignSearchKeyword.category, CampaignSearchKeyword.keyword).all()
    return keywords


@router.post("/{campaign_id}/search-keywords/bulk", response_model=List[SearchKeywordResponse])
def bulk_create_search_keywords(
    campaign_id: int,
    data: SearchKeywordBulkCreate,
    db: Session = Depends(get_db)
):
    """Bulk create search keywords for a campaign. Skips duplicates."""
    campaign = db.query(OutreachCampaign).filter(OutreachCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    created = []
    for kw in data.keywords:
        kw_stripped = kw.strip()
        if not kw_stripped:
            continue
        existing = db.query(CampaignSearchKeyword).filter(
            CampaignSearchKeyword.campaign_id == campaign_id,
            CampaignSearchKeyword.category == data.category,
            CampaignSearchKeyword.keyword == kw_stripped,
        ).first()
        if existing:
            continue
        new_kw = CampaignSearchKeyword(
            campaign_id=campaign_id,
            category=data.category,
            keyword=kw_stripped,
        )
        db.add(new_kw)
        created.append(new_kw)

    db.commit()
    for kw in created:
        db.refresh(kw)
    return created


@router.patch("/search-keywords/{keyword_id}/toggle", response_model=SearchKeywordResponse)
def toggle_search_keyword(
    keyword_id: int,
    leads_found: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Toggle the searched status of a keyword."""
    keyword = db.query(CampaignSearchKeyword).filter(CampaignSearchKeyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")

    keyword.is_searched = not keyword.is_searched
    if keyword.is_searched:
        keyword.searched_at = datetime.utcnow()
        if leads_found is not None:
            keyword.leads_found = leads_found
    else:
        keyword.searched_at = None

    db.commit()
    db.refresh(keyword)
    return keyword


@router.patch("/search-keywords/{keyword_id}", response_model=SearchKeywordResponse)
def update_search_keyword(
    keyword_id: int,
    data: SearchKeywordUpdate,
    db: Session = Depends(get_db)
):
    """Update a keyword's fields (leads_found, is_searched) without toggling."""
    keyword = db.query(CampaignSearchKeyword).filter(CampaignSearchKeyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(keyword, key, value)

    db.commit()
    db.refresh(keyword)
    return keyword


@router.delete("/search-keywords/{keyword_id}")
def delete_search_keyword(keyword_id: int, db: Session = Depends(get_db)):
    """Delete a single search keyword."""
    keyword = db.query(CampaignSearchKeyword).filter(CampaignSearchKeyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    db.delete(keyword)
    db.commit()
    return {"message": "Keyword deleted"}


@router.delete("/{campaign_id}/search-keywords/category/{category}")
def delete_search_keyword_category(campaign_id: int, category: str, db: Session = Depends(get_db)):
    """Delete all keywords in a category for a campaign."""
    deleted = db.query(CampaignSearchKeyword).filter(
        CampaignSearchKeyword.campaign_id == campaign_id,
        CampaignSearchKeyword.category == category,
    ).delete()
    db.commit()
    return {"message": f"Deleted {deleted} keywords from category '{category}'"}
