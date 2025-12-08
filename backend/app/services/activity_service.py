# backend/app/services/activity_service.py
from sqlalchemy.orm import Session
from typing import Optional, Any
from datetime import datetime
from app.models.activity_log import ActivityLog


def log_activity(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    meta_data: Optional[dict[str, Any]] = None
) -> ActivityLog:
    """Log a user activity to the database."""
    activity = ActivityLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        meta_data=meta_data or {},
        created_at=datetime.utcnow()
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def get_recent_activities(
    db: Session,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100
) -> list[ActivityLog]:
    """Get recent activity logs with optional filtering."""
    query = db.query(ActivityLog).order_by(ActivityLog.created_at.desc())

    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    if action:
        query = query.filter(ActivityLog.action == action)

    return query.limit(limit).all()


def get_activity_counts(
    db: Session,
    entity_type: str,
    days: int = 30
) -> dict[str, int]:
    """Get counts of activities by action type for an entity type."""
    from datetime import timedelta
    from sqlalchemy import func

    since = datetime.utcnow() - timedelta(days=days)

    results = (
        db.query(ActivityLog.action, func.count(ActivityLog.id))
        .filter(ActivityLog.entity_type == entity_type)
        .filter(ActivityLog.created_at >= since)
        .group_by(ActivityLog.action)
        .all()
    )

    return {action: count for action, count in results}
