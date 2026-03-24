"""
Interactive Playwright checks for the Autoresearch website audit system.

Runs SYNCHRONOUS Playwright checks on a live page to verify issues that
Claude Vision may misidentify from screenshots alone:
  - Navigation links (anchor vs broken)
  - Carousels (slide content vs duplicate content)
  - Animated counters (JS animation vs dead page)
  - Broken images, contact info, forms, metadata, spelling, placeholder text

All functions accept a Playwright sync Page object and return plain dicts.
They run inside a worker thread (via asyncio.to_thread) so they must NOT
use async/await.
"""

import logging
import re
import time
from typing import Any, Callable
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Utility: safe_check wrapper
# ──────────────────────────────────────────────────────────────────────


def safe_check(check_fn: Callable, *args: Any, **kwargs: Any) -> dict:
    """
    Wrap *check_fn* in a try/except so a single failing check never
    crashes the whole audit.  Returns the check's dict on success or
    ``{"error": "<message>"}`` on failure.
    """
    try:
        return check_fn(*args, **kwargs)
    except Exception as exc:
        logger.warning("Check %s failed: %s", check_fn.__name__, exc, exc_info=True)
        return {"error": str(exc)}


# ──────────────────────────────────────────────────────────────────────
# 1. Cookie banner dismissal
# ──────────────────────────────────────────────────────────────────────


def dismiss_cookie_banner(page) -> dict:
    """
    Attempt to dismiss a cookie/consent banner by clicking common
    accept/dismiss buttons.  Returns ``{"dismissed": True}`` if a button
    was found and clicked, otherwise ``{"dismissed": False}``.
    """
    accept_labels = [
        "Accept All",
        "Accept all",
        "Accept",
        "Got it",
        "OK",
        "I agree",
        "I Agree",
        "Close",
        "Agree",
        "Allow All",
        "Allow all",
        "Accept Cookies",
        "Accept cookies",
    ]

    for label in accept_labels:
        for selector in [f"button:has-text('{label}')", f"a:has-text('{label}')"]:
            try:
                locator = page.locator(selector).first
                if locator.is_visible(timeout=300):
                    locator.click(timeout=1000)
                    time.sleep(0.5)
                    logger.info("Dismissed cookie banner via '%s'", label)
                    return {"dismissed": True}
            except Exception:
                continue

    return {"dismissed": False}


# ──────────────────────────────────────────────────────────────────────
# 2. Navigation link checker  (THE MOST IMPORTANT CHECK)
# ──────────────────────────────────────────────────────────────────────

_SKIP_HREF_PATTERNS = re.compile(
    r"^(javascript:|mailto:|tel:|#$|$)", re.IGNORECASE
)

_404_INDICATORS = [
    "404",
    "page not found",
    "not found",
    "doesn't exist",
    "does not exist",
    "no longer available",
    "page missing",
]


