from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from urllib.parse import urlparse

from app.database import get_db
from app.models.outreach import OutreachProspect, OutreachCampaign, ProspectStatus, DiscoveredLead as DiscoveredLeadModel
from app.schemas.lead_discovery import (
    LeadSearchRequest,
    LeadSearchResponse,
    LeadImportRequest,
    LeadImportResponse,
    DiscoveredLead,
    clean_lead_data,
    is_valid_email,
)
from app.services.gemini_service import find_businesses

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
    - Returns leads with duplicate and email validation flags.
    """
    # Get known emails to skip scraping for already-discovered leads
    known_emails = get_known_emails(db)

    try:
        raw_leads = await find_businesses(
            niche=request.niche,
            location=request.location,
            count=request.count,
            known_emails=known_emails,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    # Process and validate leads
    leads: list[DiscoveredLead] = []
    duplicates_found = 0
    valid_for_import = 0

    for raw_lead in raw_leads:
        # Store in discovered_leads table (or update existing)
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

        leads.append(lead)

    return LeadSearchResponse(
        leads=leads,
        duplicates_found=duplicates_found,
        valid_for_import=valid_for_import,
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

    return {
        "total_leads": total,
        "with_email": with_email,
        "without_email": total - with_email,
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
            status=ProspectStatus.QUEUED,
            current_step=1,
            next_action_date=today,
        )
        db.add(prospect)
        imported_count += 1

    db.commit()

    return LeadImportResponse(
        imported=imported_count,
        campaign_name=campaign.name,
    )
