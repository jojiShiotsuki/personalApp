# Interactive Playwright Audit — Design Spec

**Date:** 2026-03-24
**Status:** Approved (v2 — post-review)
**Goal:** Eliminate false positives and improve audit accuracy by running interactive Playwright checks before sending data to Claude Vision.

---

## Problem

The current audit takes a static screenshot and asks Claude to guess what's wrong. This causes recurring false positives:
- Anchor/scroll nav links flagged as "broken_links"
- Carousels appearing stacked in screenshots flagged as "duplicate_content"
- Animated counters captured before animation flagged as "dead_pages"
- Claude missing real issues because it's distracted by visual ambiguities

## Solution: Pre-Filter Approach

Run interactive Playwright checks BEFORE the screenshot, build a structured verification report, and send it alongside the screenshots to Claude in a single API call. Claude gets ground truth data instead of guessing from a static image.

---

## Architecture

### Flow

```
1. Launch Playwright browser (one instance for everything)
2. Navigate to site (desktop viewport 1440x900)
3. Dismiss cookie/consent banners (if present)
4. Run interactive checks (click links, detect carousels, check spelling, etc.)
5. Run PageSpeed API calls in parallel (performance + SEO + accessibility)
6. Take desktop screenshot (page in clean state after interactions)
7. Take mobile screenshot (375x812 viewport)
8. Build verification report from all check results
9. Send to Claude: screenshots + verification report + extracted text + audit prompt
10. Save AuditResult + verification report summary
```

### Interactive Checks

Each check runs in its own try/except with a timeout cap. A failing check returns partial results and does not abort subsequent checks.

| Check | Method | Timeout | Output |
|-------|--------|---------|--------|
| Cookie banner dismissal | Find common "Accept"/"Got it"/"OK" buttons in banner/modal, click to dismiss | 3s | `{dismissed: bool}` |
| Nav link verification | Find `<a>` in nav/header/footer (max 10), click each, poll `page.url` for changes | 15s total | `{link_text, href, result: "ok"/"404"/"scroll-to-section"/"redirect"/"new-tab"/"timeout"}` |
| Carousel detection | Find swiper/slick/owl/carousel classes, check `overflow-x: hidden` containers with similar children, click arrows | 4s | `{detected: bool, slide_count: int, auto_rotates: bool}` |
| Animation detection | Snapshot text content BEFORE scroll, scroll full page, snapshot AFTER scroll, diff for changes | 6s | `{animated_elements: ["0→150+", "0→12 years"]}` |
| Broken images | Query all `<img>`, check `naturalWidth === 0` or `complete === false` or `src=""` | 2s | `{broken: [urls], total: int}` |
| Contact info | Regex for phone numbers, check `tel:` link. Find emails, check `mailto:` | 2s | `{phone, clickable, email, mailto}` |
| Form detection | Find `<form>` elements, check for submit button, count fields | 2s | `{forms_found: int, has_submit: bool, fields: int}` |
| Page load timing | Measure DOMContentLoaded and load events | 0s (already captured) | `{dom_ready_ms, full_load_ms}` |
| Visible red flags | Check for "coming soon", "under construction", "lorem ipsum" | 1s | `{placeholder_text_found: [locations]}` |
| Mobile viewport | Check for `<meta name="viewport">` | 0s | `{has_viewport: bool}` |
| SSL/HTTPS check | Check final URL scheme after navigation | 0s | `{is_https: bool, had_cert_error: bool}` |
| Spelling errors | Extract h1-h3, nav, button text, run pyspellchecker (en + AU exceptions) | 1s | `{errors: [{word, context, suggestion}]}` |
| PageSpeed performance | Google API `category=performance` | 5-8s (parallel) | `{score, fcp_ms, lcp_ms, cls, tti_ms}` |
| PageSpeed SEO | Google API `category=seo` | 5-8s (parallel) | `{seo_score, missing: [issues]}` |
| PageSpeed accessibility | Google API `category=accessibility` | 5-8s (parallel) | `{accessibility_score, issues: [descriptions]}` |

### Nav Link Verification — SPA Handling

Many tradie sites use WordPress (traditional navigation), but some use React/Vue/Next.js with client-side routing. The nav link check must handle both:

1. Before clicking, record `current_url = page.url`
2. Click the link
3. If link has `target="_blank"`: listen for new tab event via `context.on('page')`, capture URL from new tab, close it, record as "new-tab: {url}"
4. Wait up to 2s, polling `page.url` every 200ms for changes
5. If URL changed to same-page anchor (`#section`): record as "scroll-to-section"
6. If URL changed to different path: check HTTP status, record as "ok" or "404"
7. If URL unchanged after 2s: check if page scrolled (compare `scrollY`), record accordingly
8. Navigate back to original URL before checking next link

