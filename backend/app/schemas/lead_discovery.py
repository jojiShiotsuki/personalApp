from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re


class LeadSearchRequest(BaseModel):
    """Request to search for business leads."""
    niche: str
    location: str
    count: int = 10

    @field_validator('count')
    @classmethod
    def validate_count(cls, v: int) -> int:
        if v < 1:
            return 5
        if v > 15:
            return 15
        return v

    @field_validator('niche', 'location')
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()


class DiscoveredLead(BaseModel):
    """A lead discovered from AI search."""
    agency_name: str
    email: Optional[str] = None
    contact_name: Optional[str] = None
    website: Optional[str] = None
    niche: Optional[str] = None
    is_duplicate: bool = False
    is_valid_email: bool = False
    confidence: Optional[str] = None
    confidence_signals: Optional[dict] = None
    linkedin_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    email_source: Optional[str] = None


class LeadSearchResponse(BaseModel):
    """Response from lead search."""
    leads: list[DiscoveredLead]
    duplicates_found: int
    valid_for_import: int
    already_saved: int = 0


class LeadImportRequest(BaseModel):
    """Request to import leads to a campaign."""
    leads: list[DiscoveredLead]
    campaign_id: int


class LeadImportResponse(BaseModel):
    """Response from lead import."""
    imported: int
    campaign_name: str


class BulkImportToCampaignRequest(BaseModel):
    """Request to bulk import saved leads to a campaign."""
    lead_ids: list[int]
    campaign_id: int


class BulkImportToCampaignResponse(BaseModel):
    """Response from bulk import."""
    imported_count: int
    skipped_count: int
    skipped_reasons: list[str]


# Email validation regex
EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')

# Placeholder values to filter out
PLACEHOLDER_VALUES = {
    'n/a', 'na', 'not listed', 'not found', 'contact via website',
    'see website', 'none', 'unknown', '-', 'null', 'undefined',
    'not available', 'no email', 'email not found'
}


def is_valid_email(email: Optional[str]) -> bool:
    """Check if email is valid and not a placeholder."""
    if not email:
        return False
    email_lower = email.lower().strip()
    if email_lower in PLACEHOLDER_VALUES:
        return False
    return bool(EMAIL_REGEX.match(email))


def clean_lead_data(lead: dict) -> DiscoveredLead:
    """Clean and validate lead data from AI response."""
    email = lead.get('email')
    email_valid = is_valid_email(email)

    # Clean email if it's a placeholder
    if email and email.lower().strip() in PLACEHOLDER_VALUES:
        email = None

    return DiscoveredLead(
        agency_name=lead.get('agency_name', '').strip(),
        email=email.strip() if email else None,
        contact_name=lead.get('contact_name', '').strip() if lead.get('contact_name') else None,
        website=lead.get('website', '').strip() if lead.get('website') else None,
        niche=lead.get('niche', '').strip() if lead.get('niche') else None,
        is_duplicate=False,
        is_valid_email=email_valid,
        confidence=lead.get('confidence'),
        confidence_signals=lead.get('confidence_signals'),
        linkedin_url=lead.get('linkedin_url'),
        facebook_url=lead.get('facebook_url'),
        instagram_url=lead.get('instagram_url'),
        email_source=lead.get('email_source'),
    )
