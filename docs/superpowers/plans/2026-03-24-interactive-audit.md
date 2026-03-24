# Interactive Playwright Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate audit false positives by running interactive Playwright checks (click links, detect carousels, check spelling, run PageSpeed SEO/accessibility) before sending enriched data to Claude Vision.

**Architecture:** A new `_run_interactive_checks()` method runs inside the existing `_capture_sync()` flow — same Playwright browser, same worker thread. Results feed into a structured verification report appended to the Claude prompt. One Claude call, smarter input.

**Tech Stack:** Playwright (existing), pyspellchecker (new), Google PageSpeed API (existing, expanded), Claude Vision (existing)

**Spec:** `docs/superpowers/specs/2026-03-24-interactive-audit-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/services/audit_service.py` | Modify | All interactive checks, report builder, prompt updates |
| `backend/app/services/interactive_checks.py` | Create | New module — all individual check functions (keeps audit_service.py manageable) |
| `backend/app/models/autoresearch.py` | Modify | Add 4 new columns to AuditResult |
| `backend/alembic/versions/xxxx_add_interactive_audit_columns.py` | Create | Migration for new columns |
| `backend/app/routes/autoresearch.py` | Modify | Pass PageSpeed to batch audit Claude call, persist verification report |
| `backend/requirements.txt` | Modify | Add pyspellchecker |

---

### Task 1: Add pyspellchecker dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pyspellchecker to requirements.txt**

Add this line to `backend/requirements.txt`:
```
pyspellchecker==0.8.1
```

- [ ] **Step 2: Install locally**

Run: `cd backend && venv/Scripts/pip install pyspellchecker`

- [ ] **Step 3: Verify import works**

Run: `cd backend && python -c "from spellchecker import SpellChecker; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add pyspellchecker dependency for audit spelling checks"
```

---

### Task 2: Database migration — add interactive audit columns

**Files:**
- Modify: `backend/app/models/autoresearch.py:7-64`
- Create: `backend/alembic/versions/xxxx_add_interactive_audit_columns.py`

- [ ] **Step 1: Add columns to AuditResult model**

In `backend/app/models/autoresearch.py`, add these columns after `ai_cost_estimate` (line 56):

```python
    # Interactive verification data
    verification_report = Column(Text, nullable=True)
    pagespeed_perf_score = Column(Integer, nullable=True)
    pagespeed_seo_score = Column(Integer, nullable=True)
    pagespeed_a11y_score = Column(Integer, nullable=True)
```

- [ ] **Step 2: Create Alembic migration**

Run: `cd backend && python -m alembic revision -m "add interactive audit columns to audit_results"`

- [ ] **Step 3: Write the migration**

Edit the generated migration file:

```python
def upgrade() -> None:
    op.add_column('audit_results', sa.Column('verification_report', sa.Text(), nullable=True))
    op.add_column('audit_results', sa.Column('pagespeed_perf_score', sa.Integer(), nullable=True))
    op.add_column('audit_results', sa.Column('pagespeed_seo_score', sa.Integer(), nullable=True))
    op.add_column('audit_results', sa.Column('pagespeed_a11y_score', sa.Integer(), nullable=True))

def downgrade() -> None:
    op.drop_column('audit_results', 'pagespeed_a11y_score')
    op.drop_column('audit_results', 'pagespeed_seo_score')
    op.drop_column('audit_results', 'pagespeed_perf_score')
    op.drop_column('audit_results', 'verification_report')
```

- [ ] **Step 4: Run migration locally**

Run: `cd backend && python -m alembic upgrade head`

- [ ] **Step 5: Verify**

Run: `cd backend && python -c "from app.models.autoresearch import AuditResult; print(AuditResult.verification_report)"`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/autoresearch.py backend/alembic/versions/
git commit -m "feat: add verification_report and pagespeed score columns to AuditResult"
```

---

### Task 3: Create interactive_checks.py — cookie banner + nav link checks

**Files:**
- Create: `backend/app/services/interactive_checks.py`

This is the core task — the two most important checks that fix the #1 false positive (broken links).

- [ ] **Step 1: Create the module with safe_check wrapper and cookie banner dismissal**

Create `backend/app/services/interactive_checks.py`:

```python
"""
Interactive Playwright checks for the Autoresearch audit system.

Runs BEFORE screenshots to build a verification report with ground truth data.
Each check is isolated — one failure does not abort subsequent checks.
"""

import logging
import re
import time
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

MAX_NAV_LINKS = 10
NAV_LINK_TIMEOUT = 15  # seconds total for all nav link checks
PER_LINK_TIMEOUT = 2000  # ms per individual link click


def safe_check(check_fn, *args, **kwargs) -> dict[str, Any]:
    """Run a check function in a try/except, return error dict on failure."""
    try:
        return check_fn(*args, **kwargs)
    except Exception as e:
        logger.warning("Interactive check %s failed: %s", check_fn.__name__, e)
        return {"error": str(e)}


