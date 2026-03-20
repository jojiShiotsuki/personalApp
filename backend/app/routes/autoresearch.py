"""
Autoresearch API routes — audit and settings endpoints.

Provides:
- Single and batch prospect auditing (Playwright + Claude Vision)
- Audit listing, approval, and rejection
- Per-user autoresearch settings management
"""

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.database.connection import SessionLocal
from app.models.autoresearch import (
    AuditResult,
    AutoresearchSettings,
    Experiment,
    GmailToken,
    Insight,
)
from app.models.outreach import OutreachProspect
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
    NicheStats,
    TimingStats,
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
except Exception:
    logger.warning(
        "GmailService could not be initialised (GOOGLE_CLIENT_ID / "
        "GMAIL_ENCRYPTION_KEY may not be set). Gmail endpoints will return 503."
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
        # Pass 1: capture screenshots
        logger.info("Starting screenshot capture for %s", validated_url)
        screenshots = await svc.capture_screenshots(validated_url, min_wait=min_wait)
        logger.info(
            "Screenshot result: desktop=%s, mobile=%s, error=%s, duration=%s",
            bool(screenshots.get("desktop_screenshot")),
            bool(screenshots.get("mobile_screenshot")),
            screenshots.get("error"),
            screenshots.get("duration_seconds"),
        )

        if screenshots.get("error") and not screenshots.get("desktop_screenshot"):
            raise HTTPException(
                status_code=502,
                detail=f"Screenshot capture failed: {screenshots['error']}",
            )

        # Pass 1: analyse with Claude
        logger.info("Starting Claude analysis...")
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
    }


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
    query = query.order_by(AuditResult.created_at.desc())

    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()

    results = []
    for audit, contact_name, agency_name, niche, email in rows:
        resp = AuditResultResponse.model_validate(audit, from_attributes=True)
        resp.prospect_name = contact_name or agency_name
        resp.prospect_company = agency_name
        resp.prospect_niche = niche
        resp.prospect_email = email
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

    auth_url, state = svc.get_auth_url(redirect_uri)

    # Store state → user_id for CSRF validation in the callback
    _oauth_states[state] = current_user.id

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

    # Validate state (CSRF protection)
    user_id = _oauth_states.pop(state, None)
    if user_id is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OAuth state parameter.",
        )

    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/autoresearch/gmail/callback",
    )

    try:
        result = svc.handle_callback(code, redirect_uri)
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
