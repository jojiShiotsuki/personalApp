"""
Playwright + Claude Vision audit service for the Autoresearch cold email system.

Visits prospect websites with headless Chromium, captures desktop + mobile
screenshots, extracts text and links, then sends everything to Claude Vision
for analysis. Returns a structured JSON with website issues and a personalised
cold email draft.
"""

import asyncio
import base64
import json
import logging
import os
import re
import time
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

MAX_SCREENSHOT_SIZE = 3_750_000  # ~3.75 MB raw → ~5 MB after base64 encoding (33% overhead)

BOT_DETECTION_INDICATORS = [
    "captcha",
    "verify you are human",
    "access denied",
    "you have been blocked",
    "your access is blocked",
    "request blocked",
    "attention required! | cloudflare",
    "just a moment",
    "checking your browser",
    "checking if the site connection is secure",
    "are you a robot",
    "enable javascript and cookies to continue",
    "please turn javascript on",
    "ray id",
]


# ──────────────────────────────────────────────
# URL validation
# ──────────────────────────────────────────────


def validate_url(url: str) -> str:
    """Validate and normalize a URL. Returns cleaned URL or raises ValueError."""
    url = url.strip()

    if not url:
        raise ValueError("URL cannot be empty")

    # Add https:// if no scheme
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)

    # Must have a valid hostname
    if not parsed.hostname:
        raise ValueError(f"Invalid URL: no hostname found in '{url}'")

    # Block internal/private IPs and file URLs
    hostname = parsed.hostname.lower()
    blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1"]
    if hostname in blocked or hostname.startswith(("192.168.", "10.", "172.")):
        raise ValueError(f"Internal URLs are not allowed: {hostname}")

    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Only http/https URLs are allowed, got: {parsed.scheme}")

    return url


# ──────────────────────────────────────────────
# Default Audit Prompt
# ──────────────────────────────────────────────

def build_variation_injection(proof: dict, cta: dict) -> str:
    """Build the mandatory proof/CTA injection block to prepend to any audit prompt.

    The proof and CTA are pre-selected by Python from the shared pools in
    app.services.email_variations. The AI must copy them verbatim into the
    generated email — its only creative work is the bridge paragraph.
    """
    return f"""MANDATORY PROOF SENTENCE (copy this VERBATIM into paragraph 1 of the email body — do not rewrite, do not rephrase, do not soften):
"{proof['text']}"

MANDATORY CTA SENTENCE (copy this VERBATIM into the final paragraph of the email body — do not rewrite):
"{cta['text']}"

The proof and CTA above are pre-selected by the system from a variation pool. You MUST copy them verbatim. Your only creative work is writing the BRIDGE paragraph (paragraph 2) based on the specific audit finding for this prospect.

CASE STUDY LOCK: The case study is ALWAYS a barbershop. Do NOT change it to match the prospect's industry (not "an air con business", not "a plumber", not "a roofer"). The barbershop is the only case study you are permitted to reference.

EMAIL STRUCTURE:
1. "G'day [first_name]," opening
2. Proof sentence (verbatim from above)
3. Bridge paragraph (your creative work — reference the specific audit finding as an opportunity, not a problem, with a concrete fix timeframe + outcome)
4. CTA sentence (verbatim from above)

---

"""


