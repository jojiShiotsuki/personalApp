from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.outreach import OutreachProspect, OutreachCampaign, ProspectStatus, DiscoveredLead as DiscoveredLeadModel
from app.models.crm import Contact, ContactStatus
from app.schemas.lead_discovery import (
    LeadSearchRequest,
    LeadSearchResponse,
    LeadImportRequest,
    LeadImportResponse,
    DiscoveredLead,
    BulkImportToCampaignRequest,
    BulkImportToCampaignResponse,
    clean_lead_data,
    is_valid_email,
)
from app.services.gemini_service import find_businesses, re_verify_lead

router = APIRouter(prefix="/api/lead-discovery", tags=["lead-discovery"])


def normalize_website(url: str) -> str:
    """
    Normalize a website URL for comparison.
    Removes protocol, www, trailing slashes.
    """
    if not url:
        return ""

    url = url.lower().strip()

    # Remove protocol
    if url.startswith('https://'):
        url = url[8:]
    elif url.startswith('http://'):
        url = url[7:]

    # Remove www
    if url.startswith('www.'):
        url = url[4:]

    # Remove trailing slash
    url = url.rstrip('/')

    return url


def check_duplicate_email(email: str, db: Session) -> bool:
    """Check if email already exists in any campaign."""
    if not email:
        return False
    existing = db.query(OutreachProspect).filter(
        OutreachProspect.email == email
    ).first()
    return existing is not None


def check_duplicate_website(website: str, db: Session) -> DiscoveredLeadModel | None:
    """Check if website already exists in discovered leads."""
    if not website:
        return None
    normalized = normalize_website(website)
    if not normalized:
        return None
    return db.query(DiscoveredLeadModel).filter(
        DiscoveredLeadModel.website_normalized == normalized
    ).first()