def check_nav_links(page) -> dict:
    """
    Find navigation links in ``<header>``, ``<nav>``, and ``<footer>``
    and verify each one.  Classifies every link as one of:

    - **scroll-to-section** — same-page anchor / scroll behaviour
    - **new-tab** — opens in a new tab (``target="_blank"``)
    - **ok** — navigates to a valid page
    - **404** — navigates to a page with 404 indicators
    - **error** — could not be checked

    Returns::

        {
            "total_found": int,
            "checked": int,
            "links": [
                {"href": str, "text": str, "result": str, "detail": str},
                ...
            ]
        }
    """
    deadline = time.monotonic() + 15  # 15-second hard cap for all links
    original_url = page.url
    parsed_original = urlparse(original_url)
    results: list[dict] = []

    # Gather links from navigation regions
    link_data: list[dict] = page.evaluate("""() => {
        const regions = document.querySelectorAll('header, nav, footer');
        const seen = new Set();
        const links = [];
        for (const region of regions) {
            for (const a of region.querySelectorAll('a[href]')) {
                const href = a.getAttribute('href') || '';
                const text = (a.innerText || '').trim().substring(0, 80);
                const key = href + '|' + text;
                if (!seen.has(key) && text.length > 0) {
                    seen.add(key);
                    links.push({
                        href: href,
                        text: text,
                        target: a.getAttribute('target') || '',
                    });
                }
            }
        }
        return links.slice(0, 10);
    }""")

    total_found = len(link_data)
    checked = 0

    for link in link_data:
        if time.monotonic() >= deadline:
            logger.info("Nav link check hit 15s deadline after %d links", checked)
            break

        href = link.get("href", "")
        text = link.get("text", "")
        target = link.get("target", "")

        # Skip non-navigable hrefs
        if _SKIP_HREF_PATTERNS.match(href):
            continue

        checked += 1

        # ── Same-page anchor (href contains #) ──────────────────────
        if "#" in href:
            parsed_href = urlparse(href)
            href_path = parsed_href.path or "/"
            orig_path = parsed_original.path or "/"
            # Anchor on same page or bare fragment
            if href.startswith("#") or href_path.rstrip("/") == orig_path.rstrip("/"):
                results.append({
                    "href": href,
                    "text": text,
                    "result": "scroll-to-section",
                    "detail": f"Anchor link to {parsed_href.fragment or 'top'}",
                })
                continue

        # ── Opens in new tab ─────────────────────────────────────────
        if target == "_blank":
            results.append({
                "href": href,
                "text": text,
                "result": "new-tab",
                "detail": "Link opens in a new tab",
            })
            continue

        # ── Click and observe ────────────────────────────────────────
        try:
            # Record scroll position before click
            scroll_before = page.evaluate("() => window.scrollY")

            # Find the clickable element
            link_selector = f"a:has-text('{text}')"
            locator = page.locator(link_selector).first
            if not locator.is_visible(timeout=500):
                results.append({
                    "href": href,
                    "text": text,
                    "result": "error",
                    "detail": "Link not visible on page",
                })
                continue

            locator.click(timeout=2000)

            # Poll URL changes for up to 2 seconds
            url_changed = False
            new_url = page.url
            poll_deadline = time.monotonic() + 2
            while time.monotonic() < poll_deadline:
                time.sleep(0.2)
                new_url = page.url
                if new_url != original_url:
                    url_changed = True
                    break

            if url_changed:
                parsed_new = urlparse(new_url)
                # Same page with fragment → scroll-to-section
                if (
                    parsed_new.netloc == parsed_original.netloc
                    and parsed_new.path.rstrip("/") == parsed_original.path.rstrip("/")
                    and parsed_new.fragment
                ):
                    results.append({
                        "href": href,
                        "text": text,
                        "result": "scroll-to-section",
                        "detail": f"URL changed to #{parsed_new.fragment}",
                    })
                else:
                    # Different page — check for 404
                    is_404 = False
                    try:
                        page.wait_for_load_state("domcontentloaded", timeout=3000)
                        title = page.title().lower()
                        body_snippet = page.evaluate(
                            "() => (document.body.innerText || '').substring(0, 500).toLowerCase()"
                        )
                        combined = title + " " + body_snippet
                        is_404 = any(ind in combined for ind in _404_INDICATORS)
                    except Exception:
                        pass

                    results.append({
                        "href": href,
                        "text": text,
                        "result": "404" if is_404 else "ok",
                        "detail": f"Navigated to {new_url}" + (" (404 detected)" if is_404 else ""),
                    })
            else:
                # URL did not change — check if the page scrolled
                scroll_after = page.evaluate("() => window.scrollY")
                if abs(scroll_after - scroll_before) > 50:
                    results.append({
                        "href": href,
                        "text": text,
                        "result": "scroll-to-section",
                        "detail": f"Page scrolled from {scroll_before}px to {scroll_after}px",
                    })
                else:
                    results.append({
                        "href": href,
                        "text": text,
                        "result": "ok",
                        "detail": "JS action (no URL change, no scroll)",
                    })

            # Navigate back to original URL
            if page.url != original_url:
                try:
                    page.goto(original_url, wait_until="domcontentloaded", timeout=5000)
                    time.sleep(0.3)
                except Exception:
                    logger.debug("Failed to navigate back to %s", original_url)

        except Exception as exc:
            results.append({
                "href": href,
                "text": text,
                "result": "error",
                "detail": str(exc)[:120],
            })
            # Try to recover to the original page
            if page.url != original_url:
                try:
                    page.goto(original_url, wait_until="domcontentloaded", timeout=5000)
                except Exception:
                    pass

    return {
        "total_found": total_found,
        "checked": checked,
        "links": results,
    }


# ──────────────────────────────────────────────────────────────────────
# 3. Carousel detection
# ──────────────────────────────────────────────────────────────────────

