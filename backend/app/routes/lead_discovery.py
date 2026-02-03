from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models.outreach import OutreachProspect, OutreachCampaign, ProspectStatus
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


def check_duplicate(email: str, db: Session) -> bool:
    """Check if email already exists in any campaign."""
    if not email:
        return False
    existing = db.query(OutreachProspect).filter(
        OutreachProspect.email == email
    ).first()
    return existing is not None


@router.post("/search", response_model=LeadSearchResponse)
async def search_leads(request: LeadSearchRequest, db: Session = Depends(get_db)):
    """
    Search for business leads using AI.

    Returns leads with duplicate and email validation flags.
    """
    try:
        raw_leads = await find_businesses(
            niche=request.niche,
            location=request.location,
            count=request.count,
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
        lead = clean_lead_data(raw_lead)

        # Skip if no agency name
        if not lead.agency_name:
            continue

        # Check for duplicate
        if lead.email and check_duplicate(lead.email, db):
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
        if check_duplicate(lead.email, db):
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
