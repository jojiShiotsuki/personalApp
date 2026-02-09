import os
import re
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, quote_plus
import httpx
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


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

# Mailto link pattern
MAILTO_PATTERN = re.compile(
    r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
    re.IGNORECASE
)

# Common non-business emails to filter out
EXCLUDED_EMAIL_DOMAINS = {
    'example.com', 'sentry.io', 'wixpress.com', 'w3.org',
    'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
    'twitter.com', 'instagram.com', 'linkedin.com',
}

# Social media URL patterns
SOCIAL_PATTERNS = {
    'linkedin': re.compile(
        r'https?://(?:www\.)?linkedin\.com/(?:company|in)/[a-zA-Z0-9_-]+/?',
        re.IGNORECASE
    ),
    'facebook': re.compile(
        r'https?://(?:www\.)?facebook\.com/[a-zA-Z0-9._-]+/?',
        re.IGNORECASE
    ),
    'instagram': re.compile(
        r'https?://(?:www\.)?instagram\.com/[a-zA-Z0-9._-]+/?',
        re.IGNORECASE
    ),
}

# Default HTTP headers
HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}


def _filter_email(email: str) -> Optional[str]:
    """Filter and validate a single email. Returns lowercase email or None."""
    email_lower = email.lower()
    domain = email_lower.split('@')[1] if '@' in email_lower else ''
    if not domain or domain in EXCLUDED_EMAIL_DOMAINS:
        return None
    if any(email_lower.endswith(ext) for ext in ['.png', '.jpg', '.gif', '.svg']):
        return None
    return email_lower