_CAROUSEL_SELECTORS = [
    ".swiper",
    ".swiper-container",
    ".slick-slider",
    ".slick-carousel",
    ".owl-carousel",
    ".carousel",
    ".flickity-slider",
    ".splide",
    ".glide",
    "[data-carousel]",
    "[data-slick]",
    "[data-swiper]",
]

_SLIDE_SELECTORS = [
    ".swiper-slide",
    ".slick-slide",
    ".owl-item",
    ".carousel-item",
    ".flickity-cell",
    ".splide__slide",
    ".glide__slide",
]


def detect_carousels(page) -> dict:
    """
    Detect carousels/sliders on the page by checking for common
    carousel library classes and DOM structures.

    Returns::

        {
            "detected": bool,
            "slide_count": int,
            "has_arrows": bool,
        }
    """
    # Check for known carousel containers
    carousel_selector = ", ".join(_CAROUSEL_SELECTORS)
    carousel_count = page.locator(carousel_selector).count()

    slide_count = 0
    if carousel_count > 0:
        slide_selector = ", ".join(_SLIDE_SELECTORS)
        slide_count = page.locator(slide_selector).count()

    # Check for navigation arrows
    has_arrows = False
    arrow_selectors = [
        ".swiper-button-next",
        ".swiper-button-prev",
        ".slick-next",
        ".slick-prev",
        ".owl-next",
        ".owl-prev",
        ".carousel-control-next",
        ".carousel-control-prev",
        "[data-slide='next']",
        "[data-slide='prev']",
        ".flickity-prev-next-button",
        ".splide__arrow",
        ".glide__arrow",
    ]
    arrow_selector = ", ".join(arrow_selectors)
    if page.locator(arrow_selector).count() > 0:
        has_arrows = True

    # Fallback: look for overflow-hidden containers with 3+ similar children
    if carousel_count == 0:
        fallback_result = page.evaluate("""() => {
            const containers = document.querySelectorAll('*');
            for (const el of containers) {
                const style = window.getComputedStyle(el);
                if (style.overflowX === 'hidden' || style.overflow === 'hidden') {
                    const children = el.children;
                    if (children.length >= 3) {
                        const firstTag = children[0].tagName;
                        const firstClass = children[0].className;
                        let similar = 0;
                        for (const child of children) {
                            if (child.tagName === firstTag && child.className === firstClass) {
                                similar++;
                            }
                        }
                        if (similar >= 3) {
                            return { detected: true, count: similar };
                        }
                    }
                }
            }
            return { detected: false, count: 0 };
        }""")
        if fallback_result.get("detected"):
            carousel_count = 1
            slide_count = fallback_result.get("count", 0)

    return {
        "detected": carousel_count > 0,
        "slide_count": slide_count,
        "has_arrows": has_arrows,
    }


# ──────────────────────────────────────────────────────────────────────
# 4. Animation detection (counters, animated numbers)
# ──────────────────────────────────────────────────────────────────────


def detect_animations(page) -> dict:
    """
    Detect animated counters / number elements by snapshotting numeric
    content before and after scrolling the page (which typically fires
    IntersectionObserver-based animations).

    Returns::

        {
            "animated_elements": ["0 -> 150+", ...],
            "total_checked": int,
        }
    """
    # Snapshot BEFORE scroll: grab text from elements that look numeric
    before_snapshot = page.evaluate(r"""() => {
        const els = document.querySelectorAll(
            '[class*="counter"], [class*="count"], [class*="number"], ' +
            '[class*="stat"], [class*="metric"], [data-count], [data-target], ' +
            '[data-value], .odometer, .timer'
        );
        const results = [];
        for (const el of els) {
            const text = (el.innerText || '').trim().substring(0, 30);
            if (/\d/.test(text) || text === '0' || text === '') {
                results.push({
                    selector: el.tagName + '.' + (el.className || '').split(' ')[0],
                    text: text,
                });
            }
        }
        return results.slice(0, 20);
    }""")

    # Scroll to trigger animations
    page.evaluate("""() => {
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' });
    }""")
    time.sleep(0.5)
    page.evaluate("""() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    }""")
    time.sleep(1.0)

    # Snapshot AFTER scroll
    after_snapshot = page.evaluate(r"""() => {
        const els = document.querySelectorAll(
            '[class*="counter"], [class*="count"], [class*="number"], ' +
            '[class*="stat"], [class*="metric"], [data-count], [data-target], ' +
            '[data-value], .odometer, .timer'
        );
        const results = [];
        for (const el of els) {
            const text = (el.innerText || '').trim().substring(0, 30);
            if (/\d/.test(text) || text === '0' || text === '') {
                results.push({
                    selector: el.tagName + '.' + (el.className || '').split(' ')[0],
                    text: text,
                });
            }
        }
        return results.slice(0, 20);
    }""")

    # Diff before/after
    animated: list[str] = []
    total_checked = max(len(before_snapshot), len(after_snapshot))

    for i, before in enumerate(before_snapshot):
        if i < len(after_snapshot):
            after = after_snapshot[i]
            if before["text"] != after["text"]:
                animated.append(f"{before['text']} -> {after['text']}")

    # Scroll back to top
    page.evaluate("() => window.scrollTo({ top: 0, behavior: 'instant' })")

    return {
        "animated_elements": animated,
        "total_checked": total_checked,
    }


