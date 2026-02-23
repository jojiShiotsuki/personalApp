import os
import re
import json
import asyncio
import logging
from typing import Optional
from datetime import datetime

import httpx
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

VALID_ISSUE_KEYS = [
    "slow_load",
    "not_mobile_friendly",
    "no_google_presence",
    "no_clear_cta",
    "outdated_design",
]

CTA_PATTERNS = re.compile(
    r'(get\s+a\s+quote|request\s+a?\s*quote|contact\s+us|get\s+started|book\s+a?\s*call'
    r'|schedule\s+a?\s*call|free\s+consultation|free\s+estimate|let.s\s+talk'
    r'|tel:|mailto:|type=["\']submit)',
    re.IGNORECASE,
)

ANALYTICS_PATTERNS = re.compile(
    r'(google-analytics|googletagmanager|gtag|ga\.js|analytics\.js'
    r'|facebook\.net/en_US/fbevents|hotjar|clarity\.ms)',
    re.IGNORECASE,
)

TECH_STACK_PATTERNS = {
    "WordPress": re.compile(r'wp-content|wp-includes|wordpress', re.IGNORECASE),
    "Wix": re.compile(r'wix\.com|wixsite|_wix', re.IGNORECASE),
    "Squarespace": re.compile(r'squarespace', re.IGNORECASE),
    "Shopify": re.compile(r'shopify|cdn\.shopify', re.IGNORECASE),
    "Webflow": re.compile(r'webflow', re.IGNORECASE),
    "GoDaddy": re.compile(r'godaddy|secureserver', re.IGNORECASE),
}


def _normalize_url(url: str) -> str:
    """Ensure URL has a scheme."""
    if not url.startswith("http"):
        url = "https://" + url
    return url


async def fetch_pagespeed_scores(url: str, api_key: str) -> dict:
    """Layer 1: Google PageSpeed Insights API."""
    result = {
        "performance_score": None,
        "fcp_ms": None,
        "lcp_ms": None,
        "is_mobile_friendly": None,
        "error": None,
    }
    endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    params = {
        "url": url,
        "key": api_key,
        "category": "performance",
        "strategy": "mobile",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(endpoint, params=params)
            if resp.status_code != 200:
                result["error"] = f"PageSpeed API returned {resp.status_code}"
                return result
            data = resp.json()

        lighthouse = data.get("lighthouseResult", {})
        categories = lighthouse.get("categories", {})
        audits = lighthouse.get("audits", {})

        perf = categories.get("performance", {})
        result["performance_score"] = int((perf.get("score") or 0) * 100)

        fcp = audits.get("first-contentful-paint", {})
        result["fcp_ms"] = fcp.get("numericValue")

        lcp = audits.get("largest-contentful-paint", {})
        result["lcp_ms"] = lcp.get("numericValue")

        # Check viewport meta tag as mobile-friendliness proxy
        viewport_audit = audits.get("viewport", {})
        result["is_mobile_friendly"] = viewport_audit.get("score", 0) == 1

    except Exception as e:
        logger.warning(f"PageSpeed fetch failed for {url}: {e}")
        result["error"] = str(e)

    return result


async def scrape_html_heuristics(url: str) -> dict:
    """Layer 2: HTML scraping for meta tags, CTAs, tech stack."""
    result = {
        "has_meta_description": False,
        "has_og_tags": False,
        "has_viewport": False,
        "has_cta": False,
        "has_analytics": False,
        "tech_stack": [],
        "title": None,
        "html_snippet": "",
        "error": None,
    }
    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; VertexCRM/1.0)"},
        ) as client:
            resp = await client.get(url)
            html = resp.text

        result["html_snippet"] = html[:2000]

        # Meta description
        if re.search(r'<meta\s[^>]*name=["\']description["\']', html, re.IGNORECASE):
            result["has_meta_description"] = True

        # Open Graph tags
        if re.search(r'<meta\s[^>]*property=["\']og:', html, re.IGNORECASE):
            result["has_og_tags"] = True

        # Viewport
        if re.search(r'<meta\s[^>]*name=["\']viewport["\']', html, re.IGNORECASE):
            result["has_viewport"] = True

        # CTA patterns
        if CTA_PATTERNS.search(html):
            result["has_cta"] = True

        # Analytics
        if ANALYTICS_PATTERNS.search(html):
            result["has_analytics"] = True

        # Tech stack
        for name, pattern in TECH_STACK_PATTERNS.items():
            if pattern.search(html):
                result["tech_stack"].append(name)

        # Title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if title_match:
            result["title"] = title_match.group(1).strip()[:200]

    except Exception as e:
        logger.warning(f"HTML scrape failed for {url}: {e}")
        result["error"] = str(e)

    return result


