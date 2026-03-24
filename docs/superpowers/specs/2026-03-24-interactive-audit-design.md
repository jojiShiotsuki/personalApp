# Interactive Playwright Audit — Design Spec

**Date:** 2026-03-24
**Status:** Approved
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
3. Run interactive checks (click links, detect carousels, check spelling, etc.)
4. Run PageSpeed API calls in parallel (performance + SEO + accessibility)
5. Take desktop screenshot (page in clean state after interactions)
6. Take mobile screenshot (375x812 viewport)
7. Build verification report from all check results
8. Send to Claude: screenshots + verification report + extracted text + audit prompt
9. Save AuditResult (same as today)
```

### Interactive Checks

| Check | Method | Output |
|-------|--------|--------|
| Nav link verification | Find all `<a>` in nav/header, click each, check URL change vs anchor scroll | `{link_text, href, result: "ok"/"404"/"scroll-to-section"/"redirect"/"timeout"}` |
| Carousel detection | Find swiper/slick/owl/carousel classes, check sibling structure, click arrows | `{detected: bool, slide_count: int, auto_rotates: bool}` |
| Animation detection | Snapshot text content, wait 4s, diff for changes (counters, stats) | `{animated_elements: ["0→150+", "0→12 years"]}` |
| Broken images | Query all `<img>`, check `naturalWidth === 0` | `{broken: [urls], total: int}` |
| Contact info | Regex for phone numbers, check `tel:` link. Find emails, check `mailto:` | `{phone, clickable, email, mailto}` |
| Page load timing | Measure DOMContentLoaded and load events | `{dom_ready_ms, full_load_ms}` |
| Visible red flags | Check for "coming soon", "under construction", "lorem ipsum" | `{placeholder_text_found: [locations]}` |
| Mobile viewport | Check for `<meta name="viewport">` | `{has_viewport: bool}` |
| Spelling errors | Extract headings/hero/nav/button text, run pyspellchecker, flag obvious misspellings | `{errors: [{word, context, suggestion}]}` |
| PageSpeed performance | Google API `category=performance` | `{score, fcp_ms, lcp_ms, cls, tti_ms}` |
| PageSpeed SEO | Google API `category=seo` | `{seo_score, missing: [issues]}` |
| PageSpeed accessibility | Google API `category=accessibility` | `{accessibility_score, issues: [descriptions]}` |

### Verification Report Format

Sent to Claude as a text block within the prompt:

```
INTERACTIVE VERIFICATION DATA (trust this data — it was verified by clicking/testing):

NAV LINKS (5 checked):
- Home → OK (loaded in 0.8s)
- About → OK (loaded in 1.2s)
- Services → 404 NOT FOUND
- Projects → OK (loaded in 0.9s)
- Contact → scroll-to-section (anchor #contact)

CAROUSEL DETECTED:
- Found slider with 3 slides (auto-rotating)
- Do NOT flag repeated content as duplicate

ANIMATED ELEMENTS:
- Counter "0" animated to "150+" on scroll
- Counter "0" animated to "12" on scroll
- Do NOT flag these as dead/placeholder content

BROKEN IMAGES: 0 of 14 images broken

CONTACT INFO:
- Phone: 0412 345 678 (visible, NOT clickable — missing tel: link)
- Email: info@example.com (mailto: link present)

SPELLING ERRORS:
- "Profesional" in hero heading → should be "Professional"
- "Maintanence" in services section → should be "Maintenance"

GOOGLE PAGESPEED:
- Performance: 34/100 (POOR) — LCP 8.1s, FCP 4.2s, CLS 0.25
- SEO: 62/100 — Missing meta description, no H1 tag, 4 images without alt text
- Accessibility: 78/100 — Low contrast text detected

PAGE LOAD: DOM ready 1.2s, full load 3.4s
MOBILE VIEWPORT: Present
PLACEHOLDER TEXT: None found

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
- New: `run_interactive_checks(page, url)` — orchestrates all checks (~200-300 lines)
- New: `_check_nav_links(page)` — click each nav link, record result
- New: `_detect_carousels(page)` — find carousel elements, count slides
- New: `_detect_animations(page)` — snapshot, wait, diff text content
- New: `_check_images(page)` — find broken `<img>` elements
- New: `_check_contact_info(page)` — find phone/email, check clickability
- New: `_check_spelling(text)` — pyspellchecker on key text areas
- New: `_build_verification_report(checks)` — format all results as text for Claude
- Modified: `capture_screenshots()` — run interactive checks first on same browser
- Modified: `analyze_with_claude()` — include verification report in prompt content
- Modified: `run_pagespeed_test()` — add SEO + accessibility categories
- Updated: `DEFAULT_AUDIT_PROMPT` — add verification data rules

### `backend/app/routes/autoresearch.py`
- No endpoint changes — verification report flows through existing `screenshots` dict

### `backend/local_auditor.py`
- No changes — calls the same audit service

### `requirements.txt`
- Add: `pyspellchecker`

### Database
- No schema changes
- No migrations needed

### Frontend
- No changes needed

---

## Spelling Check Details

**Approach:** pyspellchecker (client-side) + Claude (visual review)

1. Extract text from high-visibility areas: h1-h3 headings, nav items, buttons, hero section
2. Run through pyspellchecker, ignoring:
   - Words under 3 characters
   - All-caps words (likely acronyms)
   - Words with numbers
   - Common Australian English variants (colour, organisation, etc.)
   - Business names and proper nouns (skip capitalized words in context)
3. Include confirmed spelling errors in verification report
4. Also highlight key text areas for Claude to double-check subtler issues

**Package:** `pyspellchecker` — lightweight, no external API calls, works offline.

---

## PageSpeed Enhancement

Currently: one call with `category=performance` only.

After: three parallel calls:
- `category=performance` — scores, FCP, LCP, CLS, TTI, Speed Index
- `category=seo` — meta tags, headings, alt text, robots.txt, canonical
- `category=accessibility` — contrast, labels, ARIA, lang attribute

All three use the same free Google API (existing API key). Run in parallel with interactive checks to minimize added time.

---

## Performance Budget

| Step | Current Time | New Time | Notes |
|------|-------------|----------|-------|
| Navigate + wait | 3-5s | 3-5s | Same |
| Interactive checks | N/A | 15-25s | New — nav clicks, carousel, animation wait |
| PageSpeed (3 calls parallel) | 3-5s | 5-8s | Was 1 call, now 3 in parallel |
| Desktop screenshot | 2-3s | 2-3s | Same |
| Mobile screenshot | 3-5s | 3-5s | Same |
| Claude analysis | 10-20s | 10-20s | Same (one call, richer context) |
| **Total** | **~30-60s** | **~45-75s** | **+15-25s for much better accuracy** |

---

## Success Criteria

1. Zero false positives on anchor/scroll links — verified by clicking
2. Zero false positives on carousels — detected programmatically
3. Zero false positives on animated counters — detected by diffing
4. Spelling errors caught with specific word + location
5. SEO issues backed by Google's own score, not AI guesswork
6. Claude leads with the most impactful CONFIRMED issue, not visual guesses