# ──────────────────────────────────────────────────────────────────────
# 5. Broken image detection
# ──────────────────────────────────────────────────────────────────────


def check_images(page) -> dict:
    """
    Find images with ``naturalWidth === 0``, ``complete === false``,
    or empty ``src``.

    Returns::

        {
            "broken": [{"src": str, "alt": str}, ...],
            "total": int,
        }
    """
    result = page.evaluate("""() => {
        const imgs = document.querySelectorAll('img');
        const broken = [];
        for (const img of imgs) {
            const src = img.getAttribute('src') || '';
            const alt = (img.getAttribute('alt') || '').substring(0, 60);
            if (
                src === '' ||
                (img.complete && img.naturalWidth === 0 && src !== '')
            ) {
                broken.push({ src: src.substring(0, 200), alt: alt });
            }
        }
        return { broken: broken, total: imgs.length };
    }""")
    return result


# ──────────────────────────────────────────────────────────────────────
# 6. Contact info check
# ──────────────────────────────────────────────────────────────────────

# Australian phone patterns: +61 X XXXX XXXX, 0X XXXX XXXX, 1300/1800
_AU_PHONE_RE = re.compile(
    r"""
    (?:\+61\s?\d[\s.-]?\d{4}[\s.-]?\d{4})  |  # +61 format
    (?:0\d[\s.-]?\d{4}[\s.-]?\d{4})         |  # 0X XXXX XXXX
    (?:(?:1300|1800)[\s.-]?\d{3}[\s.-]?\d{3})  # 1300/1800
    """,
    re.VERBOSE,
)

_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
)


def check_contact_info(page) -> dict:
    """
    Find phone numbers (Australian formats) and email addresses on the
    page, and check whether they are wrapped in clickable ``tel:`` /
    ``mailto:`` links.

    Returns::

        {
            "phones": [str, ...],
            "phone_clickable": bool,
            "emails": [str, ...],
            "email_clickable": bool,
        }
    """
    body_text = page.evaluate(
        "() => (document.body.innerText || '').substring(0, 10000)"
    )

    phones = list(set(_AU_PHONE_RE.findall(body_text)))[:5]
    emails = list(set(_EMAIL_RE.findall(body_text)))[:5]

    # Filter out common false-positive emails
    emails = [
        e for e in emails
        if not e.endswith(("@example.com", "@sentry.io", "@wixpress.com"))
    ]

    # Check for tel: links
    tel_links = page.evaluate("""() => {
        const links = document.querySelectorAll('a[href^="tel:"]');
        return links.length;
    }""")

    # Check for mailto: links
    mailto_links = page.evaluate("""() => {
        const links = document.querySelectorAll('a[href^="mailto:"]');
        return links.length;
    }""")

    return {
        "phones": phones,
        "phone_clickable": tel_links > 0 if phones else True,
        "emails": emails,
        "email_clickable": mailto_links > 0 if emails else True,
    }


# ──────────────────────────────────────────────────────────────────────
# 7. Form check
# ──────────────────────────────────────────────────────────────────────


def check_forms(page) -> dict:
    """
    Find ``<form>`` elements and inspect them for submit buttons and
    input fields.

    Returns::

        {
            "forms_found": int,
            "details": [{"fields": int, "has_submit": bool}, ...],
        }
    """
    result = page.evaluate("""() => {
        const forms = document.querySelectorAll('form');
        const details = [];
        for (const form of forms) {
            const inputs = form.querySelectorAll(
                'input:not([type="hidden"]):not([type="submit"]), textarea, select'
            );
            const submitBtn = form.querySelector(
                'button[type="submit"], input[type="submit"], button:not([type])'
            );
            details.push({
                fields: inputs.length,
                has_submit: !!submitBtn,
            });
        }
        return { forms_found: forms.length, details: details };
    }""")
    return result