def extract_social_links(html: str) -> dict:
    """Extract social media URLs from HTML content."""
    links = {
        'linkedin_url': None,
        'facebook_url': None,
        'instagram_url': None,
    }
    for platform, pattern in SOCIAL_PATTERNS.items():
        match = pattern.search(html)
        if match:
            url = match.group(0).rstrip('/')
            # Skip generic social pages (e.g., facebook.com/sharer)
            skip_slugs = {'sharer', 'share', 'intent', 'dialog', 'plugins', 'tr'}
            slug = url.rstrip('/').split('/')[-1].lower()
            if slug not in skip_slugs:
                links[f'{platform}_url'] = url
    return links


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
            headers=HTTP_HEADERS
        ) as client:
            response = await client.get(url)
            if response.status_code == 200:
                text = response.text
                # Extract emails from HTML body
                for email in EMAIL_PATTERN.findall(text):
                    filtered = _filter_email(email)
                    if filtered:
                        emails.add(filtered)
                # Also extract from mailto: links
                for email in MAILTO_PATTERN.findall(text):
                    filtered = _filter_email(email)
                    if filtered:
                        emails.add(filtered)
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

    # Pages to check (extended coverage)
    pages_to_check = [
        website,  # Homepage
        urljoin(website, '/contact'),
        urljoin(website, '/contact-us'),
        urljoin(website, '/about'),
        urljoin(website, '/about-us'),
        urljoin(website, '/team'),
        urljoin(website, '/our-team'),
        urljoin(website, '/staff'),
        urljoin(website, '/get-in-touch'),
        urljoin(website, '/enquiry'),
        urljoin(website, '/connect'),
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
                    lead['email_source'] = 'scraped'  # was scraped previously
                    return lead

        # Check if email is missing or placeholder
        if not email or email.lower() in ['not listed', 'n/a', 'none', '']:
            if website:
                scraped_email = await scrape_website_for_email(website)
                if scraped_email:
                    lead['email'] = scraped_email
                    lead['email_source'] = 'scraped'
        elif not lead.get('email_source'):
            lead['email_source'] = 'ai_found'
        return lead

    # Enrich all leads concurrently
    tasks = [enrich_single(lead) for lead in leads]
    enriched = await asyncio.gather(*tasks)
    return list(enriched)


async def verify_website_content(
    url: str,
    business_name: str,
    niche: str = '',
    timeout: float = 8.0,
) -> dict:
    """
    Verify a website belongs to the business by checking page content.
    Also extracts social media links from the page.

    Returns dict with verification results and extracted data.
    """
    result = {
        'verified': False,
        'reachable': False,
        'social_links': {'linkedin_url': None, 'facebook_url': None, 'instagram_url': None},
    }

    if not url or 'google.com/maps' in url:
        return result

    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers=HTTP_HEADERS
        ) as client:
            response = await client.get(url)
            if response.status_code >= 400:
                return result

            result['reachable'] = True
            html = response.text
            text_lower = html.lower()

            # Extract social links
            result['social_links'] = extract_social_links(html)

            # Check if content matches business name (fuzzy)
            name_words = [w.lower() for w in business_name.split() if len(w) > 3]
            if name_words:
                matches = sum(1 for w in name_words if w in text_lower)
                # Verified if at least half the significant words appear
                if matches >= max(1, len(name_words) // 2):
                    result['verified'] = True
                    return result

            # Fallback: check if niche keywords appear
            if niche:
                niche_words = [w.lower() for w in niche.split() if len(w) > 3]
                niche_matches = sum(1 for w in niche_words if w in text_lower)
                if niche_matches >= 2:
                    result['verified'] = True

    except Exception:
        pass

    return result


def make_google_maps_url(business_name: str, location: str) -> str:
    """Generate a Google Maps search URL for a business."""
    query = f"{business_name} {location}"
    return f"https://www.google.com/maps/search/{quote_plus(query)}"


def calculate_confidence(signals: dict) -> tuple[str, dict]:
    """
    Calculate confidence level based on enrichment signals.

    Returns (confidence_level, signals_dict)
    """
    score = 0
    if signals.get('website_verified'):
        score += 3
    if signals.get('email_scraped'):
        score += 2
    if signals.get('social_links_found'):
        score += 1
    if signals.get('multi_query_hits', 0) >= 2:
        score += 2

    if score >= 6:
        level = 'high'
    elif score >= 3:
        level = 'medium'
    else:
        level = 'low'

    return level, signals


async def _run_single_search(
    client: genai.Client,
    search_prompt: str,
    parse_prompt_template: str,
) -> tuple[list[dict], dict]:
    """
    Run a single Gemini search + parse cycle.

    Returns (list of lead dicts, dict of grounded URLs).
    """
    # Step 1: Search with Google Search grounding
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
        return [], {}

    # Extract grounded URLs from search metadata
    grounded_urls = {}
    try:
        for candidate in (search_response.candidates or []):
            metadata = candidate.grounding_metadata
            if metadata and metadata.grounding_chunks:
                for chunk in metadata.grounding_chunks:
                    if chunk.web and chunk.web.uri and chunk.web.title:
                        grounded_urls[chunk.web.title.lower()] = chunk.web.uri
    except Exception as e:
        logger.debug(f"Could not extract grounding metadata: {e}")

    # Step 2: Parse to structured JSON
    parse_prompt = parse_prompt_template.format(search_text=search_text)

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
        return [], grounded_urls

    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data, grounded_urls
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")

    return [], grounded_urls


async def find_businesses(
    niche: str,
    location: str,
    count: int = 10,
    max_retries: int = 3,
    known_emails: dict[str, str] | None = None
) -> list[dict]:
    """
    Search for businesses using Gemini with Google Search.

    Uses multi-query strategy with content verification and confidence scoring.

    Args:
        niche: Industry/service type to search for
        location: Geographic location
        count: Number of leads to find (5-15)
        max_retries: Number of retry attempts
        known_emails: Dict mapping normalized website URLs to known emails.
                      Websites in this dict will skip scraping.

    Returns:
        List of business lead dictionaries with enrichment data
    """
    client = get_client()

    # Build multiple search prompts for cross-referencing
    search_prompts = [
        f"""Find {count} real {niche} businesses in {location}.

For each business, provide:
- The exact business name
- Their official website URL (the actual domain they use)
- Contact email if visible on their site
- A contact person / owner name if known
- Their specific services or niche

IMPORTANT: Use your search results to find REAL businesses with REAL website URLs.
Only include businesses you can verify actually exist.""",

        f"""List the best {niche} in {location} with their official websites and contact information.

For each business provide:
- Business name
- Official website URL
- Email address if available
- Owner or key contact name
- What services they specialize in

Focus on well-established businesses with real websites.""",
    ]

    # Add a third query for larger searches
    if count >= 8:
        search_prompts.append(
            f"""Search for {niche} directory listings and reviews in {location}.

Find businesses that appear in local directories, Google reviews, or industry listings.
For each business provide:
- Business name
- Website URL
- Contact email
- Contact person name
- Their specialty or niche"""
        )

    parse_template = """Parse the following business information into a JSON array.

Business Information:
{search_text}

RULES:
1. Include the real website URL for each business if mentioned
2. If no website URL is mentioned for a business, use "Not Listed" as the website
3. Do NOT make up or guess website URLs
4. Use "Not Listed" for missing emails

JSON fields for each business:
- agency_name: The business name (REQUIRED)
- website: The real website URL if known, otherwise exactly "Not Listed"
- email: Email address if found, otherwise exactly "Not Listed"
- contact_name: Person's name if found, otherwise null
- niche: Their specific services/specialty

Return ONLY the JSON array, nothing else."""

    for attempt in range(max_retries):
        try:
            # Run multiple searches concurrently
            search_tasks = [
                _run_single_search(client, prompt, parse_template)
                for prompt in search_prompts
            ]
            all_results = await asyncio.gather(*search_tasks, return_exceptions=True)

            # Merge results and track hit counts
            merged: dict[str, dict] = {}  # normalized_url -> {data, hit_count, grounded_urls}
            all_grounded_urls: dict[str, str] = {}

            for result in all_results:
                if isinstance(result, Exception):
                    logger.warning(f"Search query failed: {result}")
                    continue

                leads, grounded_urls = result
                all_grounded_urls.update(grounded_urls)

                for lead in leads:
                    agency_name = lead.get('agency_name', '') or ''
                    if not agency_name:
                        continue

                    website = lead.get('website', '') or ''
                    # Use agency name as fallback key if no website
                    key = normalize_url_for_comparison(website) if website and website.lower() not in [
                        'not listed', 'n/a', 'none', 'unknown', ''
                    ] else agency_name.lower().strip()

                    if key in merged:
                        merged[key]['hit_count'] += 1
                        # Prefer data with more info
                        existing = merged[key]['data']
                        if not existing.get('email') and lead.get('email'):
                            existing['email'] = lead['email']
                        if not existing.get('contact_name') and lead.get('contact_name'):
                            existing['contact_name'] = lead['contact_name']
                    else:
                        merged[key] = {'data': lead, 'hit_count': 1}

            if not merged:
                raise ValueError("No results from any search query")

            logger.info(f"Merged {len(merged)} unique leads from {len(search_prompts)} queries")

            # Process merged leads
            valid_leads = []
            for key, entry in merged.items():
                lead = entry['data']
                lead['multi_query_hits'] = entry['hit_count']
                website = lead.get('website', '') or ''
                agency_name = lead.get('agency_name', '') or ''

                # Check for placeholder text in website
                website_lower = website.lower()
                is_placeholder = any(phrase in website_lower for phrase in [
                    'not available', 'information not', 'n/a', 'none', 'unknown',
                    'not listed',
                ])

                if is_placeholder or not website:
                    # Try to find URL from grounded search results
                    name_lower = agency_name.lower()
                    matched_url = None
                    for title, url in all_grounded_urls.items():
                        if name_lower in title or title in name_lower:
                            matched_url = url
                            break
                    if matched_url:
                        lead['website'] = matched_url
                        logger.info(f"Used grounded URL for {agency_name}: {matched_url}")
                    else:
                        # Fallback to Google Maps search link
                        lead['website'] = make_google_maps_url(agency_name, location)
                        logger.info(f"Using Google Maps link for {agency_name}")
                # Ensure website has protocol
                elif not website.startswith(('http://', 'https://')):
                    lead['website'] = 'https://' + website

                valid_leads.append(lead)

            logger.info(f"Valid leads after filtering: {len(valid_leads)}")

            # Cap at requested count, prioritizing leads found in multiple queries
            if len(valid_leads) > count:
                valid_leads.sort(key=lambda l: l.get('multi_query_hits', 1), reverse=True)
                valid_leads = valid_leads[:count]
                logger.info(f"Capped to {count} leads (prioritized multi-query hits)")

            # Step 3: Verify website content and extract social links
            verify_tasks = [
                verify_website_content(
                    lead.get('website', ''),
                    lead.get('agency_name', ''),
                    niche,
                )
                for lead in valid_leads
            ]
            verify_results = await asyncio.gather(*verify_tasks, return_exceptions=True)

            for lead, verification in zip(valid_leads, verify_results):
                if isinstance(verification, Exception):
                    verification = {'verified': False, 'reachable': False,
                                    'social_links': {'linkedin_url': None, 'facebook_url': None, 'instagram_url': None}}

                website = lead.get('website', '')
                is_maps = 'google.com/maps' in website

                if not is_maps:
                    if not verification['reachable']:
                        old_url = lead['website']
                        lead['website'] = make_google_maps_url(lead['agency_name'], location)
                        logger.info(f"Website unreachable for {lead['agency_name']} ({old_url}), using Google Maps link")
                        verification['verified'] = False

                # Store social links
                social = verification.get('social_links', {})
                lead['linkedin_url'] = social.get('linkedin_url')
                lead['facebook_url'] = social.get('facebook_url')
                lead['instagram_url'] = social.get('instagram_url')

                # Build confidence signals
                signals = {
                    'website_verified': verification.get('verified', False),
                    'email_scraped': False,  # updated after email enrichment
                    'social_links_found': any(v for v in social.values() if v),
                    'multi_query_hits': lead.get('multi_query_hits', 1),
                }
                lead['_signals'] = signals

            # Step 4: Scrape websites for missing emails (skip known ones)
            enriched_data = await enrich_leads_with_emails(valid_leads, known_emails)

            # Step 5: Calculate confidence scores
            for lead in enriched_data:
                signals = lead.pop('_signals', {})
                signals['email_scraped'] = lead.get('email_source') == 'scraped'
                confidence, signals = calculate_confidence(signals)
                lead['confidence'] = confidence
                lead['confidence_signals'] = signals

            return enriched_data

        except Exception as e:
            logger.error(f"Search attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
                continue
            raise

    return []


async def re_verify_lead(website: str, business_name: str, niche: str = '') -> dict:
    """
    Re-scrape a website for updated email and social links.

    Returns dict with enrichment results.
    """
    result = {
        'email': None,
        'linkedin_url': None,
        'facebook_url': None,
        'instagram_url': None,
        'confidence': 'low',
        'confidence_signals': {},
    }

    # Verify website content and extract social links
    verification = await verify_website_content(website, business_name, niche)

    signals = {
        'website_verified': verification.get('verified', False),
        'email_scraped': False,
        'social_links_found': False,
        'multi_query_hits': 0,
    }

    # Store social links
    social = verification.get('social_links', {})
    result['linkedin_url'] = social.get('linkedin_url')
    result['facebook_url'] = social.get('facebook_url')
    result['instagram_url'] = social.get('instagram_url')
    signals['social_links_found'] = any(v for v in social.values() if v)

    # Scrape email
    email = await scrape_website_for_email(website)
    if email:
        result['email'] = email
        signals['email_scraped'] = True

    confidence, signals = calculate_confidence(signals)
    result['confidence'] = confidence
    result['confidence_signals'] = signals

    return result