DEFAULT_AUDIT_PROMPT = """You are a cold-email copywriter for Joji Shiotsuki, an Australian WordPress developer who helps tradies (tradespeople) get found online and booked out. You write short, proof-first emails that start with a credibility result and then bridge to an OPPORTUNITY on the prospect's own site.

TARGET AUDIENCE CHECK (be lenient — ONLY skip if the business is clearly unreachable):
Return site_quality="not_target" ONLY if one of these is clearly true:
- Truly massive enterprise (5+ offices, hundreds of staff, clearly has an in-house marketing team)
- Government department or statutory body
- Franchise where the homepage is centrally managed and the individual franchisee cannot edit it
- Not a tradie business at all (e.g. a SaaS product, news site, affiliate blog)
- Clearly not in Australia

DO NOT skip:
- Single-location tradies with polished-looking sites — they can still benefit from SEO/conversion tweaks
- Medium-size tradie firms (10-100 staff) — owner is often still the decision-maker
- Tradies with modern sites — they still have opportunities to improve
- Wholesalers/distributors that also do end-customer sales
- Any tradie niche (HVAC, plumbing, electrical, roofing, landscaping, building, painting, concreting, fencing, decking, pest, cleaning, etc.)

If in doubt, DO the audit — don't skip. The cost of auditing a borderline prospect is worth it if there's any chance they're reachable.

ANALYSIS INSTRUCTIONS:
1. Study the desktop and mobile screenshots carefully.
2. Look at the extracted text and link map for supporting evidence.
3. Find the BIGGEST, most obvious, VISIBLE opportunity a non-technical tradie would benefit from.
4. If the site is genuinely good (modern, fast, functional), say so — don't invent problems.

ISSUE TYPES (pick the most accurate — used internally for categorisation, NOT as negative language in the email):
- broken_links, broken_forms, dead_pages, placeholder_text, typos, duplicate_content, frozen_reviews, no_reviews, no_real_photos, no_contact_visible, poor_mobile, popup_blocking, wall_of_text, outdated_design, cluttered_layout, slow_load, invisible_on_google, vague_heading

These are internal tags. When you write the email body, translate the finding into OPPORTUNITY language, not criticism.

EMAIL STRUCTURE (this exact flow):
1. "G'day [first_name]," opening
2. PROOF FIRST (paragraph 1, one sentence): Lead with the barbershop case study result. Concrete outcome + timeframe. Example: "I got a barbershop ranking #1 on Google and showing up in AI search within 3 months. Their phone went from quiet to booked out."
3. BRIDGE (paragraph 2): Connect the proof to THEIR site. Reference running their business through the same tools and describe the audit finding as an OPPORTUNITY using the preferred language below. Example: "Ran [company] through the same tools — spotted a few quick wins on [niche/area] searches. Nothing broken, just stuff most [trade] businesses don't know about."
4. CTA (paragraph 3): Low-effort offer. 3-minute walkthrough, free, no pitch, no call ask. Example: "Want me to send through a quick 3-minute walkthrough of what I found? No cost, no pitch."

GOLD-STANDARD EXAMPLE (model your output on this structure):

G'day Mike,

I got a barbershop ranking #1 on Google and showing up in AI search within 3 months. Their phone went from quiet to booked out.

Ran Smith Plumbing through the same tools — spotted a few quick wins on plumber-related searches in Brisbane. Nothing broken, just stuff most plumbers don't know about.

Want me to send through a quick 3-minute walkthrough of what I found? No cost, no pitch.

REFRAME AUDIT FINDINGS AS OPPORTUNITIES, NOT PROBLEMS:
Tradies get defensive when criticised. Use language like:
- "spotted a few quick wins"
- "noticed an opportunity to"
- "room to improve on"
- "a simple tweak could"
- "stuff most [trade] businesses don't know about"

Never describe their site as broken, dead, failing, wrong, missing, outdated, or use words like "typo", "slip", "mistake", "error" — even if that's what the audit found. Translate the finding into opportunity language.

LOCATION RULES (CRITICAL):
- The case study reference says "a barbershop" with NO location mentioned
- NEVER mention Cebu, Philippines, Manila, or any non-Australian location anywhere
- Joji Web Solutions is AU-based. This must be consistent across every email.

VALUE EQUATION CHECK (before finalising, verify all 4 elements are present):
1. Dream outcome — concrete positive result mentioned? (e.g., "ranking #1", "phone booked out")
2. Perceived likelihood — proof shown? (case study reference)
3. Time delay — timeframe stated? (e.g., "within 3 months")
4. Effort — low-effort CTA? (free, short, no meeting ask)
If any element is missing, rewrite until all 4 are present.

CRITICAL RULES:
- NEVER lead with alt text, meta descriptions, schema markup, image formats, or any invisible code issues
- NEVER mention SEO jargon like "meta tags", "schema", "alt attributes"
- The issue MUST be something the tradie can see by looking at their own website
- Use Australian English (favour, colour, organisation, etc.)
- The email body MUST be 65-90 words (excluding sign-off)
- The subject line MUST be under 8 words and CANNOT use negative framing ("broken", "typo", "blank", "your website is", "wrong", "missing", "outdated", "failing", "problem", "issue", "bad")
- Start the email with "G'day [first_name],"
- The email must sound human, conversational, proof-led, not salesy or robotic
- Focus on ONE main opportunity — don't list multiple findings
- NEVER use em dashes (—). Use commas, full stops, or rewrite the sentence instead.
- DO NOT ask for a meeting, call, or chat in the CTA.

BANNED PHRASES (never use any of these in body or subject):
- Negative framing: "broken", "dead end", "costing you", "walls of text", "outdated", "your site is", "wrong", "missing", "failing", "typo", "slip", "mistake"
- CTA bans: "10 minutes", "15 minutes", "worth X minutes", "got X minutes", "quick chat", "jump on a call"
- Location bans: "Cebu", "Philippines", "Manila", or any non-Australian location

VERIFICATION DATA RULES (if interactive verification data is provided above):
- If a link is marked "scroll-to-section" or "ok", do NOT flag it as broken_links
- If carousel is detected, do NOT flag repeated content as duplicate_content
- If animated elements were detected, do NOT flag them as dead_pages or placeholder_text
- If spelling errors were found with suggestions, you MAY use them as the primary issue
- Use PageSpeed scores as supporting evidence, not as the sole issue type
- PRIORITISE issues confirmed by automated checks over visual guesses from screenshots
- Lead with the most impactful CONFIRMED issue in the cold email
- If no confirmed issues exist, fall back to visual analysis of the screenshots

SIGN-OFF (use this EXACTLY):
Cheers,
Joji Shiotsuki | Joji Web Solutions | jojishiotsuki.com

Not interested? Just reply "stop" and I won't email again.

RESPONSE FORMAT — Return ONLY valid JSON, no markdown fences:
{
  "issue_type": "<one of the issue types above>",
  "issue_detail": "<1-2 sentence description of the specific problem found>",
  "secondary_issue": "<second issue type if found, or null>",
  "secondary_detail": "<1-2 sentence description, or null>",
  "confidence": "<high|medium|low>",
  "needs_verification": <true if a link/form needs clicking to confirm>,
  "verify_actions": ["<text of element to click>", ...],
  "subject": "<email subject, under 8 words>",
  "subject_variant": "<alternative subject line, different angle/framing, under 8 words>",
  "body": "<full email body, under 80 words, Australian English>",
  "word_count": <integer word count of body>,
  "site_quality": "<poor|below_average|average|above_average|good|not_target>",
  "detected_city": "<city/suburb extracted from the website, e.g. 'Sydney', 'Melbourne', 'Ormeau QLD', or null if not found>",
  "detected_trade": "<specific trade extracted from the website, e.g. 'HVAC', 'plumbing', 'electrical', 'roofing', or null>"
}

If the site is genuinely good (site_quality = "good"), return null issue/subject/body.
If the business is NOT a target (not a tradie, too big, not Australian), return site_quality="not_target" with null issue/subject/body and put the skip reason in issue_detail."""


