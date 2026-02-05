from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.schemas.loom_audit import (
    LoomAuditCreate,
    LoomAuditUpdate,
    LoomAuditResponse,
    LoomAuditStats,
    LoomAuditListResponse,
    MarkWatchedRequest,
    MarkRespondedRequest,
    MarkFollowUpSentRequest,
)
from app.services import loom_audit_service

router = APIRouter(prefix="/api/loom-audits", tags=["loom-audits"])


@router.get("", response_model=LoomAuditListResponse)
def list_loom_audits(
    contact_id: Optional[int] = Query(None, description="Filter by contact ID"),
    pending_only: bool = Query(False, description="Show only pending audits"),
    needs_follow_up: bool = Query(False, description="Show only audits needing follow-up"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all Loom audits with optional filters and stats."""
    return loom_audit_service.get_loom_audits_with_stats(
        db,
        contact_id=contact_id,
        pending_only=pending_only,
        needs_follow_up=needs_follow_up,
        limit=limit,
    )


@router.get("/stats", response_model=LoomAuditStats)
def get_stats(db: Session = Depends(get_db)):
    """Get Loom audit statistics."""
    return loom_audit_service.get_loom_audit_stats(db)


@router.get("/pending", response_model=List[LoomAuditResponse])
def get_pending_audits(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get audits pending response."""
    audits = loom_audit_service.get_all_loom_audits(
        db, pending_only=True, limit=limit
    )
    return [loom_audit_service.build_loom_audit_response(a) for a in audits]


@router.get("/needs-follow-up", response_model=List[LoomAuditResponse])
def get_needs_follow_up(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get audits that need follow-up (3+ days, no response, no follow-up sent)."""
    audits = loom_audit_service.get_all_loom_audits(
        db, needs_follow_up=True, limit=limit
    )
    return [loom_audit_service.build_loom_audit_response(a) for a in audits]


@router.post("", response_model=LoomAuditResponse)
def create_loom_audit(data: LoomAuditCreate, db: Session = Depends(get_db)):
    """Create a new Loom audit."""
    try:
        audit = loom_audit_service.create_loom_audit(db, data)
        return loom_audit_service.build_loom_audit_response(audit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{audit_id}", response_model=LoomAuditResponse)
def get_loom_audit(audit_id: int, db: Session = Depends(get_db)):
    """Get a Loom audit by ID."""
    audit = loom_audit_service.get_loom_audit(db, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Loom audit not found")
    return loom_audit_service.build_loom_audit_response(audit)


@router.put("/{audit_id}", response_model=LoomAuditResponse)
def update_loom_audit(
    audit_id: int,
    data: LoomAuditUpdate,
    db: Session = Depends(get_db),
):
    """Update a Loom audit."""
    try:
        audit = loom_audit_service.update_loom_audit(db, audit_id, data)
        return loom_audit_service.build_loom_audit_response(audit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{audit_id}")
def delete_loom_audit(audit_id: int, db: Session = Depends(get_db)):
    """Delete a Loom audit."""
    try:
        loom_audit_service.delete_loom_audit(db, audit_id)
        return {"message": "Loom audit deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{audit_id}/watched", response_model=LoomAuditResponse)
def mark_watched(
    audit_id: int,
    data: MarkWatchedRequest = MarkWatchedRequest(),
    db: Session = Depends(get_db),
):
    """Mark a Loom audit as watched."""
    try:
        audit = loom_audit_service.mark_watched(db, audit_id, data)
        return loom_audit_service.build_loom_audit_response(audit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{audit_id}/responded", response_model=LoomAuditResponse)
def mark_responded(
    audit_id: int,
    data: MarkRespondedRequest,
    db: Session = Depends(get_db),
):
    """Mark a Loom audit as having received a response."""
    try:
        audit = loom_audit_service.mark_responded(db, audit_id, data)
        return loom_audit_service.build_loom_audit_response(audit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{audit_id}/follow-up-sent", response_model=LoomAuditResponse)
def mark_follow_up_sent(
    audit_id: int,
    data: MarkFollowUpSentRequest = MarkFollowUpSentRequest(),
    db: Session = Depends(get_db),
):
    """Mark follow-up as sent for a Loom audit."""
    try:
        audit = loom_audit_service.mark_follow_up_sent(db, audit_id, data.notes)
        return loom_audit_service.build_loom_audit_response(audit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/contact/{contact_id}", response_model=List[LoomAuditResponse])
def get_contact_audits(
    contact_id: int,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get all Loom audits for a specific contact."""
    audits = loom_audit_service.get_all_loom_audits(
        db, contact_id=contact_id, limit=limit
    )
    return [loom_audit_service.build_loom_audit_response(a) for a in audits]
