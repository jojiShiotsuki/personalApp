import os
import re
import json
import asyncio
from typing import Optional
from urllib.parse import urljoin
import httpx
from google import genai
from google.genai import types


# Initialize client lazily
_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    """Get or create Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        _client = genai.Client(api_key=api_key)
    return _client


# Schema for structured lead output
LEAD_SCHEMA = types.Schema(
    type=types.Type.ARRAY,
    items=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "agency_name": types.Schema(
                type=types.Type.STRING,
                description="The name of the business or agency."
            ),
            "email": types.Schema(
                type=types.Type.STRING,
                description="Email address if found, otherwise return 'Not Listed'."
            ),
            "contact_name": types.Schema(
                type=types.Type.STRING,
                description="Name of a key contact person or founder."
            ),
            "website": types.Schema(
                type=types.Type.STRING,
                description="The official website URL."
            ),
            "niche": types.Schema(
                type=types.Type.STRING,
                description="The specific industry niche they serve."
            ),
        },
        required=["agency_name", "website"],
    ),
)


# Email regex pattern
EMAIL_PATTERN = re.compile(
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    re.IGNORECASE
)

# Common non-business emails to filter out
EXCLUDED_EMAIL_DOMAINS = {
    'example.com', 'sentry.io', 'wixpress.com', 'w3.org',
    'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
    'twitter.com', 'instagram.com', 'linkedin.com',
}


async def scrape_emails_from_url(url: str, timeout: float = 10.0) -> set[str]:
    """
    Fetch a URL and extract email addresses from the HTML.

    Returns a set of unique email addresses found.
    """
    emails = set()

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        ) as client:
            response = await client.get(url)
            if response.status_code == 200:
                # Extract emails from HTML
                found = EMAIL_PATTERN.findall(response.text)
                for email in found:
                    email_lower = email.lower()
                    domain = email_lower.split('@')[1] if '@' in email_lower else ''
                    # Filter out non-business emails
                    if domain and domain not in EXCLUDED_EMAIL_DOMAINS:
                        # Skip image files and common non-emails
                        if not any(email_lower.endswith(ext) for ext in ['.png', '.jpg', '.gif', '.svg']):
                            emails.add(email_lower)
    except Exception:
        pass  # Silently fail - website might be down or blocked

    return emails


async def scrape_website_for_email(website: str) -> Optional[str]:
    """
    Scrape a business website to find email addresses.

    Checks homepage and common contact pages.
    Returns the first valid email found, or None.
    """
    if not website:
        return None

    # Normalize URL
    if not website.startswith(('http://', 'https://')):
        website = 'https://' + website

    # Pages to check
    pages_to_check = [
        website,  # Homepage
        urljoin(website, '/contact'),
        urljoin(website, '/contact-us'),
        urljoin(website, '/about'),
        urljoin(website, '/about-us'),
    ]

    all_emails = set()

    # Scrape pages concurrently
    tasks = [scrape_emails_from_url(url) for url in pages_to_check]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, set):
            all_emails.update(result)

    # Return first email (prefer info@, contact@, hello@ patterns)
    if all_emails:
        # Prioritize common business email patterns
        for prefix in ['info@', 'contact@', 'hello@', 'sales@', 'enquir']:
            for email in all_emails:
                if email.startswith(prefix):
                    return email
        # Return any email if no preferred pattern found
        return next(iter(all_emails))

    return None


def normalize_url_for_comparison(url: str) -> str:
    """Normalize URL for comparison (lowercase, no protocol, no www, no trailing slash)."""
    if not url:
        return ""
    url = url.lower().strip()
    if url.startswith('https://'):
        url = url[8:]
    elif url.startswith('http://'):
        url = url[7:]
    if url.startswith('www.'):
        url = url[4:]
    return url.rstrip('/')


async def enrich_leads_with_emails(
    leads: list[dict],
    known_emails: dict[str, str] | None = None
) -> list[dict]:
    """
    For leads missing emails, attempt to scrape their websites.

    Args:
        leads: List of lead dictionaries
        known_emails: Dict mapping normalized website URLs to known email addresses.
                      If a website is in this dict with a valid email, skip scraping.
    """
    known_emails = known_emails or {}

    async def enrich_single(lead: dict) -> dict:
        email = lead.get('email', '')
        website = lead.get('website', '')

        # Check if we already have this email in our known emails
        if website:
            normalized_site = normalize_url_for_comparison(website)
            if normalized_site in known_emails:
                known_email = known_emails[normalized_site]
                if known_email and known_email.lower() not in ['not listed', 'n/a', 'none', '']:
                    # Use known email, skip scraping
                    lead['email'] = known_email
                    return lead

        # Check if email is missing or placeholder
        if not email or email.lower() in ['not listed', 'n/a', 'none', '']:
            if website:
                scraped_email = await scrape_website_for_email(website)
                if scraped_email:
                    lead['email'] = scraped_email
        return lead

    # Enrich all leads concurrently
    tasks = [enrich_single(lead) for lead in leads]
    enriched = await asyncio.gather(*tasks)
    return list(enriched)


async def find_businesses(
    niche: str,
    location: str,
    count: int = 10,
    max_retries: int = 3,
    known_emails: dict[str, str] | None = None
) -> list[dict]:
    """
    Search for businesses using Gemini with Google Search.

    Uses two-step approach: Search first, then parse to JSON.
    (Gemini doesn't support structured output with Search tool)

    Args:
        niche: Industry/service type to search for
        location: Geographic location
        count: Number of leads to find (5-15)
        max_retries: Number of retry attempts
        known_emails: Dict mapping normalized website URLs to known emails.
                      Websites in this dict will skip scraping.

    Returns:
        List of business lead dictionaries
    """
    client = get_client()

    # Step 1: Search for businesses using Google Search
    search_prompt = f"""Search Google to find {count} real {niche} businesses in {location}.

CRITICAL REQUIREMENTS:
1. Each business MUST have an actual website URL (like https://example.com). Skip businesses without websites.
2. Search for the business website directly if needed.
3. Find the owner/founder/director name if possible.
4. Find their contact email from their website's contact page if visible.
5. If "{location}" is a country, search across different cities/states.

For each business, provide:
- Business name
- Website URL (REQUIRED - must be a real URL like https://...)
- Contact person name (owner, founder, or director)
- Email address if found
- What specific services they offer

Only include businesses where you found their actual website URL."""

    for attempt in range(max_retries):
        try:
            # First call: Search with grounding
            search_response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=search_prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )

            search_text = search_response.text
            if not search_text:
                raise ValueError("No data received from search")

            # Step 2: Parse results into structured JSON (no Search tool)
            parse_prompt = f"""Parse the following business information into a JSON array.

Business Information:
{search_text}

RULES:
1. ONLY include businesses that have an actual website URL starting with "http://" or "https://"
2. SKIP any business without a real website URL
3. Do NOT use placeholder text like "Information not available" - use "Not Listed" for missing emails only

JSON fields for each business:
- agency_name: The business name (REQUIRED)
- website: Must be a real URL starting with http:// or https:// (REQUIRED - skip business if not available)
- email: Email address if found, otherwise exactly "Not Listed"
- contact_name: Person's name if found, otherwise null
- niche: Their specific services/specialty

Return ONLY the JSON array, nothing else."""

            parse_response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=parse_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=LEAD_SCHEMA,
                ),
            )

            text = parse_response.text
            if not text:
                raise ValueError("No data received from parser")

            try:
                data = json.loads(text)
                if isinstance(data, list):
                    # Filter out leads without valid website URLs
                    valid_leads = []
                    for lead in data:
                        website = lead.get('website', '')
                        # Check for real URL (not placeholder text)
                        if website and (
                            website.startswith('http://') or
                            website.startswith('https://') or
                            '.' in website  # Basic domain check
                        ):
                            # Filter out placeholder responses
                            website_lower = website.lower()
                            if 'not available' not in website_lower and 'information' not in website_lower:
                                valid_leads.append(lead)

                    # Step 3: Scrape websites for missing emails (skip known ones)
                    enriched_data = await enrich_leads_with_emails(valid_leads, known_emails)
                    return enriched_data
                raise ValueError("Response is not a list")
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse AI response: {e}")

        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
                continue
            raise

    return []