def dismiss_cookie_banner(page) -> dict[str, Any]:
    """Find and dismiss common cookie/consent banners."""
    dismiss_texts = [
        "Accept All", "Accept all", "Accept Cookies", "Accept cookies",
        "Accept", "Got it", "I agree", "OK", "Okay", "Allow All",
        "Allow all", "Allow Cookies", "Close",
    ]
    try:
        for text in dismiss_texts:
            btn = page.locator(
                f"button:has-text('{text}'), a:has-text('{text}')"
            ).first
            if btn.count() > 0 and btn.is_visible():
                btn.click(timeout=2000)
                time.sleep(0.5)
                logger.info("Dismissed cookie banner via '%s' button", text)
                return {"dismissed": True, "button_text": text}
        return {"dismissed": False}
    except Exception as e:
        logger.debug("Cookie banner dismissal failed (non-fatal): %s", e)
        return {"dismissed": False, "error": str(e)}


def check_nav_links(page) -> dict[str, Any]:
    """Click nav/header/footer links (max 10) to verify they work.

    Handles:
    - Traditional navigation (full page load)
    - SPA pushState routing (URL change without load)
    - Anchor scroll links (#section)
    - target="_blank" links (new tab)
    """
    start = time.monotonic()
    original_url = page.url
    results = []

    # Collect nav links from header, nav, and footer
    links_data = page.evaluate("""
        () => {
            const selectors = ['header a[href]', 'nav a[href]', 'footer a[href]'];
            const seen = new Set();
            const links = [];
            for (const sel of selectors) {
                for (const a of document.querySelectorAll(sel)) {
                    const href = a.href;
                    const text = (a.innerText || '').trim().substring(0, 50);
                    if (!text || seen.has(href) || href.startsWith('javascript:')
                        || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
                    seen.add(href);
                    const rect = a.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        links.push({
                            href: href,
                            text: text,
                            target: a.target || '',
                            isAnchor: a.hash && a.pathname === window.location.pathname,
                        });
                    }
                }
            }
            return links;
        }
    """)

    links_to_check = links_data[:MAX_NAV_LINKS]

    for link in links_to_check:
        # Abort if we've exceeded the total timeout
        if time.monotonic() - start > NAV_LINK_TIMEOUT:
            results.append({
                "text": link["text"], "href": link["href"],
                "result": "timeout", "detail": "Total nav link timeout exceeded"
            })
            continue

        # Quick check: if it's clearly an anchor link to same page
        if link.get("isAnchor"):
            results.append({
                "text": link["text"], "href": link["href"],
                "result": "scroll-to-section",
                "detail": f"Anchor link to {urlparse(link['href']).fragment}"
            })
            continue

        # Actually click the link
        try:
            before_url = page.url
            before_scroll = page.evaluate("() => window.scrollY")

            # Handle target="_blank"
            if link.get("target") == "_blank":
                with page.context.expect_page(timeout=PER_LINK_TIMEOUT) as new_page_info:
                    page.locator(f"a[href='{link['href']}']").first.click(timeout=PER_LINK_TIMEOUT)
                new_tab = new_page_info.value
                new_url = new_tab.url
                new_tab.close()
                results.append({
                    "text": link["text"], "href": link["href"],
                    "result": "new-tab", "detail": f"Opens in new tab: {new_url}"
                })
                continue

            # Normal click
            page.locator(f"a[href='{link['href']}']").first.click(timeout=PER_LINK_TIMEOUT)

            # Poll for URL change (handles both traditional nav and SPA pushState)
            url_changed = False
            for _ in range(10):  # 10 x 200ms = 2s
                time.sleep(0.2)
                current_url = page.url
                if current_url != before_url:
                    url_changed = True
                    # Check if it's just an anchor addition
                    before_parsed = urlparse(before_url)
                    current_parsed = urlparse(current_url)
                    if (before_parsed.netloc == current_parsed.netloc
                            and before_parsed.path == current_parsed.path
                            and current_parsed.fragment):
                        results.append({
                            "text": link["text"], "href": link["href"],
                            "result": "scroll-to-section",
                            "detail": f"Scrolled to #{current_parsed.fragment}"
                        })
                    else:
                        # Different page — check for 404 indicators
                        try:
                            title = page.title().lower()
                            body_text = page.evaluate(
                                "() => (document.body.innerText || '').substring(0, 300)"
                            ).lower()
                            is_404 = any(s in title + " " + body_text for s in [
                                "404", "not found", "page not found",
                                "doesn't exist", "does not exist",
                            ])
                            results.append({
                                "text": link["text"], "href": link["href"],
                                "result": "404" if is_404 else "ok",
                                "detail": current_url,
                            })
                        except Exception:
                            results.append({
                                "text": link["text"], "href": link["href"],
                                "result": "ok", "detail": current_url,
                            })

                    # Navigate back
                    try:
                        page.goto(original_url, wait_until="load", timeout=5000)
                        time.sleep(0.5)
                    except Exception:
                        pass
                    break

            if not url_changed:
                # URL didn't change — check if page scrolled (anchor without hash)
                after_scroll = page.evaluate("() => window.scrollY")
                if abs(after_scroll - before_scroll) > 100:
                    results.append({
                        "text": link["text"], "href": link["href"],
                        "result": "scroll-to-section",
                        "detail": "Page scrolled without URL change (JS scroll)"
                    })
                else:
                    results.append({
                        "text": link["text"], "href": link["href"],
                        "result": "ok",
                        "detail": "No navigation detected (may be JS action)"
                    })

        except Exception as e:
            results.append({
                "text": link["text"], "href": link["href"],
                "result": "error", "detail": str(e)[:100],
            })

    return {
        "total_found": len(links_data),
        "checked": len(results),
        "links": results,
    }
