from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime, date, timedelta

from app.database import get_db
from app.models.outreach import (
    OutreachCampaign, OutreachProspect, OutreachEmailTemplate,
    OutreachTemplate, OutreachNiche, MultiTouchStep,
    ProspectStatus, ResponseType, CampaignStatus, CampaignType, StepChannelType
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
)

router = APIRouter(prefix="/api/outreach/campaigns", tags=["cold-outreach"])


# ============== HELPER FUNCTIONS ==============

def find_next_step(steps: dict, current_step: int):
    """Find the next step after current_step by sorted step numbers.
    Handles non-contiguous step numbers (e.g., steps 1, 2, 4, 5 after step 3 was deleted)."""
    sorted_nums = sorted(steps.keys())
    for num in sorted_nums:
        if num > current_step:
            return num, steps[num]
    return None, None


# Minimum days between steps when advancing
MIN_STEP_DELAY_DAYS = 3


def calc_next_action_date(current_date, delay_days: int):
    """Calculate next action date relative to the current follow-up date (not today).
    Falls back to today if no current date is set."""
    base = current_date or date.today()
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
    connected = status_counts.get(ProspectStatus.CONNECTED, 0)
    skipped = status_counts.get(ProspectStatus.SKIPPED, 0)
    pending_engagement = status_counts.get(ProspectStatus.PENDING_ENGAGEMENT, 0)
    total = sum(status_counts.values())

    # Count prospects to contact today
    today = date.today()
    actionable_statuses = [ProspectStatus.QUEUED, ProspectStatus.IN_SEQUENCE, ProspectStatus.CONNECTED, ProspectStatus.PENDING_ENGAGEMENT]
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
                channel_type=step_data.channel_type.value,
                delay_days=step_data.delay_days,
                template_subject=step_data.template_subject,
                template_content=step_data.template_content,
                instruction_text=step_data.instruction_text,
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
    db: Session = Depends(get_db)
):
    """List prospects for a campaign, optionally filtered by status."""
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
            ProspectStatus.QUEUED, ProspectStatus.IN_SEQUENCE, ProspectStatus.CONNECTED, ProspectStatus.PENDING_ENGAGEMENT
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

    for idx, row in enumerate(data.data, start=1):
        try:
            # Extract values using column mapping
            mapping = data.column_mapping
            agency_name = row.get(mapping.agency_name, "").strip()
            email = row.get(mapping.email, "").strip() if mapping.email else ""
            linkedin_url = row.get(mapping.linkedin_url, "").strip() if mapping.linkedin_url else ""

            if not agency_name:
                skipped_count += 1
                errors.append(f"Row {idx}: Missing required field (agency_name)")
                continue

            # For email campaigns, require email. For LinkedIn, require linkedin_url.
            # Multi-touch is flexible: accept if either email or linkedin_url present.
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

            # Check for duplicates
            if is_linkedin and linkedin_url:
                existing = db.query(OutreachProspect).filter(
                    OutreachProspect.campaign_id == campaign_id,
                    OutreachProspect.linkedin_url == linkedin_url
                ).first()
                if existing:
                    skipped_count += 1
                    errors.append(f"Row {idx}: Duplicate LinkedIn URL '{linkedin_url}'")
                    continue
            elif is_multi_touch:
                # For multi-touch, check email OR linkedin_url
                if email:
                    existing = db.query(OutreachProspect).filter(
                        OutreachProspect.campaign_id == campaign_id,
                        OutreachProspect.email == email
                    ).first()
                    if existing:
                        skipped_count += 1
                        errors.append(f"Row {idx}: Duplicate email '{email}'")
                        continue
                if linkedin_url:
                    existing = db.query(OutreachProspect).filter(
                        OutreachProspect.campaign_id == campaign_id,
                        OutreachProspect.linkedin_url == linkedin_url
                    ).first()
                    if existing:
                        skipped_count += 1
                        errors.append(f"Row {idx}: Duplicate LinkedIn URL '{linkedin_url}'")
                        continue
            elif email:
                existing = db.query(OutreachProspect).filter(
                    OutreachProspect.campaign_id == campaign_id,
                    OutreachProspect.email == email
                ).first()
                if existing:
                    skipped_count += 1
                    errors.append(f"Row {idx}: Duplicate email '{email}'")
                    continue

            # Extract optional fields
            contact_name = None
            if mapping.contact_name:
                contact_name = row.get(mapping.contact_name, "").strip() or None
            # Support separate first_name + last_name columns (e.g. Apollo exports)
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

            prospect = OutreachProspect(
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
            )
            db.add(prospect)
            imported_count += 1

        except Exception as e:
            skipped_count += 1
            errors.append(f"Row {idx}: {str(e)}")

    db.commit()

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

    prospect.status = ProspectStatus.CONNECTED
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
            channel_type=step_data.channel_type.value,
            delay_days=step_data.delay_days,
            template_subject=step_data.template_subject,
            template_content=step_data.template_content,
            instruction_text=step_data.instruction_text,
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

    prospect.last_contacted_at = datetime.utcnow()

    # Find the actual next step (handles non-contiguous step numbers)
    next_step_num, next_step = find_next_step(steps, current_step)

    if not next_step:
        # Sequence complete
        prospect.status = ProspectStatus.NOT_INTERESTED
        prospect.next_action_date = None
        message = f"Sequence complete after step {current_step}."
    else:
        prospect.current_step = next_step_num
        prospect.next_action_date = calc_next_action_date(prospect.next_action_date, next_step.delay_days)

        # Set status based on next step's channel type
        channel = next_step.channel_type
        if channel in (StepChannelType.EMAIL.value, StepChannelType.FOLLOW_UP_EMAIL.value):
            prospect.status = ProspectStatus.IN_SEQUENCE
        elif channel == StepChannelType.LINKEDIN_CONNECT.value:
            prospect.status = ProspectStatus.PENDING_CONNECTION
        elif channel == StepChannelType.LINKEDIN_MESSAGE.value:
            prospect.status = ProspectStatus.CONNECTED
        elif channel == StepChannelType.LINKEDIN_ENGAGE.value:
            prospect.status = ProspectStatus.PENDING_ENGAGEMENT
        else:
            prospect.status = ProspectStatus.IN_SEQUENCE

        message = f"Step {current_step} complete. Next: step {next_step_num} ({next_step.channel_type}) on {prospect.next_action_date}."

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


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

    # Find the actual next step (handles non-contiguous step numbers)
    next_step_num, next_step = find_next_step(steps, current_step)

    if not next_step:
        prospect.status = ProspectStatus.NOT_INTERESTED
        prospect.next_action_date = None
        message = f"Engagement logged. Sequence complete after step {current_step}."
    else:
        prospect.current_step = next_step_num
        prospect.next_action_date = calc_next_action_date(prospect.next_action_date, next_step.delay_days)

        channel = next_step.channel_type
        if channel in (StepChannelType.EMAIL.value, StepChannelType.FOLLOW_UP_EMAIL.value):
            prospect.status = ProspectStatus.IN_SEQUENCE
        elif channel == StepChannelType.LINKEDIN_CONNECT.value:
            prospect.status = ProspectStatus.PENDING_CONNECTION
        elif channel == StepChannelType.LINKEDIN_MESSAGE.value:
            prospect.status = ProspectStatus.CONNECTED
        elif channel == StepChannelType.LINKEDIN_ENGAGE.value:
            prospect.status = ProspectStatus.PENDING_ENGAGEMENT
        else:
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
    """Mark LinkedIn connection accepted for multi-touch campaigns, advance to next step."""
    prospect = db.query(OutreachProspect).filter(
        OutreachProspect.id == prospect_id,
        OutreachProspect.campaign_id == campaign_id
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    campaign = prospect.campaign
    steps = {s.step_number: s for s in campaign.multi_touch_steps}
    current_step = prospect.current_step

    # Find the actual next step (handles non-contiguous step numbers)
    next_step_num, next_step = find_next_step(steps, current_step)

    if not next_step:
        prospect.status = ProspectStatus.CONNECTED
        prospect.next_action_date = None
        message = f"Connected! Sequence complete after step {current_step}."
    else:
        prospect.current_step = next_step_num
        prospect.next_action_date = calc_next_action_date(prospect.next_action_date, next_step.delay_days)

        channel = next_step.channel_type
        if channel in (StepChannelType.EMAIL.value, StepChannelType.FOLLOW_UP_EMAIL.value):
            prospect.status = ProspectStatus.IN_SEQUENCE
        elif channel == StepChannelType.LINKEDIN_CONNECT.value:
            prospect.status = ProspectStatus.PENDING_CONNECTION
        elif channel == StepChannelType.LINKEDIN_MESSAGE.value:
            prospect.status = ProspectStatus.CONNECTED
        elif channel == StepChannelType.LINKEDIN_ENGAGE.value:
            prospect.status = ProspectStatus.PENDING_ENGAGEMENT
        else:
            prospect.status = ProspectStatus.IN_SEQUENCE

        message = f"Connected! Next: step {next_step_num} ({next_step.channel_type}) on {prospect.next_action_date}."

    db.commit()
    db.refresh(prospect)

    return MarkSentResponse(
        prospect=prospect,
        next_action_date=prospect.next_action_date,
        message=message
    )


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
