from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List

from app.models.loom_audit import LoomAudit, LoomResponseType
from app.models.crm import Contact
from app.schemas.loom_audit import (
    LoomAuditCreate,
    LoomAuditUpdate,
    LoomAuditResponse,
    LoomAuditStats,
    LoomAuditListResponse,
    MarkWatchedRequest,
    MarkRespondedRequest,
)


def create_loom_audit(db: Session, data: LoomAuditCreate) -> LoomAudit:
    """Create a new Loom audit."""
    # Verify contact exists
    contact = db.query(Contact).filter(Contact.id == data.contact_id).first()
    if not contact:
        raise ValueError(f"Contact with id {data.contact_id} not found")

    audit = LoomAudit(
        contact_id=data.contact_id,
        title=data.title,
        loom_url=data.loom_url,
        thumbnail_url=data.thumbnail_url,
        sent_date=data.sent_date or date.today(),
        sent_via=data.sent_via,
        notes=data.notes,
    )
    db.add(audit)

    # Update contact's loom_audit_sent flag
    contact.loom_audit_sent = True
    contact.loom_audit_url = data.loom_url

    db.commit()
    db.refresh(audit)
    return audit


def get_loom_audit(db: Session, audit_id: int) -> Optional[LoomAudit]:
    """Get a Loom audit by ID."""
    return db.query(LoomAudit).filter(LoomAudit.id == audit_id).first()


def get_all_loom_audits(
    db: Session,
    contact_id: Optional[int] = None,
    pending_only: bool = False,
    needs_follow_up: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> List[LoomAudit]:
    """Get all Loom audits with optional filters."""
    query = db.query(LoomAudit)

    if contact_id:
        query = query.filter(LoomAudit.contact_id == contact_id)

    if pending_only:
        query = query.filter(LoomAudit.response_received == False)

    if needs_follow_up:
        # 3+ days since sent, no response, no follow-up sent
        three_days_ago = date.today()
        query = query.filter(
            LoomAudit.response_received == False,
            LoomAudit.follow_up_sent == False,
            LoomAudit.sent_date <= three_days_ago,
        )

    query = query.order_by(desc(LoomAudit.sent_date))
    return query.offset(offset).limit(limit).all()


def update_loom_audit(db: Session, audit_id: int, data: LoomAuditUpdate) -> LoomAudit:
    """Update a Loom audit."""
    audit = get_loom_audit(db, audit_id)
    if not audit:
        raise ValueError("Loom audit not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(audit, key, value)

    db.commit()
    db.refresh(audit)
    return audit


def delete_loom_audit(db: Session, audit_id: int) -> bool:
    """Delete a Loom audit."""
    audit = get_loom_audit(db, audit_id)
    if not audit:
        raise ValueError("Loom audit not found")

    db.delete(audit)
    db.commit()
    return True


def mark_watched(db: Session, audit_id: int, data: MarkWatchedRequest) -> LoomAudit:
    """Mark a Loom audit as watched."""
    audit = get_loom_audit(db, audit_id)
    if not audit:
        raise ValueError("Loom audit not found")

    audit.watched = True
    audit.watched_date = data.watched_date or date.today()
    if data.watch_count is not None:
        audit.watch_count = data.watch_count
    else:
        audit.watch_count = (audit.watch_count or 0) + 1

    db.commit()
    db.refresh(audit)
    return audit


def mark_responded(db: Session, audit_id: int, data: MarkRespondedRequest) -> LoomAudit:
    """Mark a Loom audit as having received a response."""
    audit = get_loom_audit(db, audit_id)
    if not audit:
        raise ValueError("Loom audit not found")

    audit.response_received = True
    audit.response_date = data.response_date or date.today()
    audit.response_type = data.response_type

    if data.notes:
        existing_notes = audit.notes or ""
        audit.notes = f"{existing_notes}\n\nResponse: {data.notes}".strip()

    db.commit()
    db.refresh(audit)
    return audit


def mark_follow_up_sent(db: Session, audit_id: int, notes: Optional[str] = None) -> LoomAudit:
    """Mark follow-up as sent for a Loom audit."""
    audit = get_loom_audit(db, audit_id)
    if not audit:
        raise ValueError("Loom audit not found")

    audit.follow_up_sent = True
    audit.follow_up_date = date.today()

    if notes:
        existing_notes = audit.notes or ""
        audit.notes = f"{existing_notes}\n\nFollow-up: {notes}".strip()

    db.commit()
    db.refresh(audit)
    return audit


def get_loom_audit_stats(db: Session) -> LoomAuditStats:
    """Get statistics for all Loom audits."""
    all_audits = db.query(LoomAudit).all()

    total_sent = len(all_audits)
    total_watched = sum(1 for a in all_audits if a.watched)
    total_responded = sum(1 for a in all_audits if a.response_received)
    total_pending = sum(1 for a in all_audits if a.is_pending_response)
    total_needs_follow_up = sum(1 for a in all_audits if a.needs_follow_up)
    booked_calls = sum(
        1 for a in all_audits
        if a.response_type == LoomResponseType.BOOKED_CALL
    )

    watch_rate = (total_watched / total_sent * 100) if total_sent > 0 else 0
    response_rate = (total_responded / total_sent * 100) if total_sent > 0 else 0

    return LoomAuditStats(
        total_sent=total_sent,
        total_watched=total_watched,
        total_responded=total_responded,
        total_pending=total_pending,
        total_needs_follow_up=total_needs_follow_up,
        watch_rate=round(watch_rate, 1),
        response_rate=round(response_rate, 1),
        booked_calls=booked_calls,
    )


def build_loom_audit_response(audit: LoomAudit) -> LoomAuditResponse:
    """Build a LoomAuditResponse with computed fields."""
    return LoomAuditResponse(
        id=audit.id,
        contact_id=audit.contact_id,
        title=audit.title,
        loom_url=audit.loom_url,
        thumbnail_url=audit.thumbnail_url,
        sent_date=audit.sent_date,
        sent_via=audit.sent_via,
        watched=audit.watched,
        watched_date=audit.watched_date,
        watch_count=audit.watch_count or 0,
        response_received=audit.response_received,
        response_date=audit.response_date,
        response_type=audit.response_type,
        follow_up_date=audit.follow_up_date,
        follow_up_sent=audit.follow_up_sent,
        notes=audit.notes,
        created_at=audit.created_at,
        updated_at=audit.updated_at,
        days_since_sent=audit.days_since_sent,
        needs_follow_up=audit.needs_follow_up,
        contact_name=audit.contact.name if audit.contact else None,
        contact_company=audit.contact.company if audit.contact else None,
    )


def get_loom_audits_with_stats(
    db: Session,
    contact_id: Optional[int] = None,
    pending_only: bool = False,
    needs_follow_up: bool = False,
    limit: int = 50,
) -> LoomAuditListResponse:
    """Get Loom audits with statistics."""
    audits = get_all_loom_audits(
        db,
        contact_id=contact_id,
        pending_only=pending_only,
        needs_follow_up=needs_follow_up,
        limit=limit,
    )

    stats = get_loom_audit_stats(db)

    return LoomAuditListResponse(
        audits=[build_loom_audit_response(a) for a in audits],
        stats=stats,
    )