```

- [ ] **Step 2: Verify it imports**

Run: `cd backend && python -c "from app.services.interactive_checks import dismiss_cookie_banner, check_nav_links; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/interactive_checks.py
git commit -m "feat: add interactive_checks module — cookie banner + nav link verification"
```

---

### Task 4: Add carousel, animation, and image checks

**Files:**
- Modify: `backend/app/services/interactive_checks.py`

- [ ] **Step 1: Add carousel detection**

Append to `interactive_checks.py`:

```python
def detect_carousels(page) -> dict[str, Any]:
    """Detect carousel/slider elements by class names and DOM patterns."""
    result = page.evaluate("""
        () => {
            // Check for common carousel library classes
            const carouselSelectors = [
                '.swiper', '.slick-slider', '.owl-carousel', '.carousel',
                '.flickity', '.splide', '.glide', '[data-carousel]',
                '[data-slider]', '.slider', '.slideshow',
            ];
            for (const sel of carouselSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    // Count slides
                    const slideSelectors = [
                        '.swiper-slide', '.slick-slide', '.owl-item',
                        '.carousel-item', '.flickity-cell', '.splide__slide',
                        '.glide__slide',
                    ];
                    let slideCount = 0;
                    for (const ss of slideSelectors) {
                        const slides = el.querySelectorAll(ss);
                        if (slides.length > 0) { slideCount = slides.length; break; }
                    }
                    if (slideCount === 0) {
                        slideCount = el.children.length;
                    }
                    // Check for nav arrows
                    const hasArrows = !!el.querySelector(
                        '.swiper-button-next, .slick-next, .owl-next, ' +
                        '.carousel-control-next, [data-slide="next"], ' +
                        '.splide__arrow--next'
                    );
                    return {
                        detected: true,
                        selector: sel,
                        slide_count: slideCount,
                        has_arrows: hasArrows,
                    };
                }
            }

            // Fallback: check for overflow-x hidden containers with similar children
            const containers = document.querySelectorAll('div, section');
            for (const c of containers) {
                const style = window.getComputedStyle(c);
                if (style.overflowX === 'hidden' && c.children.length >= 3) {
                    const firstTag = c.children[0]?.tagName;
                    const allSameTag = Array.from(c.children).every(
                        ch => ch.tagName === firstTag
                    );
                    if (allSameTag && c.scrollWidth > c.clientWidth * 1.5) {
                        return {
                            detected: true,
                            selector: 'overflow-hidden pattern',
                            slide_count: c.children.length,
                            has_arrows: false,
                        };
                    }
                }
            }

            return { detected: false, slide_count: 0, has_arrows: false };
        }
    """)
    return result
```

- [ ] **Step 2: Add animation detection**

Append to `interactive_checks.py`:

```python
def detect_animations(page) -> dict[str, Any]:
    """Detect animated elements by comparing text content before/after scroll.

    Captures text from potential counter/stat elements, scrolls the page,
    then checks if any values changed (indicating animation).
    """
    # Snapshot BEFORE scroll
    before = page.evaluate("""
        () => {
            const elements = [];
            // Look for common counter/stat patterns
            const candidates = document.querySelectorAll(
                '.counter, .count, .stat, .number, [data-count], [data-target], ' +
                'h2, h3, .h2, .h3, span, strong'
            );
            for (const el of candidates) {
                const text = (el.innerText || '').trim();
                // Only capture elements with numeric content
                if (/^[\\d,\\.\\+\\-\\$%]+$/.test(text.replace(/\\s/g, '')) && text.length < 20) {
                    const rect = el.getBoundingClientRect();
                    elements.push({
                        selector: el.className || el.tagName,
                        text: text,
                        top: rect.top,
                    });
                }
            }
            return elements.slice(0, 20);
        }
    """)

    # Scroll through the page to trigger IntersectionObserver animations
    page.evaluate("""
        async () => {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            const height = document.body.scrollHeight;
            const step = window.innerHeight;
            for (let y = 0; y < height; y += step) {
                window.scrollTo(0, y);
                await delay(200);
            }
            window.scrollTo(0, 0);
        }
    """)
    time.sleep(1)  # Extra wait for animations to complete

    # Snapshot AFTER scroll
    after = page.evaluate("""
        () => {
            const candidates = document.querySelectorAll(
                '.counter, .count, .stat, .number, [data-count], [data-target], ' +
                'h2, h3, .h2, .h3, span, strong'
            );
            const elements = [];
            for (const el of candidates) {
                const text = (el.innerText || '').trim();
                if (/^[\\d,\\.\\+\\-\\$%]+$/.test(text.replace(/\\s/g, '')) && text.length < 20) {
                    elements.push({ text: text });
                }
            }
            return elements.slice(0, 20);
        }
    """)

    # Compare
    animated = []
    for i, b in enumerate(before):
        if i < len(after) and b["text"] != after[i]["text"]:
            animated.append(f"{b['text']}→{after[i]['text']}")

    return {
        "animated_elements": animated,
        "total_checked": len(before),
    }