# ──────────────────────────────────────────────────────────────────────
# 8. Metadata check (SSL, viewport)
# ──────────────────────────────────────────────────────────────────────


def check_metadata(page) -> dict:
    """
    Check SSL (URL scheme) and viewport meta tag presence.

    Returns::

        {
            "is_https": bool,
            "has_viewport": bool,
            "final_url": str,
        }
    """
    final_url = page.url
    parsed = urlparse(final_url)

    has_viewport = page.evaluate("""() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return !!meta;
    }""")

    return {
        "is_https": parsed.scheme == "https",
        "has_viewport": has_viewport,
        "final_url": final_url,
    }


# ──────────────────────────────────────────────────────────────────────
# 9. Placeholder text detection
# ──────────────────────────────────────────────────────────────────────

_PLACEHOLDER_PATTERNS = [
    "lorem ipsum",
    "coming soon",
    "under construction",
    "example.com",
    "your text here",
    "insert text",
    "placeholder",
    "sample text",
    "default text",
    "website description",
    "this is a paragraph",
]


def check_placeholder_text(page) -> dict:
    """
    Search visible body text for common placeholder/template phrases.

    Returns::

        {
            "found": [str, ...],
        }
    """
    body_text = page.evaluate(
        "() => (document.body.innerText || '').substring(0, 15000).toLowerCase()"
    )

    found: list[str] = []
    for pattern in _PLACEHOLDER_PATTERNS:
        if pattern in body_text:
            found.append(pattern)

    return {"found": found}


# ──────────────────────────────────────────────────────────────────────
# 10. Spelling check
# ──────────────────────────────────────────────────────────────────────

# Australian English words that pyspellchecker may flag incorrectly
_AU_WHITELIST = {
    # Australian spellings
    "colour", "colours", "coloured", "colouring",
    "favour", "favours", "favoured", "favourite", "favourites",
    "honour", "honours", "honoured",
    "organisation", "organisations", "organised", "organising",
    "licence", "licences", "licenced", "licencing",
    "centre", "centres", "centred",
    "metre", "metres",
    "travelling", "travelled", "traveller",
    "jewellery",
    "specialise", "specialised", "specialises", "specialising",
    "minimise", "minimised", "minimises", "minimising",
    "customise", "customised", "customises", "customising",
    "optimise", "optimised", "optimises", "optimising",
    "utilise", "utilised", "utilises", "utilising",
    "realise", "realised", "realises", "realising",
    "recognise", "recognised", "recognises", "recognising",
    "apologise", "apologised",
    "analyse", "analysed", "analyses", "analysing",
    "catalogue", "catalogues",
    "dialogue", "dialogues",
    "programme", "programmes",
    "defence",
    "offence",
    "practise", "practised",
    "behaviour", "behaviours",
    "labour", "labours",
    "neighbour", "neighbours", "neighbourhood",
    # Australian trade/business words
    "aircon", "aircons",
    "tradie", "tradies",
    "hvac",
    "abn",
    "pty",
    "ltd",
    "reno", "renos", "renovator", "renovators",
    "sparkie", "sparkies",
    "chippy", "chippies",
    "bricky", "brickies",
    "plumber", "plumbers",
    "dunny",
    "arvo",
    "servo",
    "ute", "utes",
    "brekkie",
    # Common web / tech words
    "website", "websites",
    "homepage",
    "wordpress",
    "google",
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "tiktok",
    "pinterest",
    "shopify",
    "wix",
    "squarespace",
    "seo",
    "html",
    "css",
    "https",
    "url", "urls",
    "blog", "blogs",
    "ecommerce",
    "signup",
    "login",
    "dropdown",
    "popup", "popups",
    "navbar",
    "sidebar",
    "favicon",
    "sitemap",
    "permalink",
    "iframe",
    "plugin", "plugins",
    "analytics",
    "api",
    # Common business words
    "testimonials",
    "lorem",
    "ipsum",
    "faqs",
    "onsite",
    "offsite",
    "enquiry", "enquiries",
    "fitout", "fitouts",
    "carpark", "carparks",
    "strata",
    "townhouse", "townhouses",
    "granny",
    "weatherboard",
    "colorbond",
    "colourbond",
    "powdercoat", "powdercoated",
}

