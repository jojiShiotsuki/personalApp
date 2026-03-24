"""
Local Auditor — runs Playwright + Claude Vision on your machine,
then POSTs the audit results to the live Render API.

Usage:
  python local_auditor.py --count 5                    # Audit 5 prospects from default campaign
  python local_auditor.py --count 10 --campaign 3      # Audit 10 from campaign 3
  python local_auditor.py --prospect 42                 # Audit a single prospect by ID

Requires: ANTHROPIC_API_KEY in backend/.env
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time

import httpx
from dotenv import load_dotenv

# Load env vars from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Add backend to path so we can import the audit service
sys.path.insert(0, os.path.dirname(__file__))

from app.services.audit_service import AuditService, DEFAULT_AUDIT_PROMPT, validate_url

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("local_auditor")

# ─── Configuration ───────────────────────────────────

API_URL = os.getenv("RENDER_API_URL", "https://vertex-api-smg3.onrender.com")
USERNAME = os.getenv("ADMIN_USERNAME", "admin")
PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


async def login(client: httpx.AsyncClient) -> str:
    """Login to the live API and return JWT token."""
    resp = await client.post(
        f"{API_URL}/api/auth/login",
        json={"username": USERNAME, "password": PASSWORD},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    logger.info("Logged in to %s", API_URL)
    return token


async def get_prospects_to_audit(
    client: httpx.AsyncClient, token: str, campaign_id: int, count: int
) -> list[dict]:
    """Fetch un-audited prospects from the live API."""
    # Get all prospects in the campaign
    resp = await client.get(
        f"{API_URL}/api/outreach/campaigns/{campaign_id}/prospects",
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    all_prospects = resp.json()
    if isinstance(all_prospects, dict):
        all_prospects = all_prospects.get("prospects", all_prospects.get("items", []))

    # Get already-audited prospect IDs and track which have rejected audits
    resp2 = await client.get(
        f"{API_URL}/api/autoresearch/audits",
        params={"campaign_id": campaign_id, "page": 1, "page_size": 1000},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp2.raise_for_status()
    audits_data = resp2.json()
    audited_ids = set()  # prospects to skip entirely
    rejected_ids = set()  # prospects that can be re-audited (back of queue)
    skipped_ids = set()  # prospects that errored or were auto-skipped
    audits_list = audits_data.get("audits", audits_data) if isinstance(audits_data, dict) else audits_data
    for a in audits_list:
        status = a.get("status")
        pid = a.get("prospect_id")
        if status in ("approved", "pending_review"):
            audited_ids.add(pid)
        elif status == "rejected":
            rejected_ids.add(pid)
        elif status == "skipped":
            skipped_ids.add(pid)

    # Filter to auditable prospects with websites
    candidates = [
        p for p in all_prospects
        if p.get("website")
        and p["website"].strip()
        and p["id"] not in audited_ids
        and p["id"] not in skipped_ids
        and p.get("current_step", 1) == 1
        and p.get("status") in (None, "QUEUED", "queued")
        and not p.get("custom_email_subject")
    ]

    # Sort: un-audited first, rejected at the back
    fresh = [p for p in candidates if p["id"] not in rejected_ids]
    rejected = [p for p in candidates if p["id"] in rejected_ids]
    candidates = fresh + rejected

    selected = candidates[:count]
    logger.info(
        "Found %d un-audited prospects with websites (selected %d of %d requested)",
        len(candidates), len(selected), count,
    )
    return selected


async def post_audit_result(
    client: httpx.AsyncClient,
    token: str,
    prospect: dict,
    audit_data: dict,
    screenshots: dict,
    pagespeed: dict | None,
) -> dict | None:
    """POST the completed audit result to the live API."""
    meta = audit_data.get("_meta", {})

    payload = {
        "prospect_id": prospect["id"],
        "campaign_id": prospect["campaign_id"],
        "issue_type": audit_data.get("issue_type"),
        "issue_detail": audit_data.get("issue_detail"),
        "secondary_issue": audit_data.get("secondary_issue"),
        "secondary_detail": audit_data.get("secondary_detail"),
        "confidence": audit_data.get("confidence", "medium"),
        "site_quality": audit_data.get("site_quality", "medium"),
        "needs_verification": audit_data.get("needs_verification", False),
        "generated_subject": audit_data.get("subject"),
        "generated_body": audit_data.get("body"),
        "word_count": audit_data.get("word_count"),
        "desktop_screenshot": None,  # not stored — only used for AI analysis
        "mobile_screenshot": None,
        "audit_duration_seconds": screenshots.get("duration_seconds"),
        "model_used": meta.get("model"),
        "tokens_used": (meta.get("input_tokens", 0) + meta.get("output_tokens", 0)),
        "ai_cost_estimate": meta.get("cost_usd"),
        "pagespeed_score": pagespeed.get("score") if pagespeed else None,
        "detected_city": audit_data.get("detected_city"),
        "detected_trade": audit_data.get("detected_trade"),
        "generated_subject_variant": audit_data.get("subject_variant"),
    }

    resp = await client.post(
        f"{API_URL}/api/autoresearch/audits/ingest",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )

    if resp.status_code == 200 or resp.status_code == 201:
        result = resp.json()
        logger.info(
            "  -> Uploaded audit #%s: %s (%s) — %s",
            result.get("id", "?"),
            audit_data.get("issue_type", "no issue"),
            audit_data.get("confidence", "?"),
            audit_data.get("subject", "skipped"),
        )
        return result
    else:
        logger.error("  -> Failed to upload audit: %s %s", resp.status_code, resp.text[:200])
        return None


async def audit_single_prospect(
    svc: AuditService,
    prospect: dict,
    audit_prompt: str,
) -> tuple[dict, dict, dict | None]:
    """Run the full audit pipeline on one prospect."""
    url = validate_url(prospect["website"])
    name = prospect.get("contact_name") or prospect.get("agency_name") or "there"
    company = prospect.get("agency_name") or ""
    niche = prospect.get("niche") or "general"

    # Run screenshots + PageSpeed in parallel
    screenshots_task = asyncio.create_task(svc.capture_screenshots(url, min_wait=3))
    pagespeed_task = asyncio.create_task(svc.run_pagespeed_test(url))

    screenshots = await screenshots_task
    pagespeed = await pagespeed_task

    if screenshots.get("error") and not screenshots.get("desktop_screenshot"):
        return {"error": screenshots["error"], "site_quality": "unknown"}, screenshots, pagespeed

    # Analyze with Claude
    audit_data = await svc.analyze_with_claude(
        screenshots=screenshots,
        prospect_name=name,
        prospect_company=company,
        prospect_niche=niche,
        prospect_city="",
        audit_prompt=audit_prompt,
        pagespeed=pagespeed,
    )

    return audit_data, screenshots, pagespeed


async def main():
    parser = argparse.ArgumentParser(description="Local Auditor for Autoresearch")
    parser.add_argument("--count", type=int, default=5, help="Number of prospects to audit")
    parser.add_argument("--campaign", type=int, default=3, help="Campaign ID")
    parser.add_argument("--prospect", type=int, default=None, help="Audit a single prospect ID")
    args = parser.parse_args()

    svc = AuditService()
    audit_prompt = DEFAULT_AUDIT_PROMPT

    async with httpx.AsyncClient(timeout=60) as client:
        token = await login(client)

        if args.prospect:
            # Single prospect mode
            resp = await client.get(
                f"{API_URL}/api/outreach/campaigns/{args.campaign}/prospects",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            all_p = resp.json()
            if isinstance(all_p, dict):
                all_p = all_p.get("prospects", all_p.get("items", []))
            prospect = next((p for p in all_p if p["id"] == args.prospect), None)
            if not prospect:
                logger.error("Prospect %d not found in campaign %d", args.prospect, args.campaign)
                return
            prospects = [prospect]
        else:
            prospects = await get_prospects_to_audit(client, token, args.campaign, args.count)

        if not prospects:
            logger.info("No prospects to audit. Done.")
            return

        total_cost = 0.0
        success_count = 0
        audited_ids: set[int] = set()
        start_time = time.time()

        for i, prospect in enumerate(prospects):
            if prospect["id"] in audited_ids:
                continue
            audited_ids.add(prospect["id"])
            name = prospect.get("agency_name") or prospect.get("contact_name") or f"#{prospect['id']}"
            logger.info(
                "[%d/%d] Auditing %s (%s)...",
                i + 1, len(prospects), name, prospect.get("website", "no url"),
            )

            try:
                audit_data, screenshots, pagespeed = await audit_single_prospect(
                    svc, prospect, audit_prompt,
                )

                if audit_data.get("error") and not audit_data.get("issue_type"):
                    logger.warning("  -> Skipped: %s", audit_data["error"])
                    # Upload a skipped audit so this prospect won't be retried
                    skip_payload = {
                        "prospect_id": prospect["id"],
                        "campaign_id": prospect.get("campaign_id", args.campaign),
                        "issue_type": "navigation_failed",
                        "issue_detail": str(audit_data["error"])[:500],
                        "status": "skipped",
                        "site_quality": "not_target",
                        "confidence": "high",
                    }
                    try:
                        await client.post(
                            f"{API_URL}/api/autoresearch/audits/ingest",
                            json=skip_payload,
                            headers={"Authorization": f"Bearer {token}"},
                        )
                        logger.info("  -> Uploaded skip record to prevent retry")
                    except Exception:
                        pass
                    continue

                cost = audit_data.get("_meta", {}).get("cost_usd", 0)
                total_cost += cost

                result = await post_audit_result(
                    client, token, prospect, audit_data, screenshots, pagespeed,
                )
                if result:
                    success_count += 1

            except Exception as e:
                logger.error("  -> Error: %s", e)

        elapsed = round(time.time() - start_time, 1)
        logger.info(
            "\nDone! %d/%d audits uploaded. Cost: $%.4f. Time: %ds.",
            success_count, len(prospects), total_cost, elapsed,
        )


if __name__ == "__main__":
    asyncio.run(main())