### Cookie/Consent Banner Dismissal

Before running any interactive checks:
1. Look for common banner patterns: elements with text "Accept", "Accept All", "Got it", "OK", "I agree" within elements that have `position: fixed` or common class names (`cookie`, `consent`, `gdpr`, `banner`)
2. Click the accept/dismiss button if found
3. Wait 500ms for banner to animate away
4. Proceed with interactive checks

### Verification Report Format

Sent to Claude as a text block within the prompt:

```
INTERACTIVE VERIFICATION DATA (trust this data — it was verified by clicking/testing):

NAV LINKS (5 of 8 checked, capped at 10):
- Home → OK (loaded in 0.8s)
- About → OK (loaded in 1.2s)
- Services → 404 NOT FOUND
- Projects → OK (loaded in 0.9s)
- Contact → scroll-to-section (anchor #contact)

CAROUSEL DETECTED:
- Found slider with 3 slides (auto-rotating)
- Do NOT flag repeated content as duplicate

ANIMATED ELEMENTS (detected via scroll trigger):
- Counter "0" animated to "150+" on scroll
- Counter "0" animated to "12" on scroll
- Do NOT flag these as dead/placeholder content

BROKEN IMAGES: 0 of 14 images broken

CONTACT INFO:
- Phone: 0412 345 678 (visible, NOT clickable — missing tel: link)
- Email: info@example.com (mailto: link present)

FORMS:
- 1 contact form found, has submit button, 4 fields

SPELLING ERRORS:
- "Profesional" in h1 heading → should be "Professional"
- "Maintanence" in h2 heading → should be "Maintenance"

SSL: HTTPS ✓
MOBILE VIEWPORT: Present
PLACEHOLDER TEXT: None found

GOOGLE PAGESPEED:
- Performance: 34/100 (POOR) — LCP 8.1s, FCP 4.2s, CLS 0.25
- SEO: 62/100 — Missing meta description, no H1 tag, 4 images without alt text
- Accessibility: 78/100 — Low contrast text detected

PAGE LOAD: DOM ready 1.2s, full load 3.4s

CONFIRMED REAL ISSUES:
1. /services returns 404
2. Phone number not clickable (missing tel: link)
3. Spelling: "Profesional" in hero heading
4. SEO score 62 — missing meta description, no H1
5. Performance score 34 — 8.1s to show main content
```

### Updated Audit Prompt Rules

Added to DEFAULT_AUDIT_PROMPT:

```
RULES FOR USING VERIFICATION DATA:
- If a link is marked "scroll-to-section" or "ok", do NOT flag it as broken
- If carousel is detected, do NOT flag repeated content as duplicate
- If animated elements were found, do NOT flag them as dead/placeholder
- If spelling errors were found with suggestions, you MAY use them as the primary issue
- Use PageSpeed scores as supporting evidence, not the sole issue
- PRIORITIZE issues confirmed by automated checks over visual guesses
- Lead with the most impactful CONFIRMED issue in the cold email
```

---

## File Changes

### `backend/app/services/audit_service.py`
- New: `_run_interactive_checks(page, url)` — sync helper called from within `_capture_sync`, orchestrates all checks
- New: `_dismiss_cookie_banner(page)` — find and dismiss consent overlays
- New: `_check_nav_links(page)` — click each nav link (max 10), handle SPA pushState + new tabs
- New: `_detect_carousels(page)` — find carousel elements by class + overflow pattern, count slides
- New: `_detect_animations(page)` — snapshot before scroll, scroll, snapshot after scroll, diff
- New: `_check_images(page)` — find broken `<img>` elements
- New: `_check_contact_info(page)` — find phone/email, check clickability
- New: `_check_forms(page)` — find `<form>` elements, check for submit buttons
- New: `_check_spelling(text)` — pyspellchecker (en + AU word list) on h1-h3/nav/button text
- New: `_build_verification_report(checks)` — format all results as text for Claude
- Modified: `_capture_sync()` — dismiss banners + run interactive checks after navigation, before screenshots
- Modified: `analyze_with_claude()` — include verification report in prompt content
- Modified: `run_pagespeed_test()` — add SEO + accessibility categories (3 parallel calls)
- Updated: `DEFAULT_AUDIT_PROMPT` — add verification data rules

### `backend/app/routes/autoresearch.py`
- Modified: batch audit path to pass PageSpeed data to Claude (currently missing)
- Verification report flows through existing `screenshots` dict