_WORD_RE = re.compile(r"[a-zA-Z]+(?:'[a-zA-Z]+)?")


def check_spelling(page) -> dict:
    """
    Extract prominent text (headings, nav links, buttons) and run a
    spell check using ``pyspellchecker`` with Australian English
    exceptions.

    Returns::

        {
            "errors": [
                {"word": str, "context": str, "suggestion": str},
                ...
            ],
        }

    Limited to the first 10 errors.
    """
    try:
        from spellchecker import SpellChecker
    except ImportError:
        logger.warning("pyspellchecker not installed — skipping spelling check")
        return {"errors": []}

    # Extract text from prominent elements
    text_entries: list[dict] = page.evaluate("""() => {
        const selectors = ['h1', 'h2', 'h3', 'nav a', 'button', '.hero', '.banner'];
        const entries = [];
        const seen = new Set();
        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                const text = (el.innerText || '').trim();
                if (text && text.length > 2 && text.length < 200 && !seen.has(text)) {
                    seen.add(text);
                    entries.push({ text: text, source: sel });
                }
            }
        }
        return entries.slice(0, 50);
    }""")

    spell = SpellChecker()

    errors: list[dict] = []

    for entry in text_entries:
        text = entry["text"]
        source = entry["source"]
        words = _WORD_RE.findall(text)

        for word in words:
            lower = word.lower()

            # Skip short words
            if len(lower) < 4:
                continue

            # Skip ALL CAPS (acronyms)
            if word.isupper():
                continue

            # Skip words with numbers
            if any(c.isdigit() for c in word):
                continue

            # Skip likely proper nouns (capitalised in non-heading context)
            if word[0].isupper() and source not in ("h1", "h2", "h3", ".hero", ".banner"):
                continue

            # Skip whitelisted Australian/trade words
            if lower in _AU_WHITELIST:
                continue

            # Check with spellchecker
            if spell.unknown([lower]):
                correction = spell.correction(lower)
                # Skip if no suggestion or suggestion is the same word
                if correction and correction != lower:
                    errors.append({
                        "word": word,
                        "context": text[:80],
                        "suggestion": correction,
                    })

                    if len(errors) >= 10:
                        return {"errors": errors}

    return {"errors": errors}


# ──────────────────────────────────────────────────────────────────────
# 11. Orchestrator — run all checks
# ──────────────────────────────────────────────────────────────────────


def run_all_checks(page, url: str) -> dict:
    """
    Run every interactive check via :func:`safe_check` and return a
    combined results dict keyed by check name.  Also logs total
    elapsed time.
    """
    start = time.monotonic()
    logger.info("Starting interactive checks on %s", url)

    results: dict[str, Any] = {}

    # Dismiss cookie banners first so they don't interfere
    results["cookie_banner"] = safe_check(dismiss_cookie_banner, page)

    # Navigation links — the most important check
    results["nav_links"] = safe_check(check_nav_links, page)

    # Carousels
    results["carousels"] = safe_check(detect_carousels, page)

    # Animations
    results["animations"] = safe_check(detect_animations, page)

    # Broken images
    results["images"] = safe_check(check_images, page)

    # Contact info
    results["contact_info"] = safe_check(check_contact_info, page)

    # Forms
    results["forms"] = safe_check(check_forms, page)

    # Metadata
    results["metadata"] = safe_check(check_metadata, page)

    # Placeholder text
    results["placeholder_text"] = safe_check(check_placeholder_text, page)

    # Spelling
    results["spelling"] = safe_check(check_spelling, page)

    elapsed = time.monotonic() - start
    logger.info("Interactive checks completed in %.1fs for %s", elapsed, url)
    results["_elapsed_seconds"] = round(elapsed, 2)

    return results


# ──────────────────────────────────────────────────────────────────────
# 12. Verification report builder
# ──────────────────────────────────────────────────────────────────────


