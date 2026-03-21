"""
Autoresearch API routes — audit and settings endpoints.

Provides:
- Single and batch prospect auditing (Playwright + Claude Vision)
- Audit listing, approval, and rejection
- Per-user autoresearch settings management
"""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime
from typing import Optional

import base64

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.database.connection import SessionLocal
from app.models.autoresearch import (
    AuditResult,
    AutoresearchSettings,
    EmailOpen,
    Experiment,
    GmailToken,
    Insight,
)
from app.models.outreach import OutreachProspect, ProspectStatus
from app.models.user import User
from app.schemas.autoresearch import (
    AnalyticsOverview,
    AuditApproveRequest,
    AuditRejectRequest,
    AuditResultResponse,
    AutoresearchSettingsResponse,
    AutoresearchSettingsUpdate,
    BatchAuditResponse,
    BatchProgressResponse,
    ExperimentListResponse,
    ExperimentResponse,
    InsightResponse,
    IssueTypeStats,
    LoomStatusUpdate,
    NicheStats,
    TimingStats,
    TrackingPixelResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/autoresearch", tags=["autoresearch"])

# ──────────────────────────────────────────────
# Audit service (module-level, lazy init)
# ──────────────────────────────────────────────

try:
    from app.services.audit_service import AuditService, DEFAULT_AUDIT_PROMPT, validate_url
    audit_service = AuditService()
except Exception:
    logger.warning(
        "AuditService could not be initialised (ANTHROPIC_API_KEY may not be set). "
        "Audit endpoints will return 503."
    )
    audit_service = None  # type: ignore[assignment]
    from app.services.audit_service import DEFAULT_AUDIT_PROMPT, validate_url

# ──────────────────────────────────────────────
# Gmail service (module-level, lazy init)
# ──────────────────────────────────────────────

try:
    from app.services.gmail_service import GmailService
    gmail_service = GmailService()
    logger.info("GmailService initialized successfully")
except Exception as gmail_init_err:
    logger.warning(
        "GmailService could not be initialised: %s. "
        "ENV check: GOOGLE_CLIENT_ID=%s, GOOGLE_CLIENT_SECRET=%s, GMAIL_ENCRYPTION_KEY=%s",
        gmail_init_err,
        "SET" if os.getenv("GOOGLE_CLIENT_ID") else "MISSING",
        "SET" if os.getenv("GOOGLE_CLIENT_SECRET") else "MISSING",
        "SET" if os.getenv("GMAIL_ENCRYPTION_KEY") else "MISSING",
    )
    gmail_service = None  # type: ignore[assignment]

# OAuth state → user_id mapping (CSRF protection)
_oauth_states: dict[str, int] = {}

# ──────────────────────────────────────────────
# In-memory batch tracking
# ──────────────────────────────────────────────

_batch_jobs: dict[str, dict] = {}

# Batch job cleanup interval (seconds)
_BATCH_JOB_MAX_AGE = 3600  # 1 hour

# 1x1 transparent PNG for email open tracking
TRANSPARENT_PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def _cleanup_stale_batch_jobs() -> None:
    """Remove completed batch jobs older than 1 hour to prevent memory leaks."""
    now = time.monotonic()
    stale_ids = [
        bid
        for bid, job in _batch_jobs.items()
        if job.get("is_complete") and (now - job.get("_completed_at", 0)) > _BATCH_JOB_MAX_AGE
    ]
    for bid in stale_ids:
        del _batch_jobs[bid]
    if stale_ids:
        logger.info("Cleaned up %d stale batch jobs", len(stale_ids))


def _require_audit_service() -> "AuditService":
    """Raise 503 if the audit service is unavailable."""
    if audit_service is None:
        raise HTTPException(
            status_code=503,
            detail="Audit service unavailable — ANTHROPIC_API_KEY is not configured.",
        )
    return audit_service


# ──────────────────────────────────────────────
# 1. POST /audit/{prospect_id} — single audit
# ──────────────────────────────────────────────

@router.post("/audit/{prospect_id}")
async def audit_single_prospect(
    prospect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Audit a single prospect's website with Playwright + Claude Vision."""
    svc = _require_audit_service()

    # Fetch prospect
    prospect = (
        db.query(OutreachProspect)
        .filter(OutreachProspect.id == prospect_id)
        .first()
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    if not prospect.website:
        raise HTTPException(
            status_code=400,
            detail="Prospect has no website URL — cannot audit.",
        )

    # Validate and normalise URL
    try:
        validated_url = validate_url(prospect.website)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Load user settings (for audit_prompt, min_wait)
    settings = (
        db.query(AutoresearchSettings)
        .filter(AutoresearchSettings.user_id == current_user.id)
        .first()
    )
    audit_prompt = (settings.audit_prompt if settings and settings.audit_prompt else DEFAULT_AUDIT_PROMPT)
    min_wait = (settings.min_page_load_wait if settings else 3)

    # Inject learning context into audit prompt
    learning_context = None
    try:
        from app.services.learning_service import LearningService
        learning_svc = LearningService()
        learning_context = learning_svc.build_learning_context(db, prospect.niche)
    except Exception as e:
        logger.warning("Could not build learning context: %s", e)

    if learning_context:
        audit_prompt = audit_prompt + "\n\n" + learning_context

    try:
        # Run screenshots and PageSpeed in parallel
        import asyncio as _asyncio
        logger.info("Starting screenshot capture + PageSpeed for %s", validated_url)
        screenshots_task = _asyncio.create_task(svc.capture_screenshots(validated_url, min_wait=min_wait))
        pagespeed_task = _asyncio.create_task(svc.run_pagespeed_test(validated_url))

        screenshots = await screenshots_task
        pagespeed = await pagespeed_task

        logger.info(
            "Screenshot result: desktop=%s, mobile=%s, error=%s, duration=%s | PageSpeed: %s/100",
            bool(screenshots.get("desktop_screenshot")),
            bool(screenshots.get("mobile_screenshot")),
            screenshots.get("error"),
            screenshots.get("duration_seconds"),
            pagespeed.get("score"),
        )

        if screenshots.get("error") and not screenshots.get("desktop_screenshot"):
            raise HTTPException(
                status_code=502,
                detail=f"Screenshot capture failed: {screenshots['error']}",
            )

        # Analyse with Claude (screenshots + PageSpeed data)
        logger.info("Starting Claude analysis...")
        analysis = await svc.analyze_with_claude(
            screenshots=screenshots,
            prospect_name=prospect.contact_name or prospect.agency_name,
            prospect_company=prospect.agency_name,
            prospect_niche=prospect.niche or "general",
            prospect_city="",
            audit_prompt=audit_prompt,
            pagespeed=pagespeed,
        )

        if analysis.get("error") and not analysis.get("issue_type"):
            raise HTTPException(
                status_code=502,
                detail=f"Claude analysis failed: {analysis['error']}",
            )

        # Persist AuditResult
        meta = analysis.get("_meta", {})
        audit_result = AuditResult(
            prospect_id=prospect.id,
            campaign_id=prospect.campaign_id,
            issue_type=analysis.get("issue_type"),
            issue_detail=analysis.get("issue_detail"),
            secondary_issue=analysis.get("secondary_issue"),
            secondary_detail=analysis.get("secondary_detail"),
            confidence=analysis.get("confidence", "medium"),
            site_quality=analysis.get("site_quality", "medium"),
            needs_verification=analysis.get("needs_verification", False),
            generated_subject=analysis.get("subject"),
            generated_subject_variant=analysis.get("subject_variant"),
            detected_city=analysis.get("detected_city"),
            detected_trade=analysis.get("detected_trade"),
            generated_body=analysis.get("body"),
            word_count=analysis.get("word_count"),
            desktop_screenshot=screenshots.get("desktop_screenshot"),
            mobile_screenshot=screenshots.get("mobile_screenshot"),
            status="pending_review",
            audit_duration_seconds=meta.get("duration_seconds"),
            model_used=meta.get("model"),
            tokens_used=(meta.get("input_tokens", 0) + meta.get("output_tokens", 0)),
            ai_cost_estimate=meta.get("cost_usd"),
        )
        db.add(audit_result)
        db.commit()
        db.refresh(audit_result)

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as exc:
        logger.error(
            "Unexpected error auditing prospect %d (%s): %s",
            prospect_id, validated_url, exc, exc_info=True,
        )
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Audit failed unexpectedly: {type(exc).__name__}: {exc}",
        )

    # Build response dict
    return {
        "id": audit_result.id,
        "prospect_id": audit_result.prospect_id,
        "campaign_id": audit_result.campaign_id,
        "issue_type": audit_result.issue_type,
        "issue_detail": audit_result.issue_detail,
        "secondary_issue": audit_result.secondary_issue,
        "secondary_detail": audit_result.secondary_detail,
        "confidence": audit_result.confidence,
        "site_quality": audit_result.site_quality,
        "generated_subject": audit_result.generated_subject,
        "generated_body": audit_result.generated_body,
        "word_count": audit_result.word_count,
        "status": audit_result.status,
        "ai_cost_estimate": audit_result.ai_cost_estimate,
        "created_at": str(audit_result.created_at),
        "prospect_name": prospect.contact_name or prospect.agency_name,
        "prospect_company": prospect.agency_name,
        "prospect_niche": prospect.niche,
        "prospect_email": prospect.email,
        "prospect_website": prospect.website,
    }


# ──────────────────────────────────────────────
# 2. POST /audit/batch/{campaign_id} — batch audit
# ──────────────────────────────────────────────

@router.post("/audit/batch/{campaign_id}", response_model=BatchAuditResponse)
async def start_batch_audit(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    limit: int = Query(50, ge=1, le=500, description="Max number of prospects to audit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a batch audit for un-audited prospects with websites in a campaign."""
    _require_audit_service()

    # Opportunistic cleanup of completed batch jobs older than 1 hour
    _cleanup_stale_batch_jobs()

    # Count un-audited prospects with websites
    already_audited_ids = (
        db.query(AuditResult.prospect_id)
        .filter(AuditResult.campaign_id == campaign_id)
        .subquery()
    )
    total = (
        db.query(func.count(OutreachProspect.id))
        .filter(
            OutreachProspect.campaign_id == campaign_id,
            OutreachProspect.website.isnot(None),
            OutreachProspect.website != "",
            ~OutreachProspect.id.in_(already_audited_ids),
        )
        .scalar()
    ) or 0

    if total == 0:
        raise HTTPException(
            status_code=400,
            detail="No un-audited prospects with websites found in this campaign.",
        )

    # Apply the user's limit
    actual_count = min(total, limit)

    batch_id = str(uuid.uuid4())
    _batch_jobs[batch_id] = {
        "completed": 0,
        "total": actual_count,
        "errors": 0,
        "current_prospect": None,
        "is_complete": False,
        "cancelled": False,
    }

    background_tasks.add_task(
        _run_batch_audit,
        batch_id=batch_id,
        campaign_id=campaign_id,
        session_factory=SessionLocal,
        user_id=current_user.id,
        max_count=actual_count,
    )

    return BatchAuditResponse(
        batch_id=batch_id,
        total=actual_count,
        message=f"Batch audit started for {actual_count} prospects (of {total} available).",
    )


# ──────────────────────────────────────────────
# 3. GET /audit/batch/{batch_id}/progress
# ──────────────────────────────────────────────

@router.get("/audit/batch/{batch_id}/progress", response_model=BatchProgressResponse)
def get_batch_progress(
    batch_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return progress of a running batch audit."""
    job = _batch_jobs.get(batch_id)
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    return BatchProgressResponse(
        batch_id=batch_id,
        completed=job["completed"],
        total=job["total"],
        errors=job["errors"],
        current_prospect=job["current_prospect"],
        is_complete=job["is_complete"],
        is_cancelled=job["cancelled"],
    )


# ──────────────────────────────────────────────
# 4. POST /audit/batch/{batch_id}/cancel
# ──────────────────────────────────────────────

@router.post("/audit/batch/{batch_id}/cancel")
def cancel_batch_audit(
    batch_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel a running batch audit."""
    job = _batch_jobs.get(batch_id)
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    job["cancelled"] = True
    return {"message": "Batch audit cancellation requested.", "batch_id": batch_id}


# ──────────────────────────────────────────────
# 4b. POST /audits/ingest — accept pre-computed audit from local auditor
# ──────────────────────────────────────────────

@router.post("/audits/ingest")
async def ingest_audit(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a pre-computed audit result from the local auditor script."""
    prospect_id = payload.get("prospect_id")
    if not prospect_id:
        raise HTTPException(status_code=400, detail="prospect_id is required")

    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    status = "pending_review"
    if payload.get("site_quality") == "good":
        status = "skipped"

    audit_result = AuditResult(
        prospect_id=prospect_id,
        campaign_id=payload.get("campaign_id", prospect.campaign_id),
        issue_type=payload.get("issue_type"),
        issue_detail=payload.get("issue_detail"),
        secondary_issue=payload.get("secondary_issue"),
        secondary_detail=payload.get("secondary_detail"),
        confidence=payload.get("confidence", "medium"),
        site_quality=payload.get("site_quality", "medium"),
        needs_verification=payload.get("needs_verification", False),
        generated_subject=payload.get("generated_subject"),
        generated_subject_variant=payload.get("generated_subject_variant"),
        generated_body=payload.get("generated_body"),
        word_count=payload.get("word_count"),
        desktop_screenshot=payload.get("desktop_screenshot"),
        mobile_screenshot=payload.get("mobile_screenshot"),
        status=status,
        audit_duration_seconds=payload.get("audit_duration_seconds"),
        model_used=payload.get("model_used"),
        tokens_used=payload.get("tokens_used"),
        ai_cost_estimate=payload.get("ai_cost_estimate"),
        detected_city=payload.get("detected_city"),
        detected_trade=payload.get("detected_trade"),
    )
    db.add(audit_result)
    db.commit()
    db.refresh(audit_result)

    return {
        "id": audit_result.id,
        "prospect_id": prospect_id,
        "status": audit_result.status,
        "issue_type": audit_result.issue_type,
        "confidence": audit_result.confidence,
        "subject": audit_result.generated_subject,
        "subject_variant": audit_result.generated_subject_variant,
    }


# ──────────────────────────────────────────────
# 5. GET /audits — list audits with filters
# ──────────────────────────────────────────────

@router.get("/audits")
def list_audits(
    campaign_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    confidence: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List audit results with optional filters and pagination."""
    query = (
        db.query(
            AuditResult,
            OutreachProspect.contact_name,
            OutreachProspect.agency_name,
            OutreachProspect.niche,
            OutreachProspect.email,
            OutreachProspect.website,
        )
        .join(OutreachProspect, AuditResult.prospect_id == OutreachProspect.id)
    )

    if campaign_id is not None:
        query = query.filter(AuditResult.campaign_id == campaign_id)
    if status is not None:
        query = query.filter(AuditResult.status == status)
    if confidence is not None:
        query = query.filter(AuditResult.confidence == confidence)

    total_count = query.count()
    # Sort: pending_review first, then approved, then rejected/skipped last
    status_order = case(
        (AuditResult.status == "pending_review", 0),
        (AuditResult.status == "approved", 1),
        (AuditResult.status == "skipped", 2),
        (AuditResult.status == "rejected", 3),
        else_=4,
    )
    query = query.order_by(status_order, AuditResult.created_at.desc())

    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()

    results = []
    for audit, contact_name, agency_name, niche, email, website in rows:
        resp = AuditResultResponse.model_validate(audit, from_attributes=True)
        resp.prospect_name = contact_name or agency_name
        resp.prospect_company = agency_name
        resp.prospect_niche = niche
        resp.prospect_email = email
        resp.prospect_website = website
        results.append(resp)

    return {"audits": results, "total_count": total_count, "page": page, "page_size": page_size}


# ──────────────────────────────────────────────
# 6. PUT /audits/{audit_id}/approve
# ──────────────────────────────────────────────

@router.put("/audits/{audit_id}/approve", response_model=AuditResultResponse)
def approve_audit(
    audit_id: int,
    body: AuditApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve an audit result. Optionally supply edited subject/body."""
    audit = db.query(AuditResult).filter(AuditResult.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit result not found")

    # Update audit status
    audit.status = "approved"
    if body.edited_subject is not None:
        audit.was_edited = True
        audit.edited_subject = body.edited_subject
    if body.edited_body is not None:
        audit.was_edited = True
        audit.edited_body = body.edited_body

    # Determine final subject/body (edited takes precedence)
    final_subject = body.edited_subject or audit.generated_subject
    final_body = body.edited_body or audit.generated_body

    # Update the prospect's custom email fields
    prospect = (
        db.query(OutreachProspect)
        .filter(OutreachProspect.id == audit.prospect_id)
        .first()
    )
    if prospect:
        prospect.custom_email_subject = final_subject
        prospect.custom_email_body = final_body

    # Determine edit_type
    edit_type = "none"
    if body.edited_subject or body.edited_body:
        original_subject = audit.generated_subject or ""
        original_body = audit.generated_body or ""
        edited_subject = body.edited_subject or original_subject
        edited_body = body.edited_body or original_body

        # Simple heuristic: minor if <30% changed, major if 30-70%, rewrite if >70%
        subject_changed = edited_subject != original_subject
        body_changed = edited_body != original_body
        if subject_changed and body_changed:
            edit_type = "major"
        elif subject_changed or body_changed:
            edit_type = "minor"

    # Create Experiment record
    experiment = Experiment(
        prospect_id=audit.prospect_id,
        campaign_id=audit.campaign_id,
        audit_id=audit.id,
        status="draft",
        issue_type=audit.issue_type,
        issue_detail=audit.issue_detail,
        secondary_issue=audit.secondary_issue,
        secondary_detail=audit.secondary_detail,
        confidence=audit.confidence,
        site_quality=audit.site_quality,
        pass_2_triggered=audit.pass_2_completed,
        subject=final_subject,
        body=final_body,
        word_count=audit.word_count,
        was_edited=audit.was_edited,
        edit_type=edit_type,
        subject_variant_used=body.subject_variant_used,
        niche=audit.detected_trade or (prospect.niche if prospect else None),
        city=audit.detected_city,
        company=prospect.agency_name if prospect else None,
    )
    db.add(experiment)
    db.commit()
    db.refresh(audit)

    # Build response with prospect info
    resp = AuditResultResponse.model_validate(audit, from_attributes=True)
    if prospect:
        resp.prospect_name = prospect.contact_name or prospect.agency_name
        resp.prospect_company = prospect.agency_name
        resp.prospect_niche = prospect.niche
        resp.prospect_email = prospect.email
        resp.prospect_website = prospect.website
    return resp


# ──────────────────────────────────────────────
# 7. PUT /audits/{audit_id}/reject
# ──────────────────────────────────────────────

@router.put("/audits/{audit_id}/reject", response_model=AuditResultResponse)
def reject_audit(
    audit_id: int,
    body: AuditRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject an audit result with a reason."""
    audit = db.query(AuditResult).filter(AuditResult.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit result not found")

    audit.status = "rejected"
    audit.rejection_reason = body.rejection_reason
    audit.rejection_category = body.rejection_category
    db.commit()
    db.refresh(audit)

    # Build response with prospect info
    prospect = (
        db.query(OutreachProspect)
        .filter(OutreachProspect.id == audit.prospect_id)
        .first()
    )
    resp = AuditResultResponse.model_validate(audit, from_attributes=True)
    if prospect:
        resp.prospect_name = prospect.contact_name or prospect.agency_name
        resp.prospect_company = prospect.agency_name
        resp.prospect_niche = prospect.niche
        resp.prospect_email = prospect.email
        resp.prospect_website = prospect.website
    return resp


# ──────────────────────────────────────────────
# 7b. PUT /audits/{audit_id}/feedback
# ──────────────────────────────────────────────

@router.put("/audits/{audit_id}/feedback")
def submit_audit_feedback(
    audit_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit correction/feedback for an audit without rejecting it."""
    audit = db.query(AuditResult).filter(AuditResult.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    feedback = request.get("feedback", "")
    if not feedback or not feedback.strip():
        raise HTTPException(status_code=400, detail="Feedback cannot be empty")

    # Store feedback in rejection_reason field, prefixed with [FEEDBACK]
    existing = audit.rejection_reason or ""
    if existing:
        audit.rejection_reason = existing + "\n[FEEDBACK] " + feedback.strip()
    else:
        audit.rejection_reason = "[FEEDBACK] " + feedback.strip()

    db.commit()
    return {"message": "Feedback submitted", "audit_id": audit_id}


# ──────────────────────────────────────────────
# 7b. DELETE /audits/{audit_id} — delete an audit
# ──────────────────────────────────────────────

@router.delete("/audits/{audit_id}")
def delete_audit(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an audit and its associated experiment."""
    audit = db.query(AuditResult).filter(AuditResult.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    # Delete associated experiment if exists
    db.query(Experiment).filter(Experiment.audit_id == audit_id).delete()
    db.delete(audit)
    db.commit()

    return {"message": "Audit deleted", "audit_id": audit_id}


# ──────────────────────────────────────────────
# 7c. POST /track-email — capture final email content at copy time
# ──────────────────────────────────────────────

@router.post("/track-email")
def track_email_content(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Capture the exact email content when copied from CopyEmailModal.
    Updates existing experiment or creates one if none exists.
    This ensures the learning engine sees the ACTUAL email sent, not just the template.
    """
    prospect_id = payload.get("prospect_id")
    step_number = payload.get("step_number", 1)
    subject = payload.get("subject")
    body = payload.get("body")
    was_edited = payload.get("was_edited", False)

    if not prospect_id:
        raise HTTPException(status_code=400, detail="prospect_id is required")

    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    # Find existing experiment for this prospect + step
    experiment = (
        db.query(Experiment)
        .filter(
            Experiment.prospect_id == prospect_id,
            Experiment.step_number == step_number,
        )
        .first()
    )

    if experiment:
        # Update with the actual content that was copied
        experiment.subject = subject
        experiment.body = body
        experiment.word_count = len((body or "").split()) if body else None
        experiment.was_edited = was_edited
        if was_edited:
            experiment.edit_type = "minor_tweak"
    else:
        # Create new experiment for this step
        audit = (
            db.query(AuditResult)
            .filter(AuditResult.prospect_id == prospect_id)
            .order_by(AuditResult.created_at.desc())
            .first()
        )

        experiment = Experiment(
            prospect_id=prospect_id,
            campaign_id=prospect.campaign_id,
            audit_id=audit.id if audit else None,
            status="draft",
            step_number=step_number,
            subject=subject,
            body=body,
            word_count=len((body or "").split()) if body else None,
            was_edited=was_edited,
            edit_type="minor_tweak" if was_edited else None,
            issue_type=audit.issue_type if audit else None,
            issue_detail=audit.issue_detail if audit else None,
            niche=prospect.niche,
            company=prospect.agency_name,
        )
        db.add(experiment)

    db.commit()

    return {"message": "Email content tracked", "experiment_id": experiment.id}


# ──────────────────────────────────────────────
# 8. GET /settings — get or create settings
# ──────────────────────────────────────────────

@router.get("/settings", response_model=AutoresearchSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get or create default autoresearch settings for the current user."""
    settings = (
        db.query(AutoresearchSettings)
        .filter(AutoresearchSettings.user_id == current_user.id)
        .first()
    )
    if not settings:
        settings = AutoresearchSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Gmail connection status
    gmail_token = (
        db.query(GmailToken)
        .filter(GmailToken.user_id == current_user.id, GmailToken.is_active == True)
        .first()
    )

    # Monthly cost — sum of ai_cost_estimate for audits this month
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_cost = (
        db.query(func.coalesce(func.sum(AuditResult.ai_cost_estimate), 0.0))
        .filter(AuditResult.created_at >= first_of_month)
        .scalar()
    ) or 0.0

    # Total audits this month
    total_audits = (
        db.query(func.count(AuditResult.id))
        .filter(AuditResult.created_at >= first_of_month)
        .scalar()
    ) or 0

    resp = AutoresearchSettingsResponse.model_validate(settings, from_attributes=True)
    resp.gmail_connected = gmail_token is not None
    resp.gmail_email = gmail_token.email_address if gmail_token else None
    resp.monthly_cost = round(float(monthly_cost), 4)
    resp.total_audits = total_audits
    return resp


# ──────────────────────────────────────────────
# 9. PUT /settings — update settings
# ──────────────────────────────────────────────

@router.put("/settings", response_model=AutoresearchSettingsResponse)
def update_settings(
    body: AutoresearchSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update autoresearch settings for the current user."""
    settings = (
        db.query(AutoresearchSettings)
        .filter(AutoresearchSettings.user_id == current_user.id)
        .first()
    )
    if not settings:
        settings = AutoresearchSettings(user_id=current_user.id)
        db.add(settings)
        db.flush()

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)

    # Reuse the GET logic for computed fields
    gmail_token = (
        db.query(GmailToken)
        .filter(GmailToken.user_id == current_user.id, GmailToken.is_active == True)
        .first()
    )
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_cost = (
        db.query(func.coalesce(func.sum(AuditResult.ai_cost_estimate), 0.0))
        .filter(AuditResult.created_at >= first_of_month)
        .scalar()
    ) or 0.0
    total_audits = (
        db.query(func.count(AuditResult.id))
        .filter(AuditResult.created_at >= first_of_month)
        .scalar()
    ) or 0

    resp = AutoresearchSettingsResponse.model_validate(settings, from_attributes=True)
    resp.gmail_connected = gmail_token is not None
    resp.gmail_email = gmail_token.email_address if gmail_token else None
    resp.monthly_cost = round(float(monthly_cost), 4)
    resp.total_audits = total_audits
    return resp


# ──────────────────────────────────────────────
# 10. GET /experiments — list experiments with filters
# ──────────────────────────────────────────────

@router.get("/experiments", response_model=ExperimentListResponse)
def list_experiments(
    campaign_id: Optional[int] = Query(None),
    niche: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List experiments with optional filters and pagination."""
    query = db.query(Experiment)

    if campaign_id is not None:
        query = query.filter(Experiment.campaign_id == campaign_id)
    if niche is not None:
        query = query.filter(Experiment.niche == niche)
    if issue_type is not None:
        query = query.filter(Experiment.issue_type == issue_type)
    if status is not None:
        query = query.filter(Experiment.status == status)

    total_count = query.count()

    offset = (page - 1) * page_size
    experiments = (
        query.order_by(Experiment.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return ExperimentListResponse(
        experiments=[
            ExperimentResponse.model_validate(exp, from_attributes=True)
            for exp in experiments
        ],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


# ──────────────────────────────────────────────
# 11. GET /analytics/overview — aggregate stats
# ──────────────────────────────────────────────

@router.get("/analytics/overview", response_model=AnalyticsOverview)
def analytics_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return aggregate experiment statistics."""
    total_experiments = db.query(func.count(Experiment.id)).scalar() or 0
    total_sent = (
        db.query(func.count(Experiment.id))
        .filter(Experiment.status != "draft")
        .scalar()
    ) or 0
    total_replied = (
        db.query(func.count(Experiment.id))
        .filter(Experiment.replied == True)
        .scalar()
    ) or 0

    overall_reply_rate = (total_replied / total_sent) if total_sent > 0 else 0.0

    # Best issue_type (min 5 samples)
    issue_type_stats = (
        db.query(
            Experiment.issue_type,
            func.count(Experiment.id).label("sent"),
            func.sum(case((Experiment.replied == True, 1), else_=0)).label("replied"),
        )
        .filter(
            Experiment.status != "draft",
            Experiment.issue_type.isnot(None),
        )
        .group_by(Experiment.issue_type)
        .all()
    )
    best_issue_type = None
    best_issue_rate = -1.0
    for it, sent, replied in issue_type_stats:
        if sent >= 5:
            rate = (replied or 0) / sent
            if rate > best_issue_rate:
                best_issue_rate = rate
                best_issue_type = it

    # Best niche (min 5 samples)
    niche_stats = (
        db.query(
            Experiment.niche,
            func.count(Experiment.id).label("sent"),
            func.sum(case((Experiment.replied == True, 1), else_=0)).label("replied"),
        )
        .filter(
            Experiment.status != "draft",
            Experiment.niche.isnot(None),
        )
        .group_by(Experiment.niche)
        .all()
    )
    best_niche = None
    best_niche_rate = -1.0
    for n, sent, replied in niche_stats:
        if sent >= 5:
            rate = (replied or 0) / sent
            if rate > best_niche_rate:
                best_niche_rate = rate
                best_niche = n

    # Average response time
    avg_response_time = (
        db.query(func.avg(Experiment.response_time_minutes))
        .filter(Experiment.response_time_minutes.isnot(None))
        .scalar()
    )
    avg_response_time_minutes = round(float(avg_response_time), 1) if avg_response_time is not None else None

    # Total AI cost from AuditResult
    total_ai_cost = (
        db.query(func.coalesce(func.sum(AuditResult.ai_cost_estimate), 0.0)).scalar()
    ) or 0.0

    return AnalyticsOverview(
        total_experiments=total_experiments,
        total_sent=total_sent,
        total_replied=total_replied,
        overall_reply_rate=round(overall_reply_rate, 4),
        best_issue_type=best_issue_type,
        best_niche=best_niche,
        avg_response_time_minutes=avg_response_time_minutes,
        total_ai_cost=round(float(total_ai_cost), 4),
    )


# ──────────────────────────────────────────────
# 12. GET /analytics/by-issue-type — group by issue_type
# ──────────────────────────────────────────────

@router.get("/analytics/by-issue-type", response_model=list[IssueTypeStats])
def analytics_by_issue_type(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return experiment stats grouped by issue type."""
    results = (
        db.query(
            Experiment.issue_type,
            func.count(Experiment.id).label("sent"),
            func.sum(case((Experiment.replied == True, 1), else_=0)).label("replied"),
        )
        .filter(
            Experiment.status != "draft",
            Experiment.issue_type.isnot(None),
        )
        .group_by(Experiment.issue_type)
        .all()
    )

    stats = []
    for issue_type, sent, replied in results:
        replied_count = replied or 0
        reply_rate = replied_count / sent if sent > 0 else 0.0
        if sent >= 50:
            confidence = "high"
        elif sent >= 20:
            confidence = "medium"
        else:
            confidence = "low"
        stats.append(
            IssueTypeStats(
                issue_type=issue_type,
                sent=sent,
                replied=replied_count,
                reply_rate=round(reply_rate, 4),
                confidence=confidence,
            )
        )

    stats.sort(key=lambda s: s.reply_rate, reverse=True)
    return stats


# ──────────────────────────────────────────────
# 13. GET /analytics/by-niche — group by niche
# ──────────────────────────────────────────────

@router.get("/analytics/by-niche", response_model=list[NicheStats])
def analytics_by_niche(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return experiment stats grouped by niche."""
    results = (
        db.query(
            Experiment.niche,
            func.count(Experiment.id).label("sent"),
            func.sum(case((Experiment.replied == True, 1), else_=0)).label("replied"),
        )
        .filter(
            Experiment.status != "draft",
            Experiment.niche.isnot(None),
        )
        .group_by(Experiment.niche)
        .all()
    )

    stats = []
    for niche, sent, replied in results:
        replied_count = replied or 0
        reply_rate = replied_count / sent if sent > 0 else 0.0

        # Best issue_type per niche (sub-query)
        best_issue = (
            db.query(
                Experiment.issue_type,
                func.sum(case((Experiment.replied == True, 1), else_=0)).label("r"),
            )
            .filter(
                Experiment.status != "draft",
                Experiment.niche == niche,
                Experiment.issue_type.isnot(None),
            )
            .group_by(Experiment.issue_type)
            .order_by(
                (func.sum(case((Experiment.replied == True, 1), else_=0))
                 * 1.0
                 / func.count(Experiment.id)).desc()
            )
            .first()
        )

        stats.append(
            NicheStats(
                niche=niche,
                sent=sent,
                replied=replied_count,
                reply_rate=round(reply_rate, 4),
                best_issue_type=best_issue[0] if best_issue else None,
            )
        )

    stats.sort(key=lambda s: s.reply_rate, reverse=True)
    return stats


# ──────────────────────────────────────────────
# 14. GET /analytics/by-timing — group by day_of_week
# ──────────────────────────────────────────────

@router.get("/analytics/by-timing", response_model=list[TimingStats])
def analytics_by_timing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return experiment stats grouped by day of week."""
    results = (
        db.query(
            Experiment.day_of_week,
            func.count(Experiment.id).label("sent"),
            func.sum(case((Experiment.replied == True, 1), else_=0)).label("replied"),
        )
        .filter(
            Experiment.status != "draft",
            Experiment.day_of_week.isnot(None),
        )
        .group_by(Experiment.day_of_week)
        .all()
    )

    stats = []
    for day_of_week, sent, replied in results:
        replied_count = replied or 0
        reply_rate = replied_count / sent if sent > 0 else 0.0
        stats.append(
            TimingStats(
                day_of_week=day_of_week,
                sent=sent,
                replied=replied_count,
                reply_rate=round(reply_rate, 4),
            )
        )

    return stats


# ──────────────────────────────────────────────
# 15. GET /analytics/trends — performance over time
# ──────────────────────────────────────────────

@router.get("/analytics/trends")
def analytics_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return experiment performance grouped by week."""
    results = (
        db.query(
            func.strftime("%Y-%W", Experiment.sent_at).label("week"),
            func.count(Experiment.id).label("sent"),
            func.sum(case((Experiment.replied == True, 1), else_=0)).label("replied"),
        )
        .filter(
            Experiment.status != "draft",
            Experiment.sent_at.isnot(None),
        )
        .group_by(func.strftime("%Y-%W", Experiment.sent_at))
        .order_by(func.strftime("%Y-%W", Experiment.sent_at))
        .all()
    )

    trends = []
    for week, sent, replied in results:
        replied_count = replied or 0
        reply_rate = replied_count / sent if sent > 0 else 0.0
        trends.append({
            "week": week,
            "sent": sent,
            "replied": replied_count,
            "reply_rate": round(reply_rate, 4),
        })

    return trends


# ──────────────────────────────────────────────
# 16. POST /audits/{audit_id}/reaudit — re-audit a rejected prospect
# ──────────────────────────────────────────────

@router.post("/audits/{audit_id}/reaudit", response_model=AuditResultResponse)
async def reaudit_prospect(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-audit a rejected prospect with the previous rejection reason as context."""
    svc = _require_audit_service()

    # Get the rejected audit
    old_audit = db.query(AuditResult).filter(AuditResult.id == audit_id).first()
    if not old_audit:
        raise HTTPException(status_code=404, detail="Audit result not found")
    if old_audit.status != "rejected":
        raise HTTPException(
            status_code=400,
            detail="Only rejected audits can be re-audited.",
        )

    # Get the prospect
    prospect = (
        db.query(OutreachProspect)
        .filter(OutreachProspect.id == old_audit.prospect_id)
        .first()
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    if not prospect.website:
        raise HTTPException(
            status_code=400,
            detail="Prospect has no website URL — cannot re-audit.",
        )

    # Validate and normalise URL
    try:
        validated_url = validate_url(prospect.website)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Load user settings
    settings = (
        db.query(AutoresearchSettings)
        .filter(AutoresearchSettings.user_id == current_user.id)
        .first()
    )
    audit_prompt = (settings.audit_prompt if settings and settings.audit_prompt else DEFAULT_AUDIT_PROMPT)
    min_wait = (settings.min_page_load_wait if settings else 3)

    # Build context with previous rejection reason
    rejection_context = ""
    if old_audit.rejection_reason:
        rejection_context = f"\n\nPrevious audit was rejected: {old_audit.rejection_reason}"

    try:
        # Re-capture screenshots
        screenshots = await svc.capture_screenshots(validated_url, min_wait=min_wait)

        if screenshots.get("error") and not screenshots.get("desktop_screenshot"):
            raise HTTPException(
                status_code=502,
                detail=f"Screenshot capture failed: {screenshots['error']}",
            )

        # Re-analyse with Claude, passing rejection context
        analysis = await svc.analyze_with_claude(
            screenshots=screenshots,
            prospect_name=prospect.contact_name or prospect.agency_name,
            prospect_company=prospect.agency_name,
            prospect_niche=prospect.niche or "general",
            prospect_city="",
            audit_prompt=audit_prompt + rejection_context,
        )

        if analysis.get("error") and not analysis.get("issue_type"):
            raise HTTPException(
                status_code=502,
                detail=f"Claude analysis failed: {analysis['error']}",
            )

        # Persist new AuditResult
        meta = analysis.get("_meta", {})
        new_audit = AuditResult(
            prospect_id=prospect.id,
            campaign_id=old_audit.campaign_id,
            issue_type=analysis.get("issue_type"),
            issue_detail=analysis.get("issue_detail"),
            secondary_issue=analysis.get("secondary_issue"),
            secondary_detail=analysis.get("secondary_detail"),
            confidence=analysis.get("confidence", "medium"),
            site_quality=analysis.get("site_quality", "medium"),
            needs_verification=analysis.get("needs_verification", False),
            generated_subject=analysis.get("subject"),
            generated_subject_variant=analysis.get("subject_variant"),
            detected_city=analysis.get("detected_city"),
            detected_trade=analysis.get("detected_trade"),
            generated_body=analysis.get("body"),
            word_count=analysis.get("word_count"),
            desktop_screenshot=screenshots.get("desktop_screenshot"),
            mobile_screenshot=screenshots.get("mobile_screenshot"),
            status="pending_review",
            audit_duration_seconds=meta.get("duration_seconds"),
            model_used=meta.get("model"),
            tokens_used=(meta.get("input_tokens", 0) + meta.get("output_tokens", 0)),
            ai_cost_estimate=meta.get("cost_usd"),
        )
        db.add(new_audit)
        db.commit()
        db.refresh(new_audit)

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as exc:
        logger.error(
            "Unexpected error re-auditing prospect %d (%s): %s",
            prospect.id, validated_url, exc, exc_info=True,
        )
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Re-audit failed unexpectedly: {type(exc).__name__}: {exc}",
        )

    # Build response with prospect info
    resp = AuditResultResponse.model_validate(new_audit, from_attributes=True)
    resp.prospect_name = prospect.contact_name or prospect.agency_name
    resp.prospect_company = prospect.agency_name
    resp.prospect_niche = prospect.niche
    resp.prospect_email = prospect.email
    return resp


# ──────────────────────────────────────────────
# Email Open Tracking (Pixel)
# ──────────────────────────────────────────────

@router.get("/track/open/{tracking_id}")
async def track_email_open(
    tracking_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Track email open via invisible pixel. No auth required."""
    email_open = db.query(EmailOpen).filter(EmailOpen.tracking_id == tracking_id).first()
    if email_open:
        email_open.open_count = (email_open.open_count or 0) + 1
        if not email_open.opened_at:
            email_open.opened_at = datetime.utcnow()
        email_open.user_agent = (request.headers.get("user-agent", "") or "")[:500]
        email_open.ip_address = request.client.host if request.client else None
        db.commit()

    return Response(
        content=TRANSPARENT_PIXEL,
        media_type="image/png",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"},
    )


@router.post("/track/generate/{prospect_id}", response_model=TrackingPixelResponse)
async def generate_tracking_pixel(
    prospect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a unique tracking pixel URL for a prospect's email."""
    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    tracking_id = uuid.uuid4().hex

    # Find latest experiment for this prospect
    experiment = (
        db.query(Experiment)
        .filter(Experiment.prospect_id == prospect_id)
        .order_by(Experiment.created_at.desc())
        .first()
    )

    email_open = EmailOpen(
        tracking_id=tracking_id,
        prospect_id=prospect_id,
        experiment_id=experiment.id if experiment else None,
    )
    db.add(email_open)
    db.commit()

    # Build the pixel URL
    base_url = os.getenv("RENDER_API_URL", os.getenv("API_BASE_URL", "https://vertex-api-smg3.onrender.com"))
    pixel_url = f"{base_url}/api/autoresearch/track/open/{tracking_id}"
    img_tag = f'<img src="{pixel_url}" width="1" height="1" style="display:none" />'

    return TrackingPixelResponse(
        tracking_id=tracking_id,
        pixel_url=pixel_url,
        img_tag=img_tag,
    )


# ──────────────────────────────────────────────
# Loom Video Tracking
# ──────────────────────────────────────────────

@router.put("/experiments/{experiment_id}/loom")
async def update_loom_status(
    experiment_id: int,
    payload: LoomStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update Loom video tracking status on an experiment."""
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if payload.loom_sent is not None:
        experiment.loom_sent = payload.loom_sent
    if payload.loom_url is not None:
        experiment.loom_url = payload.loom_url
    if payload.loom_watched is not None:
        experiment.loom_watched = payload.loom_watched

    db.commit()
    db.refresh(experiment)

    return {"message": "Loom status updated", "experiment_id": experiment_id}


# ──────────────────────────────────────────────
# Gmail helper
# ──────────────────────────────────────────────

def _require_gmail_service() -> "GmailService":
    """Raise 503 if the Gmail service is unavailable."""
    if gmail_service is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Gmail service unavailable — required environment variables are not configured. "
                "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_ENCRYPTION_KEY."
            ),
        )
    return gmail_service


# ──────────────────────────────────────────────
# 17. GET /gmail/auth-url — start OAuth flow
# ──────────────────────────────────────────────

@router.get("/gmail/auth-url")
def gmail_auth_url(
    current_user: User = Depends(get_current_user),
):
    """Generate a Google OAuth authorization URL for Gmail integration."""
    svc = _require_gmail_service()

    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/autoresearch/gmail/callback",
    )

    auth_url, state, code_verifier = svc.get_auth_url(redirect_uri)

    # Store state → (user_id, code_verifier) for CSRF validation + PKCE in the callback
    _oauth_states[state] = {"user_id": current_user.id, "code_verifier": code_verifier}

    return {"auth_url": auth_url}


# ──────────────────────────────────────────────
# 18. GET /gmail/callback — OAuth callback (no auth required)
# ──────────────────────────────────────────────

@router.get("/gmail/callback")
def gmail_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """Handle Google OAuth callback — exchange code for tokens and store them."""
    svc = _require_gmail_service()

    # Validate state (CSRF protection) and retrieve code_verifier (PKCE)
    state_data = _oauth_states.pop(state, None)
    if state_data is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OAuth state parameter.",
        )
    user_id = state_data["user_id"]
    code_verifier = state_data.get("code_verifier")

    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/autoresearch/gmail/callback",
    )

    try:
        result = svc.handle_callback(code, redirect_uri, code_verifier=code_verifier)
    except Exception as exc:
        logger.error("Gmail OAuth callback failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to complete Gmail OAuth: {exc}",
        )

    email_address = result["email"]
    refresh_token = result["refresh_token"]

    # Encrypt refresh token
    encrypted_token = svc.encrypt_token(refresh_token)

    # Upsert GmailToken for this user
    existing = (
        db.query(GmailToken)
        .filter(GmailToken.user_id == user_id)
        .first()
    )
    if existing:
        existing.email_address = email_address
        existing.encrypted_refresh_token = encrypted_token
        existing.is_active = True
    else:
        gmail_token = GmailToken(
            user_id=user_id,
            email_address=email_address,
            encrypted_refresh_token=encrypted_token,
            is_active=True,
        )
        db.add(gmail_token)

    db.commit()

    # Redirect to frontend settings page
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(
        url=f"{frontend_url}/autoresearch?tab=settings&gmail=connected"
    )


# ──────────────────────────────────────────────
# 19. GET /gmail/status — check connection status
# ──────────────────────────────────────────────

@router.get("/gmail/status")
def gmail_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check whether Gmail is connected for the current user."""
    token = (
        db.query(GmailToken)
        .filter(GmailToken.user_id == current_user.id)
        .first()
    )

    if not token:
        return {
            "is_connected": False,
            "email_address": None,
            "last_poll_at": None,
            "is_active": False,
        }

    return {
        "is_connected": True,
        "email_address": token.email_address,
        "last_poll_at": token.last_poll_at.isoformat() if token.last_poll_at else None,
        "is_active": token.is_active,
    }


# ──────────────────────────────────────────────
# 20. POST /gmail/poll — manually trigger inbox polling
# ──────────────────────────────────────────────

@router.post("/gmail/poll")
async def gmail_poll(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger Gmail inbox polling for the current user."""
    svc = _require_gmail_service()

    try:
        results = await svc.poll_inbox(db, current_user.id)
    except Exception as exc:
        logger.error("Gmail poll failed for user %d: %s", current_user.id, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Gmail polling failed: {exc}",
        )

    return {
        "message": "Inbox poll complete.",
        "new_replies": results.get("new_replies", 0),
        "new_sent_matches": results.get("new_sent_matches", 0),
        "errors": results.get("errors", []),
    }


# ──────────────────────────────────────────────
# 21. POST /gmail/disconnect — remove Gmail integration
# ──────────────────────────────────────────────

@router.post("/gmail/disconnect")
def gmail_disconnect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect Gmail by deleting the stored token for the current user."""
    token = (
        db.query(GmailToken)
        .filter(GmailToken.user_id == current_user.id)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="No Gmail connection found.")

    db.delete(token)
    db.commit()

    return {"message": "Gmail disconnected successfully."}


# ──────────────────────────────────────────────
# 21b. POST /send-email/{prospect_id} — send email via Gmail
# ──────────────────────────────────────────────

@router.post("/send-email/{prospect_id}")
async def send_email_to_prospect(
    prospect_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send an email to a prospect via the Gmail API with auto tracking pixel."""
    svc = _require_gmail_service()

    prospect = db.query(OutreachProspect).filter(OutreachProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    if not prospect.email:
        raise HTTPException(status_code=400, detail="Prospect has no email address")

    subject = payload.get("subject")
    body = payload.get("body")
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Subject and body are required")

    # Generate tracking pixel
    tracking_id = uuid.uuid4().hex

    experiment = (
        db.query(Experiment)
        .filter(Experiment.prospect_id == prospect_id)
        .order_by(Experiment.created_at.desc())
        .first()
    )

    email_open = EmailOpen(
        tracking_id=tracking_id,
        prospect_id=prospect_id,
        experiment_id=experiment.id if experiment else None,
    )
    db.add(email_open)

    base_url = os.getenv(
        "RENDER_API_URL",
        os.getenv("API_BASE_URL", "https://vertex-api-smg3.onrender.com"),
    )
    pixel_url = f"{base_url}/api/autoresearch/track/open/{tracking_id}"
    tracking_html = f'<img src="{pixel_url}" width="1" height="1" style="display:none" />'

    # Look up previous thread for this prospect (for follow-up threading)
    previous_experiment = (
        db.query(Experiment)
        .filter(
            Experiment.prospect_id == prospect_id,
            Experiment.gmail_thread_id.isnot(None),
        )
        .order_by(Experiment.sent_at.desc())
        .first()
    )
    thread_id = previous_experiment.gmail_thread_id if previous_experiment else None
    in_reply_to = previous_experiment.gmail_message_id_header if previous_experiment else None

    # Send the email (threaded if follow-up)
    try:
        result = await svc.send_email(
            db=db,
            user_id=current_user.id,
            to_email=prospect.email,
            subject=subject,
            body=body,
            tracking_pixel_html=tracking_html,
            thread_id=thread_id,
            in_reply_to=in_reply_to,
        )
    except Exception as exc:
        logger.error("Failed to send email to prospect %d: %s", prospect_id, exc)
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}")

    # Update experiment status + store thread info for future follow-ups
    if experiment:
        experiment.status = "sent"
        experiment.sent_at = datetime.utcnow()
        experiment.day_of_week = datetime.utcnow().strftime("%A")
        experiment.sent_hour = datetime.utcnow().hour
        experiment.gmail_thread_id = result.get("thread_id")
        experiment.gmail_message_id_header = result.get("gmail_message_id_header")

    # Update prospect status
    prospect.last_contacted_at = datetime.utcnow()
    if prospect.current_step == 1:
        prospect.status = ProspectStatus.IN_SEQUENCE

    db.commit()

    is_followup = thread_id is not None
    return {
        "message": f"{'Follow-up' if is_followup else 'Email'} sent successfully (same thread)" if is_followup else "Email sent successfully",
        "gmail_message_id": result.get("message_id"),
        "thread_id": result.get("thread_id"),
        "tracking_id": tracking_id,
        "to": prospect.email,
        "is_followup": is_followup,
    }


# ──────────────────────────────────────────────
# 21c. POST /generate-followup/{prospect_id} — AI follow-up email
# ──────────────────────────────────────────────

# Haiku pricing for follow-up generation
_HAIKU_INPUT_PRICE_PER_M = 0.25
_HAIKU_OUTPUT_PRICE_PER_M = 1.25


def _parse_followup_json(raw_text: str) -> dict:
    """Parse JSON from Claude's follow-up response, handling markdown fences."""
    text = raw_text.strip()
    fence = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)
    m = fence.search(text)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("Failed to parse follow-up JSON: %s", exc)
        return {"error": str(exc), "raw_response": raw_text[:500]}


@router.post("/generate-followup/{prospect_id}")
async def generate_followup_email(
    prospect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an AI-personalised follow-up email that references the original
    audit issue. Uses Claude Haiku for cost efficiency.

    Returns JSON with subject, body, word_count, step_number, and cost_usd.
    """
    svc = _require_audit_service()  # ensures ANTHROPIC_API_KEY is set

    # --- Fetch prospect ---
    prospect = (
        db.query(OutreachProspect)
        .filter(OutreachProspect.id == prospect_id)
        .first()
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    step_number = prospect.current_step or 1
    if step_number < 2:
        raise HTTPException(
            status_code=400,
            detail="Follow-ups are only generated for step 2 and above.",
        )

    # --- Find the step 1 experiment (original audit email) ---
    step1_experiment = (
        db.query(Experiment)
        .filter(
            Experiment.prospect_id == prospect_id,
            Experiment.step_number == 1,
        )
        .order_by(Experiment.created_at.desc())
        .first()
    )

    if not step1_experiment or not step1_experiment.subject:
        raise HTTPException(
            status_code=404,
            detail="No step 1 audit email found for this prospect. Fall back to template.",
        )

    original_subject = step1_experiment.subject or ""
    original_body = step1_experiment.body or ""
    issue_type = step1_experiment.issue_type or "unknown"
    issue_detail = step1_experiment.issue_detail or ""

    # --- Build follow-up angle guidance per step ---
    follow_up_number = step_number - 1
    angle_guidance = {
        1: 'Brief check-in. "Just making sure this landed in your inbox." Keep it under 30 words.',
        2: 'Offer the free Loom video walkthrough again, add gentle urgency. Keep it under 40 words.',
        3: 'New angle: mention what competitors are doing or what opportunities they are missing. Keep it under 45 words.',
        4: 'Final attempt. "Last one from me" tone. Make it easy to say yes or no. Keep it under 35 words.',
    }
    default_angle = 'Very short one-liner. "Still happy to help if you need it." Under 20 words.'
    angle = angle_guidance.get(follow_up_number, default_angle)

    # --- Build the prompt ---
    first_name = (prospect.contact_name or prospect.agency_name or "there").split()[0]

    prompt = f"""You are writing a follow-up cold email for Joji Shiotsuki, an Australian WordPress developer.

ORIGINAL EMAIL (Step 1):
Subject: {original_subject}
Body: {original_body}
Issue found: {issue_type} — {issue_detail}

This is follow-up #{follow_up_number}. The prospect has NOT replied to the previous emails.
The prospect's first name is "{first_name}".

FOLLOW-UP ANGLE FOR THIS STEP:
{angle}

RULES:
- Reference the original issue naturally, don't repeat the full explanation
- Under 50 words total
- Australian English, conversational
- No em dashes (—)
- Same sign-off style as original (e.g. "Cheers,\\nJoji")
- Subject MUST be exactly "Re: {original_subject}"
- Do NOT include a greeting like "Hi {first_name}," in the body — just start with the message content, the greeting is added automatically by the email system

Return ONLY valid JSON (no markdown fences):
{{"subject": "Re: {original_subject}", "body": "follow-up email body here", "word_count": N}}"""

    # --- Call Claude Haiku ---
    model = os.getenv("AUTORESEARCH_FOLLOWUP_MODEL", "claude-haiku-4-5")

    try:
        response = await svc.client.messages.create(
            model=model,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as api_err:
        logger.error("Follow-up generation failed: %s", api_err, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Claude API error: {api_err}",
        )

    # --- Parse response ---
    raw_text = ""
    for block in response.content:
        if hasattr(block, "text"):
            raw_text += block.text

    result = _parse_followup_json(raw_text)

    if "error" in result:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse follow-up: {result.get('error')}",
        )

    # --- Calculate cost ---
    input_tokens = getattr(response.usage, "input_tokens", 0)
    output_tokens = getattr(response.usage, "output_tokens", 0)
    cost_usd = (
        (input_tokens * _HAIKU_INPUT_PRICE_PER_M / 1_000_000)
        + (output_tokens * _HAIKU_OUTPUT_PRICE_PER_M / 1_000_000)
    )

    return {
        "subject": result.get("subject", f"Re: {original_subject}"),
        "body": result.get("body", ""),
        "word_count": result.get("word_count", len(result.get("body", "").split())),
        "step_number": step_number,
        "follow_up_number": follow_up_number,
        "model": model,
        "cost_usd": round(cost_usd, 6),
    }


# ──────────────────────────────────────────────
# 22. GET /insights — list active insights
# ──────────────────────────────────────────────

@router.get("/insights", response_model=list[InsightResponse])
def list_active_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active insights ordered by confidence priority then sample_size."""
    confidence_order = case(
        (Insight.confidence == "high", 1),
        (Insight.confidence == "medium", 2),
        (Insight.confidence == "low", 3),
        else_=4,
    )
    insights = (
        db.query(Insight)
        .filter(Insight.is_active.is_(True))
        .order_by(confidence_order, Insight.sample_size.desc())
        .all()
    )
    return [InsightResponse.model_validate(i, from_attributes=True) for i in insights]


# ──────────────────────────────────────────────
# 23. POST /insights/refresh — trigger insight re-analysis
# ──────────────────────────────────────────────

@router.post("/insights/refresh", response_model=list[InsightResponse])
async def refresh_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger insight re-analysis from experiment data."""
    try:
        from app.services.learning_service import LearningService
        learning_service = LearningService()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Learning service unavailable: {exc}",
        )

    new_insights = await learning_service.generate_insights(db)

    # Re-query from DB to get the persisted Insight records
    active = (
        db.query(Insight)
        .filter(Insight.is_active.is_(True))
        .order_by(Insight.created_at.desc())
        .all()
    )
    return [InsightResponse.model_validate(i, from_attributes=True) for i in active]


# ──────────────────────────────────────────────
# 24. GET /insights/history — all insights including superseded
# ──────────────────────────────────────────────

@router.get("/insights/history", response_model=list[InsightResponse])
def insights_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all insights including superseded ones, newest first."""
    insights = (
        db.query(Insight)
        .order_by(Insight.created_at.desc())
        .all()
    )
    return [InsightResponse.model_validate(i, from_attributes=True) for i in insights]


# ──────────────────────────────────────────────
# 25. GET /learning-context/{niche} — get learning context block
# ──────────────────────────────────────────────

@router.get("/learning-context/{niche}")
def get_learning_context(
    niche: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the learning context block for a specific niche."""
    try:
        from app.services.learning_service import LearningService
        learning_svc = LearningService()
        context = learning_svc.build_learning_context(db, niche)
    except Exception as exc:
        logger.warning("Could not build learning context: %s", exc)
        return {"context": None}

    return {"context": context}


# ──────────────────────────────────────────────
# Background batch audit function
# ──────────────────────────────────────────────

async def _run_batch_audit(
    batch_id: str,
    campaign_id: int,
    session_factory,
    user_id: int,
    max_count: int = 50,
) -> None:
    """
    Process all un-audited prospects in a campaign serially.

    Runs as a FastAPI BackgroundTask. Creates its own DB session
    from the factory to avoid sharing the request-scoped session.
    """
    svc = audit_service
    if svc is None:
        job = _batch_jobs.get(batch_id)
        if job:
            job["is_complete"] = True
        return

    db: Session = session_factory()
    try:
        # Load user settings
        settings = (
            db.query(AutoresearchSettings)
            .filter(AutoresearchSettings.user_id == user_id)
            .first()
        )
        audit_prompt = (settings.audit_prompt if settings and settings.audit_prompt else DEFAULT_AUDIT_PROMPT)
        min_wait = (settings.min_page_load_wait if settings else 3)

        # Init learning service for context injection
        _learning_svc = None
        try:
            from app.services.learning_service import LearningService
            _learning_svc = LearningService()
        except Exception as e:
            logger.warning("Batch %s: learning service unavailable: %s", batch_id, e)

        # Find un-audited prospects with websites
        already_audited_ids = (
            db.query(AuditResult.prospect_id)
            .filter(AuditResult.campaign_id == campaign_id)
            .subquery()
        )
        prospects = (
            db.query(OutreachProspect)
            .filter(
                OutreachProspect.campaign_id == campaign_id,
                OutreachProspect.website.isnot(None),
                OutreachProspect.website != "",
                ~OutreachProspect.id.in_(already_audited_ids),
            )
            .limit(max_count)
            .all()
        )

        job = _batch_jobs.get(batch_id)
        if not job:
            return

        for prospect in prospects:
            # Check cancellation
            if job.get("cancelled"):
                logger.info("Batch %s cancelled by user.", batch_id)
                break

            job["current_prospect"] = prospect.contact_name or prospect.agency_name

            try:
                # Validate URL before attempting capture
                try:
                    batch_validated_url = validate_url(prospect.website)
                except ValueError as url_err:
                    logger.warning(
                        "Batch %s: invalid URL for prospect %d (%s): %s",
                        batch_id, prospect.id, prospect.website, url_err,
                    )
                    job["errors"] += 1
                    job["completed"] += 1
                    continue

                # Pass 1: capture screenshots
                screenshots = await svc.capture_screenshots(
                    batch_validated_url, min_wait=min_wait
                )

                if screenshots.get("error") and not screenshots.get("desktop_screenshot"):
                    logger.warning(
                        "Batch %s: screenshot failed for prospect %d (%s): %s",
                        batch_id, prospect.id, prospect.website, screenshots["error"],
                    )
                    job["errors"] += 1
                    job["completed"] += 1
                    continue

                # Inject learning context per-prospect niche
                prospect_audit_prompt = audit_prompt
                if _learning_svc:
                    try:
                        lc = _learning_svc.build_learning_context(db, prospect.niche)
                        if lc:
                            prospect_audit_prompt = audit_prompt + "\n\n" + lc
                    except Exception as lc_err:
                        logger.warning(
                            "Batch %s: learning context failed for prospect %d: %s",
                            batch_id, prospect.id, lc_err,
                        )

                # Pass 1: analyse with Claude
                analysis = await svc.analyze_with_claude(
                    screenshots=screenshots,
                    prospect_name=prospect.contact_name or prospect.agency_name,
                    prospect_company=prospect.agency_name,
                    prospect_niche=prospect.niche or "general",
                    prospect_city="",
                    audit_prompt=prospect_audit_prompt,
                )

                if analysis.get("error") and not analysis.get("issue_type"):
                    logger.warning(
                        "Batch %s: analysis failed for prospect %d: %s",
                        batch_id, prospect.id, analysis["error"],
                    )
                    job["errors"] += 1
                    job["completed"] += 1
                    continue

                # Persist AuditResult
                meta = analysis.get("_meta", {})
                audit_result = AuditResult(
                    prospect_id=prospect.id,
                    campaign_id=prospect.campaign_id,
                    issue_type=analysis.get("issue_type"),
                    issue_detail=analysis.get("issue_detail"),
                    secondary_issue=analysis.get("secondary_issue"),
                    secondary_detail=analysis.get("secondary_detail"),
                    confidence=analysis.get("confidence", "medium"),
                    site_quality=analysis.get("site_quality", "medium"),
                    needs_verification=analysis.get("needs_verification", False),
                    generated_subject=analysis.get("subject"),
                    generated_subject_variant=analysis.get("subject_variant"),
            detected_city=analysis.get("detected_city"),
            detected_trade=analysis.get("detected_trade"),
                    generated_body=analysis.get("body"),
                    word_count=analysis.get("word_count"),
                    desktop_screenshot=screenshots.get("desktop_screenshot"),
                    mobile_screenshot=screenshots.get("mobile_screenshot"),
                    status="pending_review",
                    audit_duration_seconds=meta.get("duration_seconds"),
                    model_used=meta.get("model"),
                    tokens_used=(meta.get("input_tokens", 0) + meta.get("output_tokens", 0)),
                    ai_cost_estimate=meta.get("cost_usd"),
                )
                db.add(audit_result)
                db.commit()

            except Exception as exc:
                logger.error(
                    "Batch %s: unexpected error for prospect %d: %s",
                    batch_id, prospect.id, exc, exc_info=True,
                )
                db.rollback()
                job["errors"] += 1

            job["completed"] += 1

        job["is_complete"] = True
        job["_completed_at"] = time.monotonic()
        job["current_prospect"] = None
        logger.info(
            "Batch %s complete: %d/%d processed, %d errors.",
            batch_id, job["completed"], job["total"], job["errors"],
        )

    except Exception as exc:
        logger.error("Batch %s fatal error: %s", batch_id, exc, exc_info=True)
        job = _batch_jobs.get(batch_id)
        if job:
            job["is_complete"] = True
            job["_completed_at"] = time.monotonic()
    finally:
        db.close()