def store_discovered_lead(
    lead_data: dict,
    niche: str,
    location: str,
    db: Session
) -> DiscoveredLeadModel | None:
    """Store a new discovered lead in the database."""
    website = lead_data.get('website', '')
    if not website:
        return None

    normalized = normalize_website(website)
    if not normalized:
        return None

    # Check if already exists
    existing = db.query(DiscoveredLeadModel).filter(
        DiscoveredLeadModel.website_normalized == normalized
    ).first()

    if existing:
        # Update email if we found one and didn't have it before
        new_email = lead_data.get('email', '')
        if new_email and new_email.lower() not in ['not listed', 'n/a', 'none', '']:
            if not existing.email or existing.email.lower() in ['not listed', 'n/a', 'none', '']:
                existing.email = new_email
                existing.email_source = lead_data.get('email_source')
        # Update enrichment data
        if lead_data.get('confidence'):
            existing.confidence = lead_data['confidence']
            existing.confidence_signals = lead_data.get('confidence_signals')
        if lead_data.get('linkedin_url'):
            existing.linkedin_url = lead_data['linkedin_url']
        if lead_data.get('facebook_url'):
            existing.facebook_url = lead_data['facebook_url']
        if lead_data.get('instagram_url'):
            existing.instagram_url = lead_data['instagram_url']
        existing.last_enriched_at = datetime.utcnow()
        db.commit()
        return existing

    # Create new record
    new_lead = DiscoveredLeadModel(
        agency_name=lead_data.get('agency_name', ''),
        contact_name=lead_data.get('contact_name'),
        email=lead_data.get('email'),
        website=website,
        website_normalized=normalized,
        niche=lead_data.get('niche') or niche,
        location=location,
        search_query=niche,
        confidence=lead_data.get('confidence'),
        confidence_signals=lead_data.get('confidence_signals'),
        linkedin_url=lead_data.get('linkedin_url'),
        facebook_url=lead_data.get('facebook_url'),
        instagram_url=lead_data.get('instagram_url'),
        email_source=lead_data.get('email_source'),
        last_enriched_at=datetime.utcnow(),
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead


def get_known_emails(db: Session) -> dict[str, str]:
    """
    Get all known emails from discovered_leads table.
    Returns dict mapping normalized website URL to email.
    """
    leads_with_email = db.query(DiscoveredLeadModel).filter(
        DiscoveredLeadModel.email.isnot(None),
        DiscoveredLeadModel.email != '',
        DiscoveredLeadModel.email != 'Not Listed',
    ).all()

    return {
        lead.website_normalized: lead.email
        for lead in leads_with_email
        if lead.website_normalized and lead.email
    }


@router.post("/search", response_model=LeadSearchResponse)
async def search_leads(request: LeadSearchRequest, db: Session = Depends(get_db)):
    """
    Search for business leads using AI.

    - Checks existing discovered leads first to avoid re-scraping
    - Stores new leads in the database
    - Retries with exclusions until target count is reached or search exhausted
    - Returns leads with duplicate and email validation flags.
    """
    # Get known emails to skip scraping for already-discovered leads
    known_emails = get_known_emails(db)

    # Get all existing normalized websites so we can filter them out of results
    existing_websites = {
        lead.website_normalized
        for lead in db.query(DiscoveredLeadModel.website_normalized).all()
        if lead.website_normalized
    }

    # Also include websites from campaign prospects so we don't re-crawl them
    for row in db.query(OutreachProspect.website).all():
        if row.website:
            normalized = normalize_website(row.website)
            if normalized:
                existing_websites.add(normalized)

    # Collect existing agency names (lowered) to catch duplicates even without matching websites
    existing_names = {
        name.lower().strip()
        for (name,) in db.query(DiscoveredLeadModel.agency_name).all()
        if name
    }
    for (name,) in db.query(OutreachProspect.agency_name).all():
        if name:
            existing_names.add(name.lower().strip())

    # Also track original (non-lowered) names for the exclusion prompt
    exclude_display_names: list[str] = []

    target_count = request.count
    max_rounds = 3
    collected_leads: list[DiscoveredLead] = []
    duplicates_found = 0
    valid_for_import = 0
    already_saved_count = 0
    search_exhausted = False
    rounds_searched = 0

    for round_num in range(max_rounds):
        remaining = target_count - len(collected_leads)
        if remaining <= 0:
            break

        rounds_searched += 1
        logger.info(f"Search round {rounds_searched}: looking for {remaining} more leads (excluding {len(exclude_display_names)} businesses)")

        try:
            raw_leads = await find_businesses(
                niche=request.niche,
                location=request.location,
                count=remaining,
                known_emails=known_emails,
                exclude_names=exclude_display_names if exclude_display_names else None,
            )
        except ValueError as e:
            if rounds_searched == 1:
                raise HTTPException(status_code=503, detail=str(e))
            # On subsequent rounds, treat errors as exhaustion
            logger.warning(f"Search round {rounds_searched} failed: {e}")
            search_exhausted = True
            break
        except Exception as e:
            if rounds_searched == 1:
                raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
            logger.warning(f"Search round {rounds_searched} failed: {e}")
            search_exhausted = True
            break

        # Process and dedup this round's results
        new_in_round = 0
        for raw_lead in raw_leads:
            # Skip leads that already existed (by website or name)
            website = raw_lead.get('website', '')
            if website:
                normalized = normalize_website(website)
                if normalized and normalized in existing_websites:
                    already_saved_count += 1
                    continue

            agency_name = raw_lead.get('agency_name', '') or ''
            if agency_name and agency_name.lower().strip() in existing_names:
                already_saved_count += 1
                continue

            # Store in discovered_leads table (only new leads reach here)
            store_discovered_lead(raw_lead, request.niche, request.location, db)

            lead = clean_lead_data(raw_lead)

            # Skip if no agency name
            if not lead.agency_name:
                continue

            # Check for duplicate (already in a campaign)
            if lead.email and check_duplicate_email(lead.email, db):
                lead.is_duplicate = True
                duplicates_found += 1

            # Count valid for import (has valid email and not duplicate)
            if lead.is_valid_email and not lead.is_duplicate:
                valid_for_import += 1

            collected_leads.append(lead)
            new_in_round += 1

            # Add to exclusion sets for next round
            if agency_name:
                existing_names.add(agency_name.lower().strip())
                exclude_display_names.append(agency_name)
            if website:
                normalized = normalize_website(website)
                if normalized:
                    existing_websites.add(normalized)

        logger.info(f"Round {rounds_searched}: found {new_in_round} new leads, {len(collected_leads)}/{target_count} total")

        if new_in_round == 0:
            search_exhausted = True
            break

    return LeadSearchResponse(
        leads=collected_leads,
        duplicates_found=duplicates_found,
        valid_for_import=valid_for_import,
        already_saved=already_saved_count,
        search_exhausted=search_exhausted,
        rounds_searched=rounds_searched,
    )


@router.get("/stored")
async def get_stored_leads(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    niche: str | None = None,
    location: str | None = None,
):
    """
    Get all previously discovered leads from the database.

    Useful for viewing lead history or re-importing leads.
    """
    query = db.query(DiscoveredLeadModel)

    if niche:
        query = query.filter(DiscoveredLeadModel.search_query.ilike(f"%{niche}%"))
    if location:
        query = query.filter(DiscoveredLeadModel.location.ilike(f"%{location}%"))

    total = query.count()
    leads = query.order_by(DiscoveredLeadModel.created_at.desc()).offset(skip).limit(limit).all()

    # Precompute which leads are already in a campaign (by discovered_lead_id)
    lead_ids = [lead.id for lead in leads]
    imported_lead_ids = set()
    if lead_ids:
        imported = db.query(OutreachProspect.discovered_lead_id).filter(
            OutreachProspect.discovered_lead_id.in_(lead_ids)
        ).all()
        imported_lead_ids = {row[0] for row in imported if row[0]}

    return {
        "total": total,
        "leads": [
            {
                "id": lead.id,
                "agency_name": lead.agency_name,
                "contact_name": lead.contact_name,
                "email": lead.email,
                "website": lead.website,
                "niche": lead.niche,
                "location": lead.location,
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
                "is_valid_email": is_valid_email(lead.email) if lead.email else False,
                "is_duplicate": check_duplicate_email(lead.email, db) if lead.email else False,
                "in_campaign": lead.id in imported_lead_ids,
                "confidence": lead.confidence,
                "confidence_signals": lead.confidence_signals,
                "linkedin_url": lead.linkedin_url,
                "facebook_url": lead.facebook_url,
                "instagram_url": lead.instagram_url,
                "email_source": lead.email_source,
                "website_issues": lead.website_issues or [],
                "last_enriched_at": lead.last_enriched_at.isoformat() if lead.last_enriched_at else None,
                "is_disqualified": bool(lead.is_disqualified),
                "search_query": lead.search_query,
            }
            for lead in leads
        ]
    }


@router.get("/stored/stats")
async def get_stored_leads_stats(db: Session = Depends(get_db)):
    """Get statistics about stored leads."""
    total = db.query(DiscoveredLeadModel).count()
    with_email = db.query(DiscoveredLeadModel).filter(
        DiscoveredLeadModel.email.isnot(None),
        DiscoveredLeadModel.email != '',
        DiscoveredLeadModel.email != 'Not Listed',
    ).count()

    high_confidence = db.query(DiscoveredLeadModel).filter(
        DiscoveredLeadModel.confidence == 'high'
    ).count()
    medium_confidence = db.query(DiscoveredLeadModel).filter(
        DiscoveredLeadModel.confidence == 'medium'
    ).count()

    return {
        "total_leads": total,
        "with_email": with_email,
        "without_email": total - with_email,
        "high_confidence": high_confidence,
        "medium_confidence": medium_confidence,
    }


class StoredLeadUpdate(BaseModel):
    agency_name: str | None = None
    contact_name: str | None = None
    email: str | None = None
    website: str | None = None
    niche: str | None = None


@router.put("/stored/{lead_id}")
async def update_stored_lead(
    lead_id: int,
    data: StoredLeadUpdate,
    db: Session = Depends(get_db),
):
    """
    Update a stored discovered lead.

    Allows editing email, contact name, etc. after discovery.
    """
    lead = db.query(DiscoveredLeadModel).filter(DiscoveredLeadModel.id == lead_id).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Update fields if provided (treat empty string same as the value)
    if data.agency_name is not None:
        lead.agency_name = data.agency_name
    if data.contact_name is not None:
        lead.contact_name = data.contact_name or None
    if data.email is not None:
        lead.email = data.email or None
    if data.website is not None and data.website.strip():
        lead.website = data.website
        lead.website_normalized = normalize_website(data.website)
    if data.niche is not None:
        lead.niche = data.niche or None

    try:
        db.commit()
        db.refresh(lead)
    except IntegrityError as e:
        db.rollback()
        logger.error(f"IntegrityError updating lead {lead_id}: {e}")
        raise HTTPException(status_code=409, detail="A lead with this website already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating lead {lead_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update lead: {str(e)}")

    # Check if this lead is already in a campaign
    in_campaign = db.query(OutreachProspect).filter(
        OutreachProspect.website == lead.website
    ).first() is not None

    return {
        "id": lead.id,
        "agency_name": lead.agency_name,
        "contact_name": lead.contact_name,
        "email": lead.email,
        "website": lead.website,
        "niche": lead.niche,
        "location": lead.location,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "confidence": lead.confidence,
        "confidence_signals": lead.confidence_signals,
        "linkedin_url": lead.linkedin_url,
        "facebook_url": lead.facebook_url,
        "instagram_url": lead.instagram_url,
        "email_source": lead.email_source,
        "website_issues": lead.website_issues or [],
        "last_enriched_at": lead.last_enriched_at.isoformat() if lead.last_enriched_at else None,
        "is_disqualified": bool(lead.is_disqualified),
        "is_valid_email": bool(lead.email and is_valid_email(lead.email)),
        "is_duplicate": False,
        "in_campaign": in_campaign,
        "search_query": lead.search_query,
    }


@router.patch("/stored/{lead_id}/disqualify")
async def toggle_disqualify_lead(
    lead_id: int,
    db: Session = Depends(get_db),
):
    """Toggle the disqualified status of a stored lead."""
    lead = db.query(DiscoveredLeadModel).filter(DiscoveredLeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.is_disqualified = not lead.is_disqualified
    db.commit()
    db.refresh(lead)

    return {"id": lead.id, "is_disqualified": lead.is_disqualified}


@router.patch("/stored/{lead_id}/website-issues")
async def update_website_issues(
    lead_id: int,
    issues: list[str],
    db: Session = Depends(get_db),
):
    """Update the website issues list for a stored lead."""
    lead = db.query(DiscoveredLeadModel).filter(DiscoveredLeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.website_issues = issues
    db.commit()
    db.refresh(lead)

    return {
        "id": lead.id,
        "website_issues": lead.website_issues or [],
    }


@router.delete("/stored/{lead_id}")
async def delete_stored_lead(lead_id: int, db: Session = Depends(get_db)):
    """Delete a stored discovered lead."""
    lead = db.query(DiscoveredLeadModel).filter(DiscoveredLeadModel.id == lead_id).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    db.delete(lead)
    db.commit()

    return {"message": "Lead deleted"}


@router.post("/stored/bulk-delete")
async def bulk_delete_stored_leads(lead_ids: list[int], db: Session = Depends(get_db)):
    """Delete multiple stored discovered leads at once."""
    if not lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")

    deleted = db.query(DiscoveredLeadModel).filter(
        DiscoveredLeadModel.id.in_(lead_ids)
    ).delete(synchronize_session='fetch')

    db.commit()

    return {"message": f"{deleted} leads deleted", "deleted_count": deleted}


@router.post("/stored/bulk-import-to-campaign", response_model=BulkImportToCampaignResponse)
async def bulk_import_to_campaign(request: BulkImportToCampaignRequest, db: Session = Depends(get_db)):
    """Import multiple saved leads into an outreach campaign."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Verify campaign exists
        campaign = db.query(OutreachCampaign).filter(
            OutreachCampaign.id == request.campaign_id
        ).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Fetch all requested leads
        leads = db.query(DiscoveredLeadModel).filter(
            DiscoveredLeadModel.id.in_(request.lead_ids)
        ).all()

        # Get existing emails and discovered_lead_ids in this campaign for dedup
        campaign_prospects = db.query(OutreachProspect).filter(
            OutreachProspect.campaign_id == request.campaign_id
        ).all()
        existing_emails = {p.email.lower() for p in campaign_prospects if p.email}
        existing_lead_ids = {p.discovered_lead_id for p in campaign_prospects if p.discovered_lead_id}

        imported_count = 0
        skipped_count = 0
        skipped_reasons = []
        today = date.today()

        for lead in leads:
            has_email = lead.email and is_valid_email(lead.email)
            # Allow leads with website issues (e.g. outdated_design) even without email
            # — these can be reached via contact forms on their site
            issues = lead.website_issues or []
            has_actionable_issues = bool(issues)

            if not has_email and not has_actionable_issues:
                skipped_count += 1
                skipped_reasons.append(f"{lead.agency_name}: no valid email and no website issues tagged")
                continue

            # Check for duplicates in campaign (by discovered_lead_id or email)
            if lead.id in existing_lead_ids:
                skipped_count += 1
                skipped_reasons.append(f"{lead.agency_name}: already in this campaign")
                continue

            if has_email and lead.email.lower() in existing_emails:
                skipped_count += 1
                skipped_reasons.append(f"{lead.agency_name}: email already in this campaign")
                continue

            # Build search source tag
            source_parts = [lead.search_query or lead.niche, lead.location]
            search_source = ' — '.join(p for p in source_parts if p) or None

            # Create prospect
            prospect = OutreachProspect(
                campaign_id=request.campaign_id,
                agency_name=lead.agency_name,
                contact_name=lead.contact_name,
                email=lead.email if has_email else None,
                website=lead.website,
                niche=lead.niche,
                status=ProspectStatus.QUEUED,
                current_step=1,
                next_action_date=today,
                discovered_lead_id=lead.id,
                linkedin_url=lead.linkedin_url,
                facebook_url=lead.facebook_url,
                instagram_url=lead.instagram_url,
                custom_fields={"search_source": search_source} if search_source else None,
            )
            db.add(prospect)
            if has_email:
                existing_emails.add(lead.email.lower())
            imported_count += 1

        db.commit()

        return BulkImportToCampaignResponse(
            imported_count=imported_count,
            skipped_count=skipped_count,
            skipped_reasons=skipped_reasons,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk import failed: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/stored/{lead_id}/re-verify")
async def re_verify_stored_lead(lead_id: int, db: Session = Depends(get_db)):
    """Re-scrape a lead's website for updated email and social links."""
    lead = db.query(DiscoveredLeadModel).filter(DiscoveredLeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if not lead.website or 'google.com/maps' in lead.website:
        raise HTTPException(status_code=400, detail="Cannot re-verify a Google Maps link")

    result = await re_verify_lead(lead.website, lead.agency_name, lead.niche or '')

    # Update lead with new data
    if result["email"]:
        lead.email = result["email"]
        lead.email_source = "scraped"
    if result["linkedin_url"]:
        lead.linkedin_url = result["linkedin_url"]
    if result["facebook_url"]:
        lead.facebook_url = result["facebook_url"]
    if result["instagram_url"]:
        lead.instagram_url = result["instagram_url"]

    lead.confidence = result["confidence"]
    lead.confidence_signals = result["confidence_signals"]
    lead.last_enriched_at = datetime.utcnow()

    db.commit()
    db.refresh(lead)

    return {
        "id": lead.id,
        "email": lead.email,
        "linkedin_url": lead.linkedin_url,
        "facebook_url": lead.facebook_url,
        "instagram_url": lead.instagram_url,
        "confidence": lead.confidence,
        "confidence_signals": lead.confidence_signals,
        "last_enriched_at": lead.last_enriched_at.isoformat() if lead.last_enriched_at else None,
    }


@router.post("/stored/bulk-enrich")
async def bulk_enrich_leads(
    lead_ids: list[int] | None = None,
    db: Session = Depends(get_db),
):
    """
    Bulk enrich leads by scraping their websites for emails and social links.
    If lead_ids is provided, enrich only those leads. Otherwise, enrich all leads
    that have a real website but are missing an email.
    """
    query = db.query(DiscoveredLeadModel)

    if lead_ids:
        query = query.filter(DiscoveredLeadModel.id.in_(lead_ids))
    else:
        # All leads with a real website but no valid email
        query = query.filter(
            DiscoveredLeadModel.website.isnot(None),
            ~DiscoveredLeadModel.website.contains('google.com/maps'),
        ).filter(
            (DiscoveredLeadModel.email.is_(None)) |
            (DiscoveredLeadModel.email == '') |
            (DiscoveredLeadModel.email.in_(['n/a', 'not listed', 'not found', 'none', 'unknown']))
        )

    leads = query.all()

    if not leads:
        return {"enriched": 0, "emails_found": 0, "skipped": 0, "results": []}

    enriched = 0
    emails_found = 0
    skipped = 0
    results = []

    import asyncio
    # Process in batches of 5 to avoid hammering sites
    batch_size = 5
    for i in range(0, len(leads), batch_size):
        batch = leads[i:i + batch_size]
        tasks = []
        for lead in batch:
            if not lead.website or 'google.com/maps' in lead.website:
                skipped += 1
                continue
            tasks.append((lead, re_verify_lead(lead.website, lead.agency_name, lead.niche or '')))

        for lead, task in tasks:
            try:
                result = await task
                updated = False

                if result["email"] and (not lead.email or lead.email in ['', 'n/a', 'not listed', 'not found', 'none', 'unknown']):
                    lead.email = result["email"]
                    lead.email_source = "scraped"
                    emails_found += 1
                    updated = True

                if result["linkedin_url"] and not lead.linkedin_url:
                    lead.linkedin_url = result["linkedin_url"]
                    updated = True
                if result["facebook_url"] and not lead.facebook_url:
                    lead.facebook_url = result["facebook_url"]
                    updated = True
                if result["instagram_url"] and not lead.instagram_url:
                    lead.instagram_url = result["instagram_url"]
                    updated = True

                lead.confidence = result["confidence"]
                lead.confidence_signals = result["confidence_signals"]
                lead.last_enriched_at = datetime.utcnow()
                enriched += 1

                results.append({
                    "id": lead.id,
                    "agency_name": lead.agency_name,
                    "email": lead.email,
                    "email_found": bool(result["email"]),
                    "updated": updated,
                })
            except Exception:
                skipped += 1

    db.commit()

    return {
        "enriched": enriched,
        "emails_found": emails_found,
        "skipped": skipped,
        "results": results,
    }


@router.post("/import", response_model=LeadImportResponse)
async def import_leads(request: LeadImportRequest, db: Session = Depends(get_db)):
    """
    Import discovered leads into a campaign.

    Only imports leads with valid emails that don't already exist.
    """
    # Verify campaign exists
    campaign = db.query(OutreachCampaign).filter(
        OutreachCampaign.id == request.campaign_id
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    imported_count = 0
    today = date.today()

    for lead in request.leads:
        # Skip invalid or duplicate leads
        if not lead.is_valid_email or lead.is_duplicate:
            continue

        if not lead.email:
            continue

        # Double-check for duplicates (in case of race condition)
        if check_duplicate_email(lead.email, db):
            continue

        # Create prospect
        prospect = OutreachProspect(
            campaign_id=request.campaign_id,
            agency_name=lead.agency_name,
            contact_name=lead.contact_name,
            email=lead.email,
            website=lead.website,
            niche=lead.niche,
            linkedin_url=lead.linkedin_url,
            facebook_url=lead.facebook_url,
            instagram_url=lead.instagram_url,
            status=ProspectStatus.QUEUED,
            current_step=1,
            next_action_date=today,
        )

        # Try to link back to discovered lead by website
        if lead.website:
            normalized = normalize_website(lead.website)
            if normalized:
                discovered = db.query(DiscoveredLeadModel).filter(
                    DiscoveredLeadModel.website_normalized == normalized
                ).first()
                if discovered:
                    prospect.discovered_lead_id = discovered.id

        db.add(prospect)
        imported_count += 1

    db.commit()

    return LeadImportResponse(
        imported=imported_count,
        campaign_name=campaign.name,
    )


@router.post("/convert-to-contact/{lead_id}")
async def convert_lead_to_contact(lead_id: int, db: Session = Depends(get_db)):
    """
    Convert a discovered lead to a CRM Contact.

    Creates a new Contact with the lead's information.
    """
    lead = db.query(DiscoveredLeadModel).filter(DiscoveredLeadModel.id == lead_id).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Check if contact with same email already exists
    if lead.email:
        existing_contact = db.query(Contact).filter(Contact.email == lead.email).first()
        if existing_contact:
            raise HTTPException(
                status_code=400,
                detail=f"A contact with this email already exists: {existing_contact.name}"
            )

    # Create new contact
    contact = Contact(
        name=lead.contact_name or lead.agency_name,
        email=lead.email,
        company=lead.agency_name,
        status=ContactStatus.LEAD,
        source="Lead Discovery",
        notes=f"Website: {lead.website}\nNiche: {lead.niche}\nLocation: {lead.location}",
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)

    return {
        "message": "Lead converted to contact successfully",
        "contact": {
            "id": contact.id,
            "name": contact.name,
            "email": contact.email,
            "company": contact.company,
            "status": contact.status.value,
        }
    }