async def ai_design_assessment(
    url: str,
    business_name: str,
    niche: Optional[str],
    html_snippet: str,
    pagespeed_data: dict,
    heuristics: dict,
) -> dict:
    """Layer 3: Claude Haiku AI analysis for subjective assessment."""
    result = {
        "ai_issues": [],
        "summary": "",
        "design_notes": "",
        "error": None,
    }

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        result["error"] = "ANTHROPIC_API_KEY not set"
        return result

    model = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

    prompt = f"""Analyze this website for a web design/marketing agency prospecting context.

Business: {business_name}
Niche: {niche or 'Unknown'}
URL: {url}
PageSpeed Performance Score: {pagespeed_data.get('performance_score', 'N/A')}/100
FCP: {pagespeed_data.get('fcp_ms', 'N/A')}ms | LCP: {pagespeed_data.get('lcp_ms', 'N/A')}ms
Mobile friendly: {pagespeed_data.get('is_mobile_friendly', 'N/A')}
Has meta description: {heuristics.get('has_meta_description')}
Has OG tags: {heuristics.get('has_og_tags')}
Has analytics: {heuristics.get('has_analytics')}
Has CTA: {heuristics.get('has_cta')}
Tech stack: {', '.join(heuristics.get('tech_stack', [])) or 'Unknown'}
Page title: {heuristics.get('title', 'N/A')}

HTML snippet (first 2000 chars):
{html_snippet[:2000]}

Respond with ONLY valid JSON (no markdown, no code fences):
{{
  "issues": ["issue_key", ...],
  "summary": "One sentence describing the website's main weakness for outreach.",
  "design_notes": "2-3 specific talking points an agency could use in a cold email to this business."
}}

Valid issue keys (ONLY use these): slow_load, not_mobile_friendly, no_google_presence, no_clear_cta, outdated_design
Only include issues you are confident about. Be conservative."""

    try:
        client = AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model=model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        parsed = json.loads(text)
        ai_issues = [k for k in parsed.get("issues", []) if k in VALID_ISSUE_KEYS]
        result["ai_issues"] = ai_issues

        # AI may return strings or lists — coerce to string
        summary = parsed.get("summary", "")
        if isinstance(summary, list):
            summary = " ".join(str(s) for s in summary)
        result["summary"] = str(summary)[:500]

        design_notes = parsed.get("design_notes", "")
        if isinstance(design_notes, list):
            design_notes = " ".join(str(s) for s in design_notes)
        result["design_notes"] = str(design_notes)[:1000]

    except Exception as e:
        logger.warning(f"AI assessment failed for {url}: {e}")
        result["error"] = str(e)

    return result


async def audit_single_website(
    url: str, business_name: str, niche: Optional[str] = None
) -> dict:
    """
    Orchestrator: runs all three layers and produces final audit result.
    Returns dict with: speed_score, issues, summary, design_notes, raw_data
    """
    url = _normalize_url(url)
    google_api_key = os.getenv("GEMINI_API_KEY", "")

    # Layer 1 + 2 in parallel
    pagespeed_task = fetch_pagespeed_scores(url, google_api_key)
    scrape_task = scrape_html_heuristics(url)
    pagespeed_data, heuristics = await asyncio.gather(pagespeed_task, scrape_task)

    # Deterministic issue detection from Layer 1 + 2
    issues = set()

    # Speed: score < 50 OR LCP > 4000ms
    speed_score = pagespeed_data.get("performance_score")
    lcp = pagespeed_data.get("lcp_ms")
    if (speed_score is not None and speed_score < 50) or (lcp is not None and lcp > 4000):
        issues.add("slow_load")

    # Mobile: no viewport tag
    if not heuristics.get("has_viewport"):
        issues.add("not_mobile_friendly")
    if pagespeed_data.get("is_mobile_friendly") is False:
        issues.add("not_mobile_friendly")

    # Google presence: no meta + no OG + no analytics
    if (
        not heuristics.get("has_meta_description")
        and not heuristics.get("has_og_tags")
        and not heuristics.get("has_analytics")
    ):
        issues.add("no_google_presence")

    # CTA: no CTA patterns found
    if not heuristics.get("has_cta"):
        issues.add("no_clear_cta")

    # Layer 3: AI analysis
    ai_result = await ai_design_assessment(
        url, business_name, niche,
        heuristics.get("html_snippet", ""),
        pagespeed_data, heuristics,
    )

    # AI can add issues but not remove deterministic ones
    for issue_key in ai_result.get("ai_issues", []):
        issues.add(issue_key)

    return {
        "speed_score": speed_score,
        "issues": sorted(issues),
        "summary": ai_result.get("summary", ""),
        "design_notes": ai_result.get("design_notes", ""),
        "raw_data": {
            "pagespeed": {
                "performance_score": pagespeed_data.get("performance_score"),
                "fcp_ms": pagespeed_data.get("fcp_ms"),
                "lcp_ms": pagespeed_data.get("lcp_ms"),
                "is_mobile_friendly": pagespeed_data.get("is_mobile_friendly"),
                "error": pagespeed_data.get("error"),
            },
            "heuristics": {
                "has_meta_description": heuristics.get("has_meta_description"),
                "has_og_tags": heuristics.get("has_og_tags"),
                "has_viewport": heuristics.get("has_viewport"),
                "has_cta": heuristics.get("has_cta"),
                "has_analytics": heuristics.get("has_analytics"),
                "tech_stack": heuristics.get("tech_stack"),
                "title": heuristics.get("title"),
                "error": heuristics.get("error"),
            },
            "ai": {
                "ai_issues": ai_result.get("ai_issues", []),
                "summary": ai_result.get("summary", ""),
                "design_notes": ai_result.get("design_notes", ""),
                "error": ai_result.get("error"),
            },
        },
    }