def build_verification_report(checks: dict, pagespeed: dict | None = None) -> str:
    """
    Build a formatted plain-text report from all interactive check
    results.  This text is injected into the Claude audit prompt so it
    has verified, ground-truth data to work with.

    Parameters
    ----------
    checks : dict
        The return value of :func:`run_all_checks`.
    pagespeed : dict or None
        Optional PageSpeed Insights data to include.

    Returns
    -------
    str
        A multi-section text report.
    """
    sections: list[str] = []
    confirmed_issues: list[str] = []

    sections.append("=" * 60)
    sections.append("INTERACTIVE VERIFICATION REPORT")
    sections.append("(Ground-truth data — prioritise this over screenshot analysis)")
    sections.append("=" * 60)

    # ── Navigation Links ─────────────────────────────────────────
    nav = checks.get("nav_links", {})
    if "error" not in nav:
        sections.append("")
        sections.append("--- NAVIGATION LINKS ---")
        sections.append(
            f"Found {nav.get('total_found', 0)} links, checked {nav.get('checked', 0)}"
        )
        links = nav.get("links", [])
        broken_links = [l for l in links if l.get("result") == "404"]
        scroll_links = [l for l in links if l.get("result") == "scroll-to-section"]
        ok_links = [l for l in links if l.get("result") == "ok"]
        error_links = [l for l in links if l.get("result") == "error"]

        if scroll_links:
            sections.append(
                f"  Scroll-to-section (NOT broken): {len(scroll_links)}"
            )
            for l in scroll_links:
                sections.append(f'    - "{l["text"]}" -> {l["detail"]}')
            sections.append(
                "  DIRECTIVE: Do NOT flag these anchor/scroll links as broken."
            )

        if ok_links:
            sections.append(f"  Working links: {len(ok_links)}")
            for l in ok_links:
                sections.append(f'    - "{l["text"]}" -> {l["detail"]}')

        if broken_links:
            sections.append(f"  BROKEN LINKS (404): {len(broken_links)}")
            for l in broken_links:
                sections.append(f'    - "{l["text"]}" ({l["href"]}) -> {l["detail"]}')
            confirmed_issues.append(
                f"BROKEN LINKS: {len(broken_links)} navigation link(s) return 404"
            )

        if error_links:
            sections.append(f"  Could not check: {len(error_links)}")
            for l in error_links:
                sections.append(f'    - "{l["text"]}" -> {l["detail"]}')
    else:
        sections.append("")
        sections.append(f"--- NAVIGATION LINKS --- (check failed: {nav['error']})")

    # ── Carousels ────────────────────────────────────────────────
    carousel = checks.get("carousels", {})
    if "error" not in carousel:
        sections.append("")
        sections.append("--- CAROUSELS / SLIDERS ---")
        if carousel.get("detected"):
            sections.append(
                f"  Carousel DETECTED: {carousel.get('slide_count', '?')} slides, "
                f"arrows={'yes' if carousel.get('has_arrows') else 'no'}"
            )
            sections.append(
                "  DIRECTIVE: Do NOT flag repeated/stacked content as duplicate "
                "if it belongs to a carousel. Carousel slides appear stacked in "
                "screenshots but rotate for visitors."
            )
        else:
            sections.append("  No carousel detected.")

    # ── Animations ───────────────────────────────────────────────
    anims = checks.get("animations", {})
    if "error" not in anims:
        animated = anims.get("animated_elements", [])
        if animated:
            sections.append("")
            sections.append("--- ANIMATED ELEMENTS ---")
            sections.append(f"  Detected {len(animated)} animated element(s):")
            for a in animated:
                sections.append(f"    - {a}")
            sections.append(
                "  DIRECTIVE: Do NOT flag '0' values or empty counters as dead "
                "content — they animate on scroll."
            )

    # ── Broken Images ────────────────────────────────────────────
    images = checks.get("images", {})
    if "error" not in images:
        broken = images.get("broken", [])
        total = images.get("total", 0)
        sections.append("")
        sections.append("--- IMAGES ---")
        sections.append(f"  Total images: {total}, Broken: {len(broken)}")
        if broken:
            for img in broken[:5]:
                sections.append(
                    f'    - BROKEN: src="{img.get("src", "")}" '
                    f'alt="{img.get("alt", "")}"'
                )
            confirmed_issues.append(
                f"BROKEN IMAGES: {len(broken)} image(s) failed to load"
            )

    # ── Contact Info ─────────────────────────────────────────────
    contact = checks.get("contact_info", {})
    if "error" not in contact:
        sections.append("")
        sections.append("--- CONTACT INFO ---")
        phones = contact.get("phones", [])
        emails = contact.get("emails", [])
        if phones:
            sections.append(f"  Phone numbers: {', '.join(phones)}")
            if not contact.get("phone_clickable"):
                sections.append("  WARNING: Phone number(s) NOT in clickable tel: links")
                confirmed_issues.append(
                    "PHONE NOT CLICKABLE: Phone number is displayed but not "
                    "wrapped in a tel: link (bad for mobile)"
                )
        else:
            sections.append("  No phone numbers found on page")
            confirmed_issues.append("NO PHONE: No phone number visible on page")

        if emails:
            sections.append(f"  Email addresses: {', '.join(emails)}")
            if not contact.get("email_clickable"):
                sections.append("  WARNING: Email(s) NOT in clickable mailto: links")
        else:
            sections.append("  No email addresses found on page")

    # ── Forms ────────────────────────────────────────────────────
    forms = checks.get("forms", {})
    if "error" not in forms:
        forms_found = forms.get("forms_found", 0)
        sections.append("")
        sections.append("--- FORMS ---")
        sections.append(f"  Forms found: {forms_found}")
        for i, detail in enumerate(forms.get("details", []), 1):
            fields = detail.get("fields", 0)
            has_submit = detail.get("has_submit", False)
            sections.append(
                f"    Form {i}: {fields} field(s), "
                f"submit button={'yes' if has_submit else 'MISSING'}"
            )
            if not has_submit:
                confirmed_issues.append(
                    f"FORM MISSING SUBMIT: Form {i} has {fields} field(s) but "
                    f"no visible submit button"
                )

    # ── Metadata ─────────────────────────────────────────────────
    meta = checks.get("metadata", {})
    if "error" not in meta:
        sections.append("")
        sections.append("--- METADATA ---")
        sections.append(f"  HTTPS: {'yes' if meta.get('is_https') else 'NO (insecure)'}")
        sections.append(
            f"  Viewport meta: {'yes' if meta.get('has_viewport') else 'MISSING'}"
        )
        sections.append(f"  Final URL: {meta.get('final_url', '?')}")
        if not meta.get("is_https"):
            confirmed_issues.append("NOT HTTPS: Site is served over insecure HTTP")
        if not meta.get("has_viewport"):
            confirmed_issues.append(
                "NO VIEWPORT META: Missing viewport meta tag (mobile rendering issue)"
            )

    # ── Placeholder Text ─────────────────────────────────────────
    placeholders = checks.get("placeholder_text", {})
    if "error" not in placeholders:
        found = placeholders.get("found", [])
        if found:
            sections.append("")
            sections.append("--- PLACEHOLDER TEXT ---")
            for p in found:
                sections.append(f'  FOUND: "{p}"')
            confirmed_issues.append(
                f"PLACEHOLDER TEXT: Found {', '.join(found)} on the page"
            )

    # ── Spelling ─────────────────────────────────────────────────
    spelling = checks.get("spelling", {})
    if "error" not in spelling:
        errors = spelling.get("errors", [])
        if errors:
            sections.append("")
            sections.append("--- SPELLING ERRORS ---")
            for err in errors:
                sections.append(
                    f'  "{err["word"]}" -> suggestion: "{err["suggestion"]}" '
                    f'(in: "{err["context"]}")'
                )
            confirmed_issues.append(
                f"SPELLING: {len(errors)} possible spelling error(s) in headings/nav"
            )

    # ── PageSpeed (optional) ─────────────────────────────────────
    if pagespeed and "error" not in pagespeed:
        sections.append("")
        sections.append("--- PAGESPEED INSIGHTS ---")
        for category, score in pagespeed.items():
            if category.startswith("_"):
                continue
            if isinstance(score, (int, float)):
                label = "POOR" if score < 50 else "NEEDS WORK" if score < 90 else "GOOD"
                sections.append(f"  {category}: {score}/100 ({label})")

    # ── Confirmed Issues Summary ─────────────────────────────────
    sections.append("")
    sections.append("=" * 60)
    sections.append("CONFIRMED REAL ISSUES (verified by interactive checks)")
    sections.append("=" * 60)
    if confirmed_issues:
        for issue in confirmed_issues:
            sections.append(f"  * {issue}")
        sections.append("")
        sections.append(
            "DIRECTIVE: Prioritise the confirmed issues above when choosing the "
            "main problem for the audit email. These are ground-truth findings."
        )
    else:
        sections.append("  No confirmed issues found by interactive checks.")
        sections.append(
            "  The site may still have visual/design issues visible in screenshots."
        )

    sections.append("")
    elapsed = checks.get("_elapsed_seconds", "?")
    sections.append(f"[Interactive checks completed in {elapsed}s]")

    return "\n".join(sections)
