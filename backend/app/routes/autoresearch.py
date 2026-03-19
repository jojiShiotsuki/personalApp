"""
Autoresearch API routes — audit and settings endpoints.

Provides:
- Single and batch prospect auditing (Playwright + Claude Vision)
- Audit listing, approval, and rejection
- Per-user autoresearch settings management
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.database.connection import SessionLocal
from app.models.autoresearch import (
    AuditResult,
    AutoresearchSettings,
    Experiment,
    GmailToken,
)
from app.models.outreach import OutreachProspect
from app.models.user import User
from app.schemas.autoresearch import (
    AuditApproveRequest,
    AuditRejectRequest,
    AuditResultResponse,
    AutoresearchSettingsResponse,
    AutoresearchSettingsUpdate,
    BatchAuditResponse,
    BatchProgressResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/autoresearch", tags=["autoresearch"])

# ──────────────────────────────────────────────
# Audit service (module-level, lazy init)
# ──────────────────────────────────────────────

try:
    from app.services.audit_service import AuditService, DEFAULT_AUDIT_PROMPT
    audit_service = AuditService()
except Exception:
    logger.warning(
        "AuditService could not be initialised (ANTHROPIC_API_KEY may not be set). "
        "Audit endpoints will return 503."
    )
    audit_service = None  # type: ignore[assignment]
    from app.services.audit_service import DEFAULT_AUDIT_PROMPT

# ──────────────────────────────────────────────
# In-memory batch tracking
# ──────────────────────────────────────────────

_batch_jobs: dict[str, dict] = {}


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

@router.post("/audit/{prospect_id}", response_model=AuditResultResponse)
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

    # Load user settings (for audit_prompt, min_wait)
    settings = (
        db.query(AutoresearchSettings)
        .filter(AutoresearchSettings.user_id == current_user.id)
        .first()
    )
    audit_prompt = (settings.audit_prompt if settings and settings.audit_prompt else DEFAULT_AUDIT_PROMPT)
    min_wait = (settings.min_page_load_wait if settings else 3)

    # Pass 1: capture screenshots
    screenshots = await svc.capture_screenshots(prospect.website, min_wait=min_wait)

    if screenshots.get("error") and not screenshots.get("desktop_screenshot"):
        raise HTTPException(
            status_code=502,
            detail=f"Screenshot capture failed: {screenshots['error']}",
        )

    # Pass 1: analyse with Claude
    analysis = await svc.analyze_with_claude(
        screenshots=screenshots,
        prospect_name=prospect.contact_name or prospect.agency_name,
        prospect_company=prospect.agency_name,
        prospect_niche=prospect.niche or "general",
        prospect_city="",
        audit_prompt=audit_prompt,
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

    # Build response with joined prospect info
    response = AuditResultResponse.model_validate(audit_result, from_attributes=True)
    response.prospect_name = prospect.contact_name or prospect.agency_name
    response.prospect_company = prospect.agency_name
    response.prospect_niche = prospect.niche
    response.prospect_email = prospect.email
    return response


# ──────────────────────────────────────────────
# 2. POST /audit/batch/{campaign_id} — batch audit
# ──────────────────────────────────────────────

@router.post("/audit/batch/{campaign_id}", response_model=BatchAuditResponse)
async def start_batch_audit(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a batch audit for all un-audited prospects with websites in a campaign."""
    _require_audit_service()

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

    batch_id = str(uuid.uuid4())
    _batch_jobs[batch_id] = {
        "completed": 0,
        "total": total,
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
    )

    return BatchAuditResponse(
        batch_id=batch_id,
        total=total,
        message=f"Batch audit started for {total} prospects.",
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
# 5. GET /audits — list audits with filters
# ──────────────────────────────────────────────

@router.get("/audits", response_model=list[AuditResultResponse])
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
        )
        .join(OutreachProspect, AuditResult.prospect_id == OutreachProspect.id)
    )

    if campaign_id is not None:
        query = query.filter(AuditResult.campaign_id == campaign_id)
    if status is not None:
        query = query.filter(AuditResult.status == status)
    if confidence is not None:
        query = query.filter(AuditResult.confidence == confidence)

    query = query.order_by(AuditResult.created_at.desc())

    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()

    results: list[AuditResultResponse] = []
    for audit, contact_name, agency_name, niche, email in rows:
        resp = AuditResultResponse.model_validate(audit, from_attributes=True)
        resp.prospect_name = contact_name or agency_name
        resp.prospect_company = agency_name
        resp.prospect_niche = niche
        resp.prospect_email = email
        results.append(resp)

    return results


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
        niche=prospect.niche if prospect else None,
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
    return resp


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
# Background batch audit function
# ──────────────────────────────────────────────

async def _run_batch_audit(
    batch_id: str,
    campaign_id: int,
    session_factory,
    user_id: int,
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
                # Pass 1: capture screenshots
                screenshots = await svc.capture_screenshots(
                    prospect.website, min_wait=min_wait
                )

                if screenshots.get("error") and not screenshots.get("desktop_screenshot"):
                    logger.warning(
                        "Batch %s: screenshot failed for prospect %d (%s): %s",
                        batch_id, prospect.id, prospect.website, screenshots["error"],
                    )
                    job["errors"] += 1
                    job["completed"] += 1
                    continue

                # Pass 1: analyse with Claude
                analysis = await svc.analyze_with_claude(
                    screenshots=screenshots,
                    prospect_name=prospect.contact_name or prospect.agency_name,
                    prospect_company=prospect.agency_name,
                    prospect_niche=prospect.niche or "general",
                    prospect_city="",
                    audit_prompt=audit_prompt,
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
    finally:
        db.close()