def check_images(page) -> dict[str, Any]:
    """Find broken images on the page."""
    result = page.evaluate("""
        () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const broken = [];
            for (const img of imgs) {
                if (img.src && (
                    (!img.complete) ||
                    (img.naturalWidth === 0 && img.naturalHeight === 0) ||
                    img.src === ''
                )) {
                    broken.push(img.src.substring(0, 200));
                }
            }
            return { broken: broken, total: imgs.length };
        }
    """)
    return result
```

- [ ] **Step 3: Verify imports**

Run: `cd backend && python -c "from app.services.interactive_checks import detect_carousels, detect_animations, check_images; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/interactive_checks.py
git commit -m "feat: add carousel, animation, and broken image detection"
```

---

### Task 5: Add contact info, form, spelling, and metadata checks

**Files:**
- Modify: `backend/app/services/interactive_checks.py`

- [ ] **Step 1: Add contact info and form checks**

Append to `interactive_checks.py`:

```python
def check_contact_info(page) -> dict[str, Any]:
    """Find phone numbers and emails, check if they're clickable."""
    result = page.evaluate("""
        () => {
            const bodyText = document.body.innerText || '';

            // Phone numbers (Australian formats)
            const phoneRegex = /(?:\\+?61|0)[\\s.-]?(?:\\d[\\s.-]?){8,9}/g;
            const phones = bodyText.match(phoneRegex) || [];

            // Check if phone is in a tel: link
            const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
            const phoneClickable = telLinks.length > 0;

            // Emails
            const emailRegex = /[\\w.+-]+@[\\w-]+\\.[\\w.]+/g;
            const emails = bodyText.match(emailRegex) || [];

            // Check if email is in a mailto: link
            const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
            const emailClickable = mailtoLinks.length > 0;

            return {
                phones: [...new Set(phones)].slice(0, 3),
                phone_clickable: phoneClickable,
                tel_links: telLinks.length,
                emails: [...new Set(emails)].slice(0, 3),
                email_clickable: emailClickable,
                mailto_links: mailtoLinks.length,
            };
        }
    """)
    return result


def check_forms(page) -> dict[str, Any]:
    """Detect contact forms and their structure."""
    result = page.evaluate("""
        () => {
            const forms = Array.from(document.querySelectorAll('form'));
            if (forms.length === 0) return { forms_found: 0 };

            const formDetails = forms.map(form => {
                const inputs = form.querySelectorAll('input, textarea, select');
                const submitBtn = form.querySelector(
                    'button[type="submit"], input[type="submit"], button:not([type])'
                );
                return {
                    fields: inputs.length,
                    has_submit: !!submitBtn,
                    submit_text: submitBtn ? (submitBtn.innerText || submitBtn.value || 'Submit').trim() : null,
                };
            });

            return {
                forms_found: forms.length,
                details: formDetails,
            };
        }
    """)
    return result


def check_metadata(page) -> dict[str, Any]:
    """Check SSL, mobile viewport, and other page metadata."""
    url = page.url
    parsed = urlparse(url)

    viewport = page.evaluate("""
        () => {
            const meta = document.querySelector('meta[name="viewport"]');
            return meta ? meta.content : null;
        }
    """)

    return {
        "is_https": parsed.scheme == "https",
        "has_viewport": viewport is not None,
        "viewport_content": viewport,
        "final_url": url,
    }


def check_placeholder_text(page) -> dict[str, Any]:
    """Check for lorem ipsum, coming soon, under construction text."""
    result = page.evaluate("""
        () => {
            const text = (document.body.innerText || '').toLowerCase();
            const patterns = [
                { pattern: 'lorem ipsum', label: 'Lorem ipsum placeholder text' },
                { pattern: 'coming soon', label: 'Coming soon notice' },
                { pattern: 'under construction', label: 'Under construction notice' },
                { pattern: 'site is being updated', label: 'Site being updated notice' },
                { pattern: 'page not found', label: 'Page not found on homepage' },
                { pattern: 'example.com', label: 'example.com placeholder' },
            ];
            const found = [];
            for (const p of patterns) {
                if (text.includes(p.pattern)) {
                    found.push(p.label);
                }
            }
            return { found: found };
        }
    """)
    return result