class AuditService:
    """Captures website screenshots and analyses them with Claude Vision."""

    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        self.client = AsyncAnthropic(api_key=api_key)

    # ──────────────────────────────────────────
    # Pass 1: Screenshot capture
    # ──────────────────────────────────────────

    async def capture_screenshots(self, url: str, min_wait: int = 3) -> dict[str, Any]:
        """
        Launch headless Chromium, capture desktop (1440px) and mobile (375px)
        screenshots, extract visible text and a link map.

        Uses sync Playwright in a thread to avoid Windows ProactorEventLoop
        issues with asyncio.create_subprocess_exec inside uvicorn.

        Returns a dict with:
            desktop_screenshot  – base64-encoded PNG (or None)
            mobile_screenshot   – base64-encoded PNG (or None)
            extracted_text      – first 5 000 chars of body.innerText
            link_map            – list of {href, text, visible} dicts (max 50)
            error               – error message string (or None)
            duration_seconds    – wall-clock seconds for the whole capture
        """
        # Late import so the module can be loaded even when playwright
        # is not installed (e.g. during migrations or tests).
        try:
            from playwright.sync_api import sync_playwright  # noqa: F401
        except ImportError:
            logger.error("playwright is not installed — run: pip install playwright && playwright install chromium")
            return {
                "desktop_screenshot": None,
                "mobile_screenshot": None,
                "extracted_text": None,
                "link_map": None,
                "error": "playwright is not installed",
                "duration_seconds": 0,
            }

        return await asyncio.to_thread(self._capture_sync, url, min_wait)

    def _capture_sync(self, url: str, min_wait: int) -> dict[str, Any]:
        """Synchronous screenshot capture — runs in a worker thread."""
        from playwright.sync_api import sync_playwright

        start = time.monotonic()
        result: dict[str, Any] = {
            "desktop_screenshot": None,
            "mobile_screenshot": None,
            "extracted_text": None,
            "link_map": None,
            "error": None,
            "duration_seconds": 0,
        }

        playwright_instance = None
        browser = None

        try:
            playwright_instance = sync_playwright().start()
            browser = playwright_instance.chromium.launch(headless=True)

            # ── Desktop capture ────────────────────────
            desktop_page = browser.new_page(viewport={"width": 1440, "height": 900})
            try:
                self._navigate_with_fallback_sync(desktop_page, url)
            except Exception as nav_err:
                # Retry with ignore_https_errors for chrome-error / SSL-related failures
                nav_err_str = str(nav_err)
                if "chrome-error" in nav_err_str or "ERR_SSL" in nav_err_str or "ERR_CERT" in nav_err_str:
                    logger.info("Retrying %s with ignore_https_errors=True", url)
                    desktop_page.close()
                    ctx = browser.new_context(
                        viewport={"width": 1440, "height": 900},
                        ignore_https_errors=True,
                    )
                    desktop_page = ctx.new_page()
                    try:
                        self._navigate_with_fallback_sync(desktop_page, url)
                    except Exception as retry_err:
                        logger.warning("Desktop navigation retry failed for %s: %s", url, retry_err)
                        result["error"] = f"Navigation failed: {retry_err}"
                        return result
                else:
                    logger.warning("Desktop navigation failed for %s: %s", url, nav_err)
                    result["error"] = f"Navigation failed: {nav_err}"
                    return result

            # Wait for JS rendering
            time.sleep(min_wait)

            # Check for common bot detection / captcha pages
            try:
                page_title = desktop_page.title()
                page_text = desktop_page.evaluate(
                    "() => (document.body.innerText || '').substring(0, 500)"
                )
                combined = (page_title + " " + page_text).lower()
                if any(indicator in combined for indicator in BOT_DETECTION_INDICATORS):
                    logger.warning("Bot detection found on %s: title=%r", url, page_title)
                    result["error"] = "Site has bot protection (captcha/Cloudflare). Manual audit needed."
                    return result
            except Exception as bd_err:
                logger.debug("Bot detection check failed (non-fatal): %s", bd_err)

            # ── Interactive checks (before screenshots) ────
            from app.services.interactive_checks import run_all_checks
            result["interactive_checks"] = run_all_checks(desktop_page, url)

            # Re-navigate to clean state after link clicking
            try:
                desktop_page.goto(url, wait_until="load", timeout=10000)
                time.sleep(1)
            except Exception:
                pass  # Non-fatal — page may already be on the right URL

            # Scroll to bottom to trigger lazy-loading, then back to top
            self._scroll_full_page_sync(desktop_page)

            # Full-page screenshot (capped at 7500px height for Claude Vision 8000px limit)
            page_height = desktop_page.evaluate("() => document.body.scrollHeight")
            if page_height > 7500:
                logger.info("Page height %dpx exceeds 7500px, clipping screenshot", page_height)
                desktop_png = desktop_page.screenshot(
                    clip={"x": 0, "y": 0, "width": 1440, "height": 7500}, type="png"
                )
            else:
                desktop_png = desktop_page.screenshot(full_page=True, type="png")
            # Cap size to stay under Anthropic's 5 MB base64 limit
            desktop_fmt = "image/png"
            if len(desktop_png) > MAX_SCREENSHOT_SIZE:
                logger.info("Desktop screenshot too large (%d bytes), retaking as JPEG q=40", len(desktop_png))
                desktop_png = desktop_page.screenshot(
                    clip={"x": 0, "y": 0, "width": 1440, "height": min(page_height, 5000)},
                    type="jpeg", quality=40,
                )
                desktop_fmt = "image/jpeg"
            result["desktop_screenshot"] = base64.b64encode(desktop_png).decode("ascii")
            result["desktop_media_type"] = desktop_fmt
            del desktop_png  # free memory immediately

            # Extract visible text
            result["extracted_text"] = self._extract_text_sync(desktop_page)

            # Extract link map
            result["link_map"] = self._extract_links_sync(desktop_page)

            desktop_page.close()

            # ── Mobile capture ─────────────────────────
            mobile_page = browser.new_page(viewport={"width": 375, "height": 812})
            try:
                self._navigate_with_fallback_sync(mobile_page, url)
                time.sleep(min_wait)
                self._scroll_full_page_sync(mobile_page)
                mob_height = mobile_page.evaluate("() => document.body.scrollHeight")
                if mob_height > 7500:
                    mobile_png = mobile_page.screenshot(
                        clip={"x": 0, "y": 0, "width": 375, "height": 7500}, type="png"
                    )
                else:
                    mobile_png = mobile_page.screenshot(full_page=True, type="png")
                # Cap size to stay under Anthropic's 5 MB base64 limit
                mobile_fmt = "image/png"
                if len(mobile_png) > MAX_SCREENSHOT_SIZE:
                    logger.info("Mobile screenshot too large (%d bytes), retaking as JPEG q=40", len(mobile_png))
                    mobile_png = mobile_page.screenshot(
                        clip={"x": 0, "y": 0, "width": 375, "height": min(mob_height, 5000)},
                        type="jpeg", quality=40,
                    )
                    mobile_fmt = "image/jpeg"
                result["mobile_screenshot"] = base64.b64encode(mobile_png).decode("ascii")
                result["mobile_media_type"] = mobile_fmt
                del mobile_png  # free memory immediately
            except Exception as mob_err:
                logger.warning("Mobile capture failed for %s: %s", url, mob_err)
                # Non-fatal — we still have desktop data
            finally:
                mobile_page.close()

        except Exception as exc:
            logger.error("Screenshot capture error for %s: %s", url, exc, exc_info=True)
            result["error"] = str(exc)
        finally:
            if browser:
                browser.close()
            if playwright_instance:
                playwright_instance.stop()
            result["duration_seconds"] = round(time.monotonic() - start, 2)

        return result

    # ──────────────────────────────────────────
    # Pass 1 helpers (sync — for use in worker thread)
    # ──────────────────────────────────────────

    @staticmethod
    def _navigate_with_fallback_sync(page: Any, url: str) -> None:
        """Try networkidle first; fall back to load if it times out."""
        try:
            page.goto(url, wait_until="networkidle", timeout=30_000)
        except Exception:
            logger.info("networkidle timed out for %s — falling back to load", url)
            page.goto(url, wait_until="load", timeout=30_000)

    @staticmethod
    def _scroll_full_page_sync(page: Any) -> None:
        """Scroll to the bottom then back to top to trigger lazy loaders."""
        try:
            page.evaluate("""
                async () => {
                    const delay = ms => new Promise(r => setTimeout(r, ms));
                    const height = document.body.scrollHeight;
                    const step = window.innerHeight;
                    for (let y = 0; y < height; y += step) {
                        window.scrollTo(0, y);
                        await delay(150);
                    }
                    window.scrollTo(0, 0);
                }
            """)
        except Exception as exc:
            logger.debug("Scroll helper failed (non-fatal): %s", exc)

    @staticmethod
    def _extract_text_sync(page: Any) -> Optional[str]:
        """Return the first 5 000 chars of visible body text."""
        try:
            text = page.evaluate("() => (document.body.innerText || '').substring(0, 5000)")
            return text if text else None
        except Exception as exc:
            logger.debug("Text extraction failed: %s", exc)
            return None

    @staticmethod
    def _extract_links_sync(page: Any) -> Optional[list[dict[str, Any]]]:
        """Return up to 50 <a> tags with href, text, and visibility."""
        try:
            links = page.evaluate("""
                () => {
                    const anchors = Array.from(document.querySelectorAll('a[href]'));
                    return anchors.slice(0, 50).map(a => {
                        const rect = a.getBoundingClientRect();
                        return {
                            href: a.href,
                            text: (a.innerText || '').trim().substring(0, 100),
                            visible: rect.width > 0 && rect.height > 0
                        };
                    });
                }
            """)
            return links
        except Exception as exc:
            logger.debug("Link extraction failed: %s", exc)
            return None

    # ──────────────────────────────────────────
    # PageSpeed Insights
    # ──────────────────────────────────────────

    async def cheap_target_check(self, url: str, niche: str = "") -> dict[str, Any]:
        """Fast pre-filter: fetch the homepage HTML (no Playwright) and ask Haiku
        if this is a target tradie business worth auditing.

        Costs ~$0.0001 per check vs ~$0.02 for a full audit.
        Skips prospects that are:
        - Large corporations / enterprises
        - Government / institutional
        - Wholesalers / distributors
        - Franchises with centrally managed sites

        Returns:
            {
                "is_target": bool,
                "reason": str,  # short explanation
                "cost_usd": float,
                "title": str | None,
                "description": str | None,
            }
        """
        import re

        title = None
        description = None
        body_snippet = ""

        # Fetch homepage HTML (fast, no JS rendering)
        try:
            async with httpx.AsyncClient(
                timeout=10,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JojiWebAudit/1.0)"},
            ) as client:
                response = await client.get(url)
                if response.status_code >= 400:
                    return {
                        "is_target": True,  # can't tell, let full audit decide
                        "reason": f"HTTP {response.status_code} on prefetch",
                        "cost_usd": 0.0,
                        "title": None,
                        "description": None,
                    }
                html = response.text[:15000]  # first 15KB is plenty

                # Extract title
                title_match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
                if title_match:
                    title = title_match.group(1).strip()[:200]

                # Extract meta description
                desc_match = re.search(
                    r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
                    html, re.IGNORECASE,
                )
                if desc_match:
                    description = desc_match.group(1).strip()[:300]

                # Extract visible-ish text (strip tags crudely)
                text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
                text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
                body_snippet = text[:800]
        except Exception as e:
            return {
                "is_target": True,  # let the full audit try
                "reason": f"prefetch error: {str(e)[:80]}",
                "cost_usd": 0.0,
                "title": None,
                "description": None,
            }

        # Build the Haiku prompt (tiny)
        prompt = f"""Is this a small-to-medium Australian tradie business worth a cold email audit?

URL: {url}
Niche: {niche or 'unknown'}
Title: {title or 'unknown'}
Description: {description or 'unknown'}
Body excerpt: {body_snippet}

SKIP these (return is_target=false):
- Large corporation, enterprise, or franchise with centrally-managed website
- Government, institutional, non-profit, or membership organisation
- Wholesaler, distributor, or manufacturer (B2B supplier, not end-service)
- Clearly not a tradie (not HVAC/plumbing/electrical/roofing/landscaping/building/etc)
- Business clearly not in Australia

TARGET these (return is_target=true):
- Single-location or small-chain tradie business
- Owner-operator tradie with a simple/modest website
- Any tradie niche — even if site looks decent, they can still benefit

Return ONLY JSON, no markdown fences:
{{"is_target": true/false, "reason": "short phrase"}}"""

        try:
            response = await self.client.messages.create(
                model=os.getenv("AUDIT_PREFILTER_MODEL", "claude-haiku-4-5-20251001"),
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:
            logger.warning("Prefilter Haiku call failed for %s: %s", url, e)
            return {
                "is_target": True,  # let full audit decide
                "reason": f"haiku error: {str(e)[:80]}",
                "cost_usd": 0.0,
                "title": title,
                "description": description,
            }

        raw_text = response.content[0].text if response.content else ""
        # Strip code fences if present
        raw = raw_text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        try:
            parsed = json.loads(raw)
        except Exception:
            # Couldn't parse — assume target to be safe
            return {
                "is_target": True,
                "reason": "parse error, defaulting to target",
                "cost_usd": 0.0,
                "title": title,
                "description": description,
            }

        # Calculate cost (Haiku 4.5 pricing)
        input_tokens = getattr(response.usage, "input_tokens", 0)
        output_tokens = getattr(response.usage, "output_tokens", 0)
        cost = (input_tokens * 1.0 / 1_000_000) + (output_tokens * 5.0 / 1_000_000)

        return {
            "is_target": bool(parsed.get("is_target", True)),
            "reason": str(parsed.get("reason", ""))[:200],
            "cost_usd": round(cost, 6),
            "title": title,
            "description": description,
        }

    async def run_pagespeed_test(self, url: str) -> dict[str, Any]:
        """
        Run Google PageSpeed Insights on a URL for three categories in parallel:
        performance, seo, and accessibility. Roughly 3x faster than sequential.

        Returns a dict keyed by category, e.g.:
            {
                "performance": {"score": 34, "first_contentful_paint": "4.2s", ...},
                "seo": {"score": 62, "failed_audits": [...]},
                "accessibility": {"score": 78, "failed_audits": [...]},
            }
        """
        api_url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
        google_api_key = os.getenv("GOOGLE_API_KEY")
        categories_to_test = ["performance", "seo", "accessibility"]

        async def _fetch_category(client: httpx.AsyncClient, category: str) -> tuple[str, dict[str, Any]]:
            params: dict[str, str] = {
                "url": url,
                "category": category,
                "strategy": "mobile",
            }
            if google_api_key:
                params["key"] = google_api_key

            try:
                response = await client.get(api_url, params=params)
                response.raise_for_status()
                data = response.json()

                lighthouse = data.get("lighthouseResult", {})
                lh_categories = lighthouse.get("categories", {})
                lh_audits = lighthouse.get("audits", {})

                cat_score = lh_categories.get(category, {}).get("score")
                score_100 = round(cat_score * 100) if cat_score is not None else None

                if category == "performance":
                    fcp = lh_audits.get("first-contentful-paint", {}).get("displayValue")
                    lcp = lh_audits.get("largest-contentful-paint", {}).get("displayValue")
                    speed_index = lh_audits.get("speed-index", {}).get("displayValue")
                    tti = lh_audits.get("interactive", {}).get("displayValue")
                    cls_val = lh_audits.get("cumulative-layout-shift", {}).get("displayValue")
                    speed_index_seconds = lh_audits.get("speed-index", {}).get("numericValue")
                    load_seconds = round(speed_index_seconds / 1000, 1) if speed_index_seconds else None

                    return category, {
                        "score": score_100,
                        "first_contentful_paint": fcp,
                        "largest_contentful_paint": lcp,
                        "speed_index": speed_index,
                        "time_to_interactive": tti,
                        "cumulative_layout_shift": cls_val,
                        "load_seconds": load_seconds,
                        "is_slow": score_100 is not None and score_100 < 50,
                        "error": None,
                    }
                else:
                    # SEO and Accessibility: extract score + failed audit titles
                    failed_audits = []
                    cat_ref = lh_categories.get(category, {})
                    for audit_ref in cat_ref.get("auditRefs", []):
                        audit_id = audit_ref.get("id", "")
                        audit_detail = lh_audits.get(audit_id, {})
                        if audit_detail.get("score") == 0:
                            title = audit_detail.get("title", audit_id)
                            failed_audits.append(title)

                    return category, {
                        "score": score_100,
                        "failed_audits": failed_audits,
                        "error": None,
                    }
            except httpx.TimeoutException:
                logger.warning("PageSpeed %s test timed out for %s", category, url)
                return category, {"score": None, "error": f"PageSpeed {category} test timed out"}
            except Exception as e:
                logger.warning("PageSpeed %s test failed for %s: %s", category, url, e)
                return category, {"score": None, "error": str(e)}

        results: dict[str, Any] = {}
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                # Run all 3 categories in parallel instead of sequentially
                tasks = [_fetch_category(client, cat) for cat in categories_to_test]
                completed = await asyncio.gather(*tasks, return_exceptions=True)
                for item in completed:
                    if isinstance(item, Exception):
                        logger.warning("PageSpeed gather exception for %s: %s", url, item)
                        continue
                    category, data = item
                    results[category] = data
        except Exception as e:
            logger.warning("PageSpeed test failed entirely for %s: %s", url, e)

        # Ensure all categories have an entry
        for cat in categories_to_test:
            if cat not in results:
                results[cat] = {"score": None, "error": "PageSpeed test did not complete"}

        return results

    # ──────────────────────────────────────────
    # Claude Vision analysis
    # ──────────────────────────────────────────

    async def analyze_with_claude(
        self,
        screenshots: dict[str, Any],
        prospect_name: str,
        prospect_company: str,
        prospect_niche: str,
        prospect_city: str,
        audit_prompt: str,
        learning_context: Optional[str] = None,
        pagespeed: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Send desktop + mobile screenshots and extracted data to Claude
        Vision for analysis. Returns structured audit data with _meta
        block containing token/cost info.
        """
        start = time.monotonic()

        # Build multi-modal message content
        content: list[dict[str, Any]] = []

        # Desktop screenshot
        if screenshots.get("desktop_screenshot"):
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": screenshots.get("desktop_media_type", "image/png"),
                    "data": screenshots["desktop_screenshot"],
                },
            })
            content.append({
                "type": "text",
                "text": "Above: Desktop screenshot (1440px wide)",
            })

        # Mobile screenshot
        if screenshots.get("mobile_screenshot"):
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": screenshots.get("mobile_media_type", "image/png"),
                    "data": screenshots["mobile_screenshot"],
                },
            })
            content.append({
                "type": "text",
                "text": "Above: Mobile screenshot (375px wide)",
            })

        # Extracted text + link map + prospect context
        link_map_str = ""
        if screenshots.get("link_map"):
            try:
                link_map_str = json.dumps(screenshots["link_map"], indent=2)[:3000]
            except (TypeError, ValueError):
                link_map_str = str(screenshots["link_map"])[:3000]

        extracted_text = (screenshots.get("extracted_text") or "")[:5000]

        # PageSpeed data — now keyed by category (performance, seo, accessibility)
        speed_block = ""
        if pagespeed:
            perf = pagespeed.get("performance", {})
            seo = pagespeed.get("seo", {})
            a11y = pagespeed.get("accessibility", {})

            if perf and not perf.get("error"):
                score = perf.get("score")
                load_secs = perf.get("load_seconds")
                speed_block += (
                    f"GOOGLE PAGESPEED RESULTS (mobile):\n"
                    f"  Performance Score: {score}/100 {'— POOR, site is slow' if score and score < 50 else '— OK' if score else '— unknown'}\n"
                    f"  Speed Index: {perf.get('speed_index', 'N/A')}\n"
                    f"  First Contentful Paint: {perf.get('first_contentful_paint', 'N/A')}\n"
                    f"  Largest Contentful Paint: {perf.get('largest_contentful_paint', 'N/A')}\n"
                    f"  Time to Interactive: {perf.get('time_to_interactive', 'N/A')}\n"
                    f"  Estimated Load Time: {load_secs}s {('— customers leave after 3 seconds' if load_secs and load_secs > 5 else '') if load_secs else ''}\n"
                    f"  NOTE: Only lead with speed if the score is under 50 AND you cannot find a stronger visible problem.\n"
                )
            elif perf and perf.get("error"):
                speed_block += f"GOOGLE PAGESPEED PERFORMANCE: Test failed ({perf['error']}). Skip speed as an issue.\n"

            if seo and not seo.get("error"):
                seo_score = seo.get("score")
                failed = seo.get("failed_audits", [])
                speed_block += f"  SEO Score: {seo_score}/100\n"
                if failed:
                    speed_block += f"  SEO Failed Audits: {'; '.join(failed)}\n"

            if a11y and not a11y.get("error"):
                a11y_score = a11y.get("score")
                failed = a11y.get("failed_audits", [])
                speed_block += f"  Accessibility Score: {a11y_score}/100\n"
                if failed:
                    speed_block += f"  Accessibility Failed Audits: {'; '.join(failed)}\n"

            if speed_block:
                speed_block += "\n"

        # Build and inject verification report from interactive checks
        verification_report = ""
        if screenshots.get("interactive_checks"):
            from app.services.interactive_checks import build_verification_report
            verification_report = build_verification_report(
                screenshots["interactive_checks"],
                pagespeed,
            )

        context_block = (
            f"PROSPECT INFO:\n"
            f"  Name: {prospect_name}\n"
            f"  Company: {prospect_company}\n"
            f"  Niche: {prospect_niche}\n"
            f"  City: {prospect_city}\n\n"
            f"{speed_block}"
            f"EXTRACTED TEXT (first 5000 chars):\n{extracted_text}\n\n"
            f"LINK MAP (JSON, max 3000 chars):\n{link_map_str}"
        )

        if verification_report:
            context_block = verification_report + "\n\n" + context_block

        if learning_context:
            context_block += f"\n\nLEARNED INSIGHTS (use these to improve the email):\n{learning_context}"

        content.append({"type": "text", "text": context_block})

        # Bail out if we have no screenshots at all
        if not screenshots.get("desktop_screenshot") and not screenshots.get("mobile_screenshot"):
            return {
                "error": "No screenshots available for analysis",
                "_meta": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cost_usd": 0.0,
                    "duration_seconds": round(time.monotonic() - start, 2),
                },
            }

        # Call Claude Vision
        model = os.getenv("AUTORESEARCH_AUDIT_MODEL", "claude-sonnet-4-6")

        try:
            response = await self.client.messages.create(
                model=model,
                max_tokens=1500,  # bumped from 1000 — large prompts were truncating JSON responses
                system=audit_prompt,
                messages=[{"role": "user", "content": content}],
            )
        except Exception as api_err:
            logger.error("Claude API call failed: %s", api_err, exc_info=True)
            return {
                "error": f"Claude API error: {api_err}",
                "_meta": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cost_usd": 0.0,
                    "duration_seconds": round(time.monotonic() - start, 2),
                    "model": model,
                },
            }

        # Extract text from response
        raw_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_text += block.text

        # Parse JSON from response (handle ```json fences)
        audit_data = self._parse_json_response(raw_text)

        # Token usage and cost calculation (per-model pricing)
        MODEL_PRICING = {
            "claude-sonnet-4-6": (3.0, 15.0),
            "claude-sonnet-4-20250514": (3.0, 15.0),
            "claude-haiku-4-5": (0.25, 1.25),
            "claude-opus-4-6": (15.0, 75.0),
        }
        input_tokens = getattr(response.usage, "input_tokens", 0)
        output_tokens = getattr(response.usage, "output_tokens", 0)
        input_price, output_price = MODEL_PRICING.get(model, (3.0, 15.0))
        cost_usd = (input_tokens * input_price / 1_000_000) + (output_tokens * output_price / 1_000_000)

        audit_data["_meta"] = {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": round(cost_usd, 6),
            "duration_seconds": round(time.monotonic() - start, 2),
            "model": model,
        }

        return audit_data

    @staticmethod
    def _parse_json_response(raw_text: str) -> dict[str, Any]:
        """
        Parse a JSON response from Claude, handling optional ```json fences,
        leading/trailing prose, and common formatting quirks.
        """
        text = raw_text.strip()

        if not text:
            return {
                "error": "JSON parse error: empty response",
                "raw_response": "",
            }

        # Strip markdown code fences
        fence_pattern = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)
        match = fence_pattern.search(text)
        if match:
            text = match.group(1).strip()

        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Fallback 1: extract the first {...} block (handles prose before JSON)
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        # Fallback 2: handle trailing commas (Claude occasionally generates them)
        cleaned = re.sub(r",(\s*[}\]])", r"\1", text)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Fallback 3: if the response starts with a truncated object, try to close it
        if text.startswith("{") and not text.rstrip().endswith("}"):
            try:
                return json.loads(text + '"}')
            except json.JSONDecodeError:
                pass

        logger.warning("Failed to parse Claude JSON response after all fallbacks")
        logger.debug("Raw response text: %s", raw_text[:500])
        return {
            "error": "JSON parse error: response not parseable as JSON after fallbacks",
            "raw_response": raw_text[:1000],
        }

    async def regenerate_email(
        self,
        instruction: str,
        issue_type: str | None,
        issue_detail: str | None,
        secondary_issue: str | None,
        secondary_detail: str | None,
        site_quality: str | None,
        detected_city: str | None,
        detected_trade: str | None,
        prospect_name: str,
        prospect_company: str,
        prospect_niche: str,
        selected_proof: dict,
        selected_cta: dict,
    ) -> dict[str, Any]:
        """
        Regenerate just the cold email using existing audit data + a user instruction.
        No screenshots — text-only Claude call.

        Caller must select proof/CTA variations via
        app.services.email_variations.select_proof_variation / select_cta_variation.
        """
        _start = time.monotonic()

        injection = build_variation_injection(selected_proof, selected_cta)
        system_prompt = injection + """You are a cold-email copywriter for Joji Shiotsuki, an Australian WordPress developer who helps tradies (tradespeople) get found online and booked out. You write short, proof-first emails that start with a credibility result and then bridge to an OPPORTUNITY on the prospect's own site.

REFRAME AUDIT FINDINGS AS OPPORTUNITIES, NOT PROBLEMS:
Use language like "spotted a few quick wins", "noticed an opportunity to", "room to improve on", "a simple tweak could", "stuff most [trade] businesses don't know about".

Never describe their site as broken, dead, failing, wrong, missing, outdated, or use words like "typo", "slip", "mistake", "error".

LOCATION RULES: NEVER mention Cebu, Philippines, Manila, or any non-Australian location.

VALUE EQUATION CHECK: Before finalising, verify all 4 elements are present:
1. Dream outcome (ranking #1, phone booked out)
2. Proof (barbershop case study — already in the MANDATORY proof sentence above)
3. Timeframe (within 3 months — already in the MANDATORY proof sentence above)
4. Low-effort CTA (already in the MANDATORY CTA sentence above)

CRITICAL RULES:
- Copy the MANDATORY proof sentence verbatim into paragraph 1
- Copy the MANDATORY CTA sentence verbatim into the final paragraph
- NEVER lead with alt text, meta descriptions, schema markup, image formats, or any invisible code issues
- NEVER mention SEO jargon like "meta tags", "schema", "alt attributes"
- Use Australian English (favour, colour, organisation, etc.)
- The email body MUST be 65-90 words (excluding sign-off)
- The subject line MUST be under 8 words and CANNOT use negative framing
- Start the email with "G'day [first_name],"
- The email must sound human, proof-led, not salesy or robotic
- NEVER use em dashes (—). Use commas, full stops, or rewrite the sentence instead.
- DO NOT ask for a meeting, call, or chat in the CTA.

BANNED PHRASES (never use any of these in body or subject):
- Negative framing: "broken", "dead end", "costing you", "walls of text", "outdated", "your site is", "wrong", "missing", "failing", "typo", "slip", "mistake"
- CTA bans: "10 minutes", "15 minutes", "quick chat", "jump on a call"
- Location bans: "Cebu", "Philippines", "Manila", or any non-Australian location

SIGN-OFF (use this EXACTLY):
Cheers,
Joji Shiotsuki | Joji Web Solutions | jojishiotsuki.com

Not interested? Just reply "stop" and I won't email again.

RESPONSE FORMAT — Return ONLY valid JSON, no markdown fences:
{
  "subject": "<email subject, under 8 words>",
  "subject_variant": "<alternative subject line, different angle/framing, under 8 words>",
  "body": "<full email body, 65-90 words, includes proof sentence + bridge + CTA + sign-off>",
  "word_count": <integer word count of body>
}"""

        context_parts = []
        if issue_type:
            context_parts.append(f"Primary issue: {issue_type} — {issue_detail or 'no detail'}")
        if secondary_issue:
            context_parts.append(f"Secondary issue: {secondary_issue} — {secondary_detail or 'no detail'}")
        if site_quality:
            context_parts.append(f"Site quality: {site_quality}")
        if detected_city:
            context_parts.append(f"Detected city: {detected_city}")
        if detected_trade:
            context_parts.append(f"Detected trade: {detected_trade}")

        context_parts.append(f"Prospect name: {prospect_name}")
        context_parts.append(f"Company: {prospect_company}")
        context_parts.append(f"Niche: {prospect_niche}")

        user_message = f"""EXISTING AUDIT CONTEXT:
{chr(10).join(context_parts)}

<user_instruction>
{instruction}
</user_instruction>

Rewrite the cold email for this prospect. Use the audit findings as context but PRIORITISE the user instruction above for angle and focus. Return ONLY valid JSON."""

        model = os.getenv("AUDIT_MODEL", "claude-sonnet-4-6")

        try:
            response = await self.client.messages.create(
                model=model,
                max_tokens=500,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
        except Exception as api_err:
            logger.error("Claude API call failed during regeneration: %s", api_err, exc_info=True)
            return {"error": "Email regeneration failed — please try again"}

        raw_text = response.content[0].text if response.content else ""
        result = self._parse_json_response(raw_text)

        duration = time.monotonic() - _start
        input_tokens = getattr(response.usage, "input_tokens", 0)
        output_tokens = getattr(response.usage, "output_tokens", 0)

        result["_meta"] = {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "duration_seconds": round(duration, 2),
        }

        return result

    # ──────────────────────────────────────────
    # Pass 2: Verification
    # ──────────────────────────────────────────

    async def verify_findings(self, url: str, verify_actions: list[str]) -> dict[str, Any]:
        """
        Pass 2 verification — click flagged elements and screenshot the
        destinations to confirm broken links, dead pages, etc.

        Uses sync Playwright in a thread to avoid Windows ProactorEventLoop
        issues with asyncio.create_subprocess_exec inside uvicorn.

        Returns:
            verifications – list of {action, destination_url, screenshot, error}
            error         – top-level error string (or None)
        """
        try:
            from playwright.sync_api import sync_playwright  # noqa: F401
        except ImportError:
            return {
                "verifications": [],
                "error": "playwright is not installed",
            }

        return await asyncio.to_thread(self._verify_sync, url, verify_actions)

    def _verify_sync(self, url: str, verify_actions: list[str]) -> dict[str, Any]:
        """Synchronous verification — runs in a worker thread."""
        from playwright.sync_api import sync_playwright

        verifications: list[dict[str, Any]] = []
        capped_actions = verify_actions[:5]  # max 5 actions per spec

        playwright_instance = None
        browser = None

        try:
            playwright_instance = sync_playwright().start()
            browser = playwright_instance.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 900})

            try:
                self._navigate_with_fallback_sync(page, url)
            except Exception as nav_err:
                return {
                    "verifications": [],
                    "error": f"Navigation failed: {nav_err}",
                }

            for action_text in capped_actions:
                verification: dict[str, Any] = {
                    "action": action_text,
                    "destination_url": None,
                    "screenshot": None,
                    "error": None,
                }

                try:
                    # Find element by text content
                    element = page.get_by_text(action_text, exact=False).first
                    element.click(timeout=5000)
                    time.sleep(2)

                    # Capture destination
                    verification["destination_url"] = page.url
                    dest_png = page.screenshot(full_page=True, type="png")
                    verification["screenshot"] = base64.b64encode(dest_png).decode("ascii")

                    # Navigate back for the next action
                    page.go_back(timeout=10_000)
                    time.sleep(1)

                except Exception as click_err:
                    logger.warning(
                        "Verification action '%s' failed on %s: %s",
                        action_text, url, click_err,
                    )
                    verification["error"] = str(click_err)

                verifications.append(verification)

        except Exception as exc:
            logger.error("Verification error for %s: %s", url, exc, exc_info=True)
            return {
                "verifications": verifications,
                "error": str(exc),
            }
        finally:
            if browser:
                browser.close()
            if playwright_instance:
                playwright_instance.stop()

        return {
            "verifications": verifications,
            "error": None,
        }