### `backend/app/models/autoresearch.py`
- New column: `verification_report` (Text, nullable) — stores the structured verification summary
- New column: `pagespeed_perf_score` (Integer, nullable)
- New column: `pagespeed_seo_score` (Integer, nullable)
- New column: `pagespeed_a11y_score` (Integer, nullable)

### `backend/alembic/versions/`
- New migration: add `verification_report`, `pagespeed_perf_score`, `pagespeed_seo_score`, `pagespeed_a11y_score` to `audit_results`

### `backend/local_auditor.py`
- No changes — calls the same audit service

### `requirements.txt`
- Add: `pyspellchecker`

### Frontend
- No changes needed (verification report stored for debugging but not displayed yet)

---

## Spelling Check Details

**Approach:** pyspellchecker (client-side) + Claude (visual review)

1. Extract text from high-visibility areas: h1, h2, h3, nav items, button text, first section containing an h1
2. Run through pyspellchecker (`language='en'`), ignoring:
   - Words under 3 characters
   - All-caps words (likely acronyms like HVAC, ABN)
   - Words with numbers (model numbers, postcodes)
   - Common Australian English variants: colour, organisation, favour, licence, etc. (custom word list)
   - Capitalized words in context (likely proper nouns/business names)
3. Include confirmed spelling errors in verification report with word + location + suggestion
4. Highlight key text areas for Claude to double-check subtler issues

---

## PageSpeed Enhancement

Currently: one call with `category=performance` only, and NOT passed to Claude in batch audit path.

After: three calls run in parallel with interactive checks:
- `category=performance` — scores, FCP, LCP, CLS, TTI, Speed Index
- `category=seo` — meta tags, headings, alt text, robots.txt, canonical
- `category=accessibility` — contrast, labels, ARIA, lang attribute

Rate limiting for batch audits: stagger the 3 calls with 200ms delay between them. For batches of 50+, add a 1s pause between prospects' PageSpeed calls to stay within Google's free tier (60 queries/minute).

All paths (single audit, batch audit, local auditor) will pass PageSpeed data to Claude.

---

## Error Isolation

Each interactive check is wrapped in its own try/except:

```python
async def _run_interactive_checks(self, page, url):
    results = {}

    results["cookie_banner"] = self._safe_check(self._dismiss_cookie_banner, page)
    results["nav_links"] = self._safe_check(self._check_nav_links, page, timeout=15)
    results["carousels"] = self._safe_check(self._detect_carousels, page, timeout=4)
    results["animations"] = self._safe_check(self._detect_animations, page, timeout=6)
    results["images"] = self._safe_check(self._check_images, page, timeout=2)
    results["contact"] = self._safe_check(self._check_contact_info, page, timeout=2)
    results["forms"] = self._safe_check(self._check_forms, page, timeout=2)
    results["spelling"] = self._safe_check(self._check_spelling, extracted_text, timeout=1)

    return results

def _safe_check(self, check_fn, *args, timeout=5):
    try:
        return check_fn(*args)  # with timeout enforcement
    except Exception as e:
        logger.warning("Interactive check %s failed: %s", check_fn.__name__, e)
        return {"error": str(e)}
```

---

## Pass-2 Verification

The existing `verify_findings()` method (lines 645-737 of audit_service.py) becomes largely redundant for nav link issues since we now verify links BEFORE sending to Claude. However, it can be kept as-is for edge cases where Claude flags something that wasn't covered by interactive checks. No changes to pass-2 in this spec.

---

## Performance Budget

| Step | Current Time | New Time | Notes |
|------|-------------|----------|-------|
| Navigate + wait | 3-5s | 3-5s | Same |
| Cookie banner dismiss | N/A | 0-3s | New — quick check |
| Interactive checks | N/A | 15-25s | New — nav clicks, carousel, animation, spelling |
| PageSpeed (3 calls parallel) | 3-5s | 5-8s | Was 1 call, now 3 in parallel with checks |
| Desktop screenshot | 2-3s | 2-3s | Same |
| Mobile screenshot | 3-5s | 3-5s | Same |
| Claude analysis | 10-20s | 10-20s | Same (one call, richer context) |
| **Total** | **~30-60s** | **~45-75s** | **+15-25s for much better accuracy** |

---

## Success Criteria

1. Zero false positives on anchor/scroll links — verified by clicking
2. Zero false positives on carousels — detected programmatically
3. Zero false positives on animated counters — detected by scroll-triggered diffing
4. Spelling errors caught with specific word + location + suggestion
5. SEO and accessibility issues backed by Google's own scores
6. Claude leads with the most impactful CONFIRMED issue, not visual guesses
7. Contact form presence verified interactively
8. Cookie banners dismissed before analysis
9. Each check isolated — one failure doesn't abort the pipeline