```

- [ ] **Step 2: Add spelling check**

Append to `interactive_checks.py`:

```python
def check_spelling(page) -> dict[str, Any]:
    """Extract prominent text and check for spelling errors.

    Uses pyspellchecker on h1-h3, nav, and button text.
    Ignores: short words, ALL CAPS, numbers, Australian English variants.
    """
    try:
        from spellchecker import SpellChecker
    except ImportError:
        return {"error": "pyspellchecker not installed"}

    # Extract text from high-visibility areas
    texts = page.evaluate("""
        () => {
            const result = {};
            const getText = (selector) => {
                const els = document.querySelectorAll(selector);
                return Array.from(els).map(el => ({
                    text: (el.innerText || '').trim(),
                    tag: el.tagName.toLowerCase(),
                })).filter(x => x.text.length > 0);
            };
            result.headings = getText('h1, h2, h3');
            result.nav = getText('nav a, header a');
            result.buttons = getText('button, input[type="submit"]');
            return result;
        }
    """)

    spell = SpellChecker(language='en')

    # Australian English exceptions
    au_words = {
        'colour', 'colours', 'favour', 'favours', 'honour', 'honours',
        'labour', 'labours', 'neighbour', 'neighbours', 'organisation',
        'organisations', 'organise', 'organised', 'organising', 'licence',
        'licences', 'defence', 'catalogue', 'catalogues', 'centre',
        'centres', 'fibre', 'metre', 'metres', 'litre', 'litres',
        'travelling', 'travelled', 'modelling', 'modelled', 'signalling',
        'signalled', 'levelling', 'levelled', 'jewellery', 'cheque',
        'cheques', 'programme', 'programmes', 'specialise', 'specialised',
        'specialising', 'minimise', 'maximise', 'realise', 'realised',
        'analyse', 'analysed', 'customise', 'customised',
        # Common tradie/business terms
        'aircon', 'reno', 'renos', 'tradie', 'tradies', 'ute', 'utes',
        'arvo', 'brekkie', 'servo', 'sparky', 'chippy', 'bricky',
        'hvac', 'abn', 'pty', 'ltd',
    }
    spell.word_frequency.load_words(au_words)

    errors = []
    for category, items in texts.items():
        for item in items:
            words = re.findall(r"[a-zA-Z']+", item["text"])
            for word in words:
                lower = word.lower()
                # Skip: short, ALL CAPS (acronyms), has numbers, likely proper noun
                if (len(word) < 4 or word.isupper() or
                        any(c.isdigit() for c in word) or
                        (word[0].isupper() and category != "headings")):
                    continue
                if lower not in spell and spell.unknown([lower]):
                    correction = spell.correction(lower)
                    if correction and correction != lower:
                        errors.append({
                            "word": word,
                            "context": f"{item['tag']} ({category})",
                            "suggestion": correction,
                        })

    return {"errors": errors[:10]}  # Cap at 10 to avoid noise
```

- [ ] **Step 3: Verify all imports**

Run: `cd backend && python -c "from app.services.interactive_checks import check_contact_info, check_forms, check_metadata, check_placeholder_text, check_spelling; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/interactive_checks.py
git commit -m "feat: add contact, form, spelling, metadata, and placeholder checks"
```

---

### Task 6: Add report builder and orchestrator

**Files:**
- Modify: `backend/app/services/interactive_checks.py`

- [ ] **Step 1: Add the orchestrator and report builder**

Append to `interactive_checks.py`:

```python
def run_all_checks(page, url: str) -> dict[str, Any]:
    """Run all interactive checks and return combined results.

    Each check is isolated — a failure in one does not abort others.
    """
    logger.info("Running interactive checks on %s", url)
    start = time.monotonic()

    results = {}
    results["cookie_banner"] = safe_check(dismiss_cookie_banner, page)
    results["nav_links"] = safe_check(check_nav_links, page)
    results["carousels"] = safe_check(detect_carousels, page)
    results["animations"] = safe_check(detect_animations, page)
    results["images"] = safe_check(check_images, page)
    results["contact"] = safe_check(check_contact_info, page)
    results["forms"] = safe_check(check_forms, page)
    results["metadata"] = safe_check(check_metadata, page)
    results["placeholder"] = safe_check(check_placeholder_text, page)
    results["spelling"] = safe_check(check_spelling, page)

    elapsed = round(time.monotonic() - start, 1)
    logger.info("Interactive checks completed in %.1fs", elapsed)
    results["duration_seconds"] = elapsed

    return results


