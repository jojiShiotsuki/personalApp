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

MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024  # 5 MB in bytes

BOT_DETECTION_INDICATORS = [
    "captcha",
    "verify you are human",
    "access denied",
    "blocked",
    "cloudflare",
    "just a moment",
    "checking your browser",
    "are you a robot",
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

DEFAULT_AUDIT_PROMPT = """You are a cold-email copywriter for Joji Shiotsuki, an Australian WordPress developer who helps tradies (tradespeople) fix their websites. You write short, punchy, human-sounding emails that lead with a VISIBLE problem the tradie can see on their own site right now.

ANALYSIS INSTRUCTIONS:
1. Study the desktop and mobile screenshots carefully.
2. Look at the extracted text and link map for supporting evidence.
3. Find the BIGGEST, most obvious, VISIBLE problem a non-technical tradie would notice.
4. If the site is genuinely good (modern, fast, functional), say so — don't invent problems.

ISSUE TYPES (pick the most accurate):
- broken_links — links that lead to 404 pages or dead ends
- broken_forms — contact forms that don't work or look broken
- dead_pages — pages with no content, "coming soon", or placeholder text
- placeholder_text — lorem ipsum, default template text, sample content
- typos — obvious spelling/grammar errors in important areas
- duplicate_content — same content repeated across pages
- frozen_reviews — Google reviews that haven't been updated in 12+ months
- no_reviews — no Google reviews or testimonials visible
- no_real_photos — only stock photos, no real photos of their work or team
- no_contact_visible — phone number or contact info hard to find
- poor_mobile — site looks broken, cramped, or unusable on mobile
- popup_blocking — popups or overlays blocking content
- wall_of_text — huge blocks of text with no headings, images, or breaks
- outdated_design — site looks like it was built 10+ years ago
- cluttered_layout — too many elements competing for attention
- slow_load — visible signs of slow loading (broken images, unstyled content)
- invisible_on_google — no meta descriptions, missing headings structure
- vague_heading — hero heading doesn't say what the business does or where

CRITICAL RULES:
- NEVER lead with alt text, meta descriptions, schema markup, image formats, or any invisible code issues
- NEVER mention SEO jargon like "meta tags", "schema", "alt attributes"
- The issue MUST be something the tradie can see by looking at their own website
- Use Australian English (favour, colour, organisation, etc.)
- The email body MUST be under 80 words
- The subject line MUST be under 8 words
- Start the email with "G'day [first_name],"
- The email must sound human and conversational, not salesy or robotic
- Focus on ONE main issue — don't list multiple problems in the email

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
  "body": "<full email body, under 80 words, Australian English>",
  "word_count": <integer word count of body>,
  "site_quality": "<poor|below_average|average|above_average|good>"
}

If the site is genuinely good (site_quality = "good"), return:
{
  "issue_type": null,
  "issue_detail": null,
  "secondary_issue": null,
  "secondary_detail": null,
  "confidence": "high",
  "needs_verification": false,
  "verify_actions": [],
  "subject": null,
  "body": null,
  "word_count": 0,
  "site_quality": "good"
}"""


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
            # Cap at 5 MB to avoid massive API calls
            if len(desktop_png) > MAX_SCREENSHOT_SIZE:
                logger.info("Desktop screenshot too large (%d bytes), retaking as JPEG", len(desktop_png))
                if page_height > 7500:
                    desktop_png = desktop_page.screenshot(
                        clip={"x": 0, "y": 0, "width": 1440, "height": 7500}, type="jpeg", quality=50
                    )
                else:
                    desktop_png = desktop_page.screenshot(full_page=True, type="jpeg", quality=50)
            result["desktop_screenshot"] = base64.b64encode(desktop_png).decode("ascii")

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
                # Cap at 5 MB to avoid massive API calls
                if len(mobile_png) > MAX_SCREENSHOT_SIZE:
                    logger.info("Mobile screenshot too large (%d bytes), retaking as JPEG", len(mobile_png))
                    if mob_height > 7500:
                        mobile_png = mobile_page.screenshot(
                            clip={"x": 0, "y": 0, "width": 375, "height": 7500}, type="jpeg", quality=50
                        )
                    else:
                        mobile_png = mobile_page.screenshot(full_page=True, type="jpeg", quality=50)
                result["mobile_screenshot"] = base64.b64encode(mobile_png).decode("ascii")
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

    async def run_pagespeed_test(self, url: str) -> dict[str, Any]:
        """
        Run Google PageSpeed Insights on a URL.
        Free API, no auth needed. Returns performance score and key metrics.
        """
        api_url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
        params = {
            "url": url,
            "category": "performance",
            "strategy": "mobile",  # Mobile is what matters for tradies' customers
        }
        # Use API key if available for higher quota (25,000 queries/day vs 60/min)
        google_api_key = os.getenv("GOOGLE_API_KEY")
        if google_api_key:
            params["key"] = google_api_key

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(api_url, params=params)
                response.raise_for_status()
                data = response.json()

            lighthouse = data.get("lighthouseResult", {})
            categories = lighthouse.get("categories", {})
            audits = lighthouse.get("audits", {})

            perf_score = categories.get("performance", {}).get("score")
            perf_score_100 = round(perf_score * 100) if perf_score is not None else None

            # Extract key metrics
            fcp = audits.get("first-contentful-paint", {}).get("displayValue")
            lcp = audits.get("largest-contentful-paint", {}).get("displayValue")
            speed_index = audits.get("speed-index", {}).get("displayValue")
            tti = audits.get("interactive", {}).get("displayValue")
            cls = audits.get("cumulative-layout-shift", {}).get("displayValue")

            # Get the actual load time in seconds from speed-index numeric value
            speed_index_seconds = audits.get("speed-index", {}).get("numericValue")
            load_seconds = round(speed_index_seconds / 1000, 1) if speed_index_seconds else None

            return {
                "score": perf_score_100,  # 0-100
                "first_contentful_paint": fcp,
                "largest_contentful_paint": lcp,
                "speed_index": speed_index,
                "time_to_interactive": tti,
                "cumulative_layout_shift": cls,
                "load_seconds": load_seconds,
                "is_slow": perf_score_100 is not None and perf_score_100 < 50,
                "error": None,
            }

        except httpx.TimeoutException:
            logger.warning("PageSpeed test timed out for %s", url)
            return {"score": None, "error": "PageSpeed test timed out", "is_slow": False}
        except Exception as e:
            logger.warning("PageSpeed test failed for %s: %s", url, e)
            return {"score": None, "error": str(e), "is_slow": False}

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
                    "media_type": "image/png",
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
                    "media_type": "image/png",
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

        # PageSpeed data
        speed_block = ""
        if pagespeed and not pagespeed.get("error"):
            score = pagespeed.get("score")
            load_secs = pagespeed.get("load_seconds")
            speed_block = (
                f"GOOGLE PAGESPEED RESULTS (mobile):\n"
                f"  Performance Score: {score}/100 {'— POOR, site is slow' if score and score < 50 else '— OK' if score else '— unknown'}\n"
                f"  Speed Index: {pagespeed.get('speed_index', 'N/A')}\n"
                f"  First Contentful Paint: {pagespeed.get('first_contentful_paint', 'N/A')}\n"
                f"  Largest Contentful Paint: {pagespeed.get('largest_contentful_paint', 'N/A')}\n"
                f"  Time to Interactive: {pagespeed.get('time_to_interactive', 'N/A')}\n"
                f"  Estimated Load Time: {load_secs}s {('— customers leave after 3 seconds' if load_secs and load_secs > 5 else '') if load_secs else ''}\n"
                f"  NOTE: Only lead with speed if the score is under 50 AND you cannot find a stronger visible problem.\n\n"
            )
        elif pagespeed and pagespeed.get("error"):
            speed_block = f"GOOGLE PAGESPEED: Test failed ({pagespeed['error']}). Skip speed as an issue.\n\n"

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
                max_tokens=1000,
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
        Parse a JSON response from Claude, handling optional ```json fences
        and common formatting quirks.
        """
        text = raw_text.strip()

        # Strip markdown code fences
        fence_pattern = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)
        match = fence_pattern.search(text)
        if match:
            text = match.group(1).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse Claude JSON response: %s", exc)
            logger.debug("Raw response text: %s", raw_text[:500])
            return {
                "error": f"JSON parse error: {exc}",
                "raw_response": raw_text[:1000],
            }

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