def build_verification_report(checks: dict[str, Any], pagespeed: dict[str, Any] | None = None) -> str:
    """Build a human-readable verification report for Claude.

    This text block gets appended to the audit prompt so Claude
    has ground truth data alongside the screenshots.
    """
    lines = [
        "INTERACTIVE VERIFICATION DATA (trust this data — it was verified by clicking/testing):",
        "",
    ]

    # Nav links
    nav = checks.get("nav_links", {})
    if not nav.get("error") and nav.get("links"):
        checked = nav["checked"]
        total = nav["total_found"]
        lines.append(f"NAV LINKS ({checked} of {total} checked, capped at {MAX_NAV_LINKS}):")
        for link in nav["links"]:
            result = link["result"].upper() if link["result"] in ("404",) else link["result"]
            lines.append(f"- {link['text']} → {result} ({link.get('detail', '')})")
        lines.append("")

    # Carousels
    carousel = checks.get("carousels", {})
    if not carousel.get("error"):
        if carousel.get("detected"):
            lines.append("CAROUSEL DETECTED:")
            lines.append(f"- Found slider with {carousel.get('slide_count', '?')} slides")
            lines.append("- Do NOT flag repeated content as duplicate_content")
            lines.append("")
        else:
            lines.append("CAROUSEL: None detected")
            lines.append("")

    # Animations
    anim = checks.get("animations", {})
    if not anim.get("error"):
        if anim.get("animated_elements"):
            lines.append("ANIMATED ELEMENTS (detected via scroll trigger):")
            for elem in anim["animated_elements"]:
                lines.append(f"- Counter: {elem}")
            lines.append("- Do NOT flag these as dead_pages or placeholder_text")
            lines.append("")

    # Broken images
    images = checks.get("images", {})
    if not images.get("error"):
        broken = images.get("broken", [])
        total = images.get("total", 0)
        lines.append(f"BROKEN IMAGES: {len(broken)} of {total} images broken")
        for img_url in broken[:5]:
            lines.append(f"- {img_url}")
        lines.append("")

    # Contact info
    contact = checks.get("contact", {})
    if not contact.get("error"):
        phones = contact.get("phones", [])
        emails = contact.get("emails", [])
        if phones:
            clickable = "clickable (tel: link)" if contact.get("phone_clickable") else "NOT clickable (missing tel: link)"
            lines.append(f"CONTACT PHONE: {phones[0]} — {clickable}")
        if emails:
            clickable = "clickable (mailto: link)" if contact.get("email_clickable") else "NOT clickable (missing mailto: link)"
            lines.append(f"CONTACT EMAIL: {emails[0]} — {clickable}")
        if not phones and not emails:
            lines.append("CONTACT INFO: No phone or email found on page")
        lines.append("")

    # Forms
    forms = checks.get("forms", {})
    if not forms.get("error"):
        count = forms.get("forms_found", 0)
        if count > 0:
            details = forms.get("details", [{}])[0]
            lines.append(f"FORMS: {count} form(s) found, {details.get('fields', 0)} fields, "
                        f"{'has submit button' if details.get('has_submit') else 'NO submit button'}")
        else:
            lines.append("FORMS: No contact form found on page")
        lines.append("")

    # Spelling
    spelling = checks.get("spelling", {})
    if not spelling.get("error"):
        errors = spelling.get("errors", [])
        if errors:
            lines.append("SPELLING ERRORS:")
            for err in errors:
                lines.append(f"- \"{err['word']}\" in {err['context']} → should be \"{err['suggestion']}\"")
            lines.append("")

    # Metadata
    meta = checks.get("metadata", {})
    if not meta.get("error"):
        ssl = "HTTPS ✓" if meta.get("is_https") else "NOT HTTPS — browser shows security warning"
        viewport = "Present" if meta.get("has_viewport") else "MISSING — site may not be mobile-friendly"
        lines.append(f"SSL: {ssl}")
        lines.append(f"MOBILE VIEWPORT: {viewport}")
        lines.append("")

    # Placeholder text
    placeholder = checks.get("placeholder", {})
    if not placeholder.get("error"):
        found = placeholder.get("found", [])
        if found:
            lines.append("PLACEHOLDER TEXT FOUND:")
            for p in found:
                lines.append(f"- {p}")
            lines.append("")

    # PageSpeed (all 3 categories)
    if pagespeed:
        perf = pagespeed.get("performance", {})
        seo = pagespeed.get("seo", {})
        a11y = pagespeed.get("accessibility", {})

        lines.append("GOOGLE PAGESPEED:")
        if perf and not perf.get("error"):
            score = perf.get("score")
            label = "POOR" if score and score < 50 else "OK" if score and score >= 50 else "unknown"
            lines.append(f"- Performance: {score}/100 ({label})")
            lines.append(f"  FCP: {perf.get('first_contentful_paint', 'N/A')}, "
                        f"LCP: {perf.get('largest_contentful_paint', 'N/A')}, "
                        f"CLS: {perf.get('cumulative_layout_shift', 'N/A')}")
        if seo and not seo.get("error"):
            lines.append(f"- SEO: {seo.get('score')}/100")
            for issue in seo.get("failed_audits", [])[:5]:
                lines.append(f"  Missing: {issue}")
        if a11y and not a11y.get("error"):
            lines.append(f"- Accessibility: {a11y.get('score')}/100")
            for issue in a11y.get("failed_audits", [])[:3]:
                lines.append(f"  Issue: {issue}")
        lines.append("")

    # Build confirmed issues summary
    confirmed = []
    for link in nav.get("links", []):
        if link["result"] == "404":
            confirmed.append(f"{link['text']} page returns 404")
    if images.get("broken"):
        confirmed.append(f"{len(images['broken'])} broken image(s)")
    if contact.get("phones") and not contact.get("phone_clickable"):
        confirmed.append("Phone number not clickable (missing tel: link)")
    if spelling.get("errors"):
        top = spelling["errors"][0]
        confirmed.append(f"Spelling: \"{top['word']}\" in {top['context']}")
    if meta.get("is_https") is False:
        confirmed.append("Site not using HTTPS — browser shows security warning")
    if placeholder.get("found"):
        confirmed.append(f"Placeholder text: {placeholder['found'][0]}")
    if perf_score := pagespeed and pagespeed.get("performance", {}).get("score"):
        if perf_score < 40:
            confirmed.append(f"Performance score {perf_score}/100 — very slow")
    if seo_score := pagespeed and pagespeed.get("seo", {}).get("score"):
        if seo_score < 70:
            confirmed.append(f"SEO score {seo_score}/100")

    if confirmed:
        lines.append("CONFIRMED REAL ISSUES:")
        for i, issue in enumerate(confirmed, 1):
            lines.append(f"{i}. {issue}")
        lines.append("")

    return "\n".join(lines)
```

- [ ] **Step 2: Verify full module**

Run: `cd backend && python -c "from app.services.interactive_checks import run_all_checks, build_verification_report; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/interactive_checks.py
git commit -m "feat: add check orchestrator and verification report builder"
```

---

### Task 7: Expand PageSpeed to SEO + accessibility

**Files:**
- Modify: `backend/app/services/audit_service.py:393-450`

- [ ] **Step 1: Rewrite run_pagespeed_test to return all 3 categories**

Replace the `run_pagespeed_test` method in `audit_service.py` (lines 393-450):

```python
    async def run_pagespeed_test(self, url: str) -> dict[str, Any]:
        """
        Run Google PageSpeed Insights for performance, SEO, and accessibility.
        Returns a dict with results keyed by category.
        """
        categories = ["performance", "seo", "accessibility"]
        google_api_key = os.getenv("GOOGLE_API_KEY")
        results = {}

        async with httpx.AsyncClient(timeout=60) as client:
            for cat in categories:
                params = {
                    "url": url,
                    "category": cat,
                    "strategy": "mobile",
                }
                if google_api_key:
                    params["key"] = google_api_key

                try:
                    response = await client.get(
                        "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
                        params=params,
                    )
                    response.raise_for_status()
                    data = response.json()

                    lighthouse = data.get("lighthouseResult", {})
                    cat_data = lighthouse.get("categories", {}).get(cat, {})
                    audits = lighthouse.get("audits", {})

                    score_raw = cat_data.get("score")
                    score = round(score_raw * 100) if score_raw is not None else None

                    cat_result = {"score": score, "error": None}

                    if cat == "performance":
                        cat_result["first_contentful_paint"] = audits.get("first-contentful-paint", {}).get("displayValue")
                        cat_result["largest_contentful_paint"] = audits.get("largest-contentful-paint", {}).get("displayValue")
                        cat_result["speed_index"] = audits.get("speed-index", {}).get("displayValue")
                        cat_result["time_to_interactive"] = audits.get("interactive", {}).get("displayValue")
                        cat_result["cumulative_layout_shift"] = audits.get("cumulative-layout-shift", {}).get("displayValue")
                        speed_index_ms = audits.get("speed-index", {}).get("numericValue")
                        cat_result["load_seconds"] = round(speed_index_ms / 1000, 1) if speed_index_ms else None
                        cat_result["is_slow"] = score is not None and score < 50
                    else:
                        # Extract failed audits for SEO and accessibility
                        failed = []
                        for audit_id, audit_data in audits.items():
                            if audit_data.get("score") == 0 and audit_data.get("title"):
                                failed.append(audit_data["title"])
                        cat_result["failed_audits"] = failed[:10]

                    results[cat] = cat_result

                except Exception as e:
                    logger.warning("PageSpeed %s test failed for %s: %s", cat, url, e)
                    results[cat] = {"score": None, "error": str(e)}

                # Small delay between calls to avoid rate limiting
                await asyncio.sleep(0.3)

        return results
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "from app.services.audit_service import AuditService; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/audit_service.py
git commit -m "feat: expand PageSpeed to SEO + accessibility categories"
```

---

### Task 8: Integrate interactive checks into _capture_sync

**Files:**
- Modify: `backend/app/services/audit_service.py:202-323`

- [ ] **Step 1: Add interactive checks to _capture_sync**

In `_capture_sync`, after the bot detection check (line 247) and BEFORE the scroll + screenshot (line 250), add the interactive checks:

```python
            # ── Interactive checks (before screenshots) ────
            from app.services.interactive_checks import run_all_checks
            result["interactive_checks"] = run_all_checks(desktop_page, url)

            # Re-navigate to clean state after link clicking
            try:
                desktop_page.goto(url, wait_until="load", timeout=10000)
                time.sleep(1)
            except Exception:
                pass  # Non-fatal — page may already be on the right URL
```

This goes right before line 249 (`# Scroll to bottom to trigger lazy-loading`).

- [ ] **Step 2: Verify the integration point**

Run: `cd backend && python -c "from app.services.audit_service import AuditService; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/audit_service.py
git commit -m "feat: integrate interactive checks into _capture_sync flow"
```

---

### Task 9: Update analyze_with_claude to include verification report

**Files:**
- Modify: `backend/app/services/audit_service.py:456-549`

- [ ] **Step 1: Add verification report to Claude prompt**

In `analyze_with_claude`, after building `context_block` (around line 543) and before appending it to `content`, add the verification report:

```python
        # Build and inject verification report from interactive checks
        verification_report = ""
        if screenshots.get("interactive_checks"):
            from app.services.interactive_checks import build_verification_report
            verification_report = build_verification_report(
                screenshots["interactive_checks"],
                pagespeed,
            )
            context_block = verification_report + "\n\n" + context_block
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/audit_service.py
git commit -m "feat: include verification report in Claude analysis prompt"
```

---

### Task 10: Update DEFAULT_AUDIT_PROMPT with verification rules

**Files:**
- Modify: `backend/app/services/audit_service.py:81-153`

- [ ] **Step 1: Add verification data rules to the audit prompt**

Add this block after the existing `CRITICAL RULES:` section (before the SIGN-OFF section around line 128):

```python
VERIFICATION DATA RULES (if interactive verification data is provided above):
- If a link is marked "scroll-to-section" or "ok", do NOT flag it as broken_links
- If carousel is detected, do NOT flag repeated content as duplicate_content
- If animated elements were detected, do NOT flag them as dead_pages or placeholder_text
- If spelling errors were found with suggestions, you MAY use them as the primary issue
- Use PageSpeed scores as supporting evidence, not as the sole issue type
- PRIORITIZE issues confirmed by automated checks over visual guesses from screenshots
- Lead with the most impactful CONFIRMED issue in the cold email
- If no confirmed issues exist, fall back to visual analysis of the screenshots
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/audit_service.py
git commit -m "feat: add verification data rules to DEFAULT_AUDIT_PROMPT"
```

---

### Task 11: Update routes to persist verification data + fix batch PageSpeed

**Files:**
- Modify: `backend/app/routes/autoresearch.py`

- [ ] **Step 1: Persist verification_report and PageSpeed scores in single audit endpoint**

In the single audit endpoint (around line 245 where AuditResult is created), add:

```python
                # Extract verification report and PageSpeed scores
                verification_report_text = ""
                if screenshots.get("interactive_checks"):
                    from app.services.interactive_checks import build_verification_report
                    verification_report_text = build_verification_report(
                        screenshots["interactive_checks"], pagespeed
                    )

                audit_result = AuditResult(
                    ...
                    verification_report=verification_report_text or None,
                    pagespeed_perf_score=pagespeed.get("performance", {}).get("score") if pagespeed else None,
                    pagespeed_seo_score=pagespeed.get("seo", {}).get("score") if pagespeed else None,
                    pagespeed_a11y_score=pagespeed.get("accessibility", {}).get("score") if pagespeed else None,
                    ...
                )
```

Apply the same pattern to the batch audit AuditResult creation.

- [ ] **Step 2: Fix batch audit to run and pass PageSpeed data**

In `_run_batch_audit`, the batch currently does NOT run PageSpeed. After the `screenshots` capture and before `analyze_with_claude`, add:

```python
                # Run PageSpeed (expanded to 3 categories)
                try:
                    batch_pagespeed = await svc.run_pagespeed_test(batch_validated_url)
                except Exception as ps_err:
                    logger.warning("Batch %s: PageSpeed failed for prospect %d: %s", batch_id, prospect.id, ps_err)
                    batch_pagespeed = None
```

And pass it to `analyze_with_claude`:
```python
                analysis = await svc.analyze_with_claude(
                    screenshots=screenshots,
                    ...
                    pagespeed=batch_pagespeed,
                )
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes/autoresearch.py
git commit -m "feat: persist verification report + PageSpeed scores, fix batch PageSpeed"
```

---

### Task 12: End-to-end test with local auditor

**Files:**
- No file changes — testing only

- [ ] **Step 1: Run local auditor on a known test site**

Run: `cd backend && python local_auditor.py --count 1 --campaign 3`

Verify:
- Interactive checks run (look for "Running interactive checks" in logs)
- Nav links are checked (look for "NAV LINKS" in output)
- Carousel detection runs
- Spelling check runs
- PageSpeed runs 3 categories
- Claude receives verification report
- Audit result has verification_report stored

- [ ] **Step 2: Check the audit result on the live site**

Navigate to the Autoresearch > Audits tab and verify the latest audit shows sensible results with no false positives on anchor links or carousels.

- [ ] **Step 3: Final commit + push**

```bash
git push origin main
```

---

## Task Dependency Graph

```
Task 1 (pyspellchecker) ─────────────────────────────┐
Task 2 (DB migration) ───────────────────────────────┤
Task 3 (cookie + nav links) ──┐                       │
Task 4 (carousel + animation) ├─ Task 6 (orchestrator) ├─ Task 8 (integrate into _capture_sync)
Task 5 (contact + spelling) ──┘                       │   Task 9 (verification in Claude prompt)
Task 7 (PageSpeed expansion) ─────────────────────────┘   Task 10 (audit prompt rules)
                                                          Task 11 (routes + persistence)
                                                          Task 12 (E2E test)
```

Tasks 1-7 can run in parallel (independent modules). Tasks 8-12 are sequential (integration + testing).
