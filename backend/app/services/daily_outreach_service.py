from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from app.models.daily_outreach import DailyOutreachLog, OutreachSettings
from app.models.crm import Interaction, InteractionType
from app.schemas.daily_outreach import (
    ActivityMetric,
    DailyOutreachStatsResponse,
    OutreachStreakResponse,
    DailySummaryItem,
    WeeklySummaryResponse,
    LogActivityResponse,
)


def get_or_create_settings(db: Session) -> OutreachSettings:
    """Get or create the global outreach settings."""
    settings = db.query(OutreachSettings).first()
    if not settings:
        settings = OutreachSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def get_or_create_today_log(db: Session) -> DailyOutreachLog:
    """Get or create today's outreach log entry."""
    today = date.today()
    log = db.query(DailyOutreachLog).filter(DailyOutreachLog.log_date == today).first()

    if not log:
        settings = get_or_create_settings(db)
        log = DailyOutreachLog(
            log_date=today,
            target_cold_emails=settings.daily_cold_email_target,
            target_linkedin=settings.daily_linkedin_target,
            target_calls=settings.daily_call_target,
            target_looms=settings.daily_loom_target,
        )
        db.add(log)
        db.commit()
        db.refresh(log)

    return log


def get_today_stats(db: Session) -> DailyOutreachStatsResponse:
    """Get today's outreach stats with progress metrics."""
    log = get_or_create_today_log(db)

    return DailyOutreachStatsResponse(
        date=log.log_date,
        cold_emails=ActivityMetric.from_values(log.cold_emails_sent, log.target_cold_emails),
        linkedin=ActivityMetric.from_values(log.linkedin_actions, log.target_linkedin),
        calls=ActivityMetric.from_values(log.follow_up_calls, log.target_calls),
        looms=ActivityMetric.from_values(log.loom_audits_sent, log.target_looms),
        all_targets_met=log.all_targets_met,
    )


def get_streak(db: Session) -> OutreachStreakResponse:
    """Calculate current streak and best streak of consecutive days meeting all targets."""
    logs = (
        db.query(DailyOutreachLog)
        .filter(DailyOutreachLog.all_targets_met == True)
        .order_by(desc(DailyOutreachLog.log_date))
        .all()
    )

    if not logs:
        return OutreachStreakResponse(current_streak=0, best_streak=0)

    # Calculate current streak (consecutive days from today/yesterday)
    current_streak = 0
    today = date.today()
    expected_date = today

    # Check if today's log exists and targets are met
    today_log = db.query(DailyOutreachLog).filter(DailyOutreachLog.log_date == today).first()
    if today_log and today_log.all_targets_met:
        current_streak = 1
        expected_date = today - timedelta(days=1)
    else:
        # If today is not complete, start from yesterday
        expected_date = today - timedelta(days=1)

    for log in logs:
        if log.log_date == today and today_log and today_log.all_targets_met:
            continue  # Already counted
        if log.log_date == expected_date:
            current_streak += 1
            expected_date -= timedelta(days=1)
        elif log.log_date < expected_date:
            break

    # Calculate best streak (need to look at all days)
    all_logs = (
        db.query(DailyOutreachLog)
        .order_by(DailyOutreachLog.log_date)
        .all()
    )

    best_streak = 0
    temp_streak = 0
    prev_date = None

    for log in all_logs:
        if log.all_targets_met:
            if prev_date is None or log.log_date == prev_date + timedelta(days=1):
                temp_streak += 1
            else:
                temp_streak = 1
            best_streak = max(best_streak, temp_streak)
            prev_date = log.log_date
        else:
            temp_streak = 0
            prev_date = None

    last_completed = logs[0].log_date if logs else None

    return OutreachStreakResponse(
        current_streak=current_streak,
        best_streak=max(best_streak, current_streak),
        last_completed_date=last_completed,
    )


def get_weekly_summary(db: Session) -> WeeklySummaryResponse:
    """Get last 7 days of outreach activity."""
    today = date.today()
    week_ago = today - timedelta(days=6)

    logs = (
        db.query(DailyOutreachLog)
        .filter(DailyOutreachLog.log_date >= week_ago)
        .filter(DailyOutreachLog.log_date <= today)
        .order_by(DailyOutreachLog.log_date)
        .all()
    )

    # Create a dict for quick lookup
    log_map = {log.log_date: log for log in logs}

    days = []
    total_cold_emails = 0
    total_linkedin = 0
    total_calls = 0
    total_looms = 0
    days_met_target = 0

    for i in range(7):
        d = week_ago + timedelta(days=i)
        log = log_map.get(d)

        item = DailySummaryItem(
            date=d,
            day_name=d.strftime("%a"),
            cold_emails=log.cold_emails_sent if log else 0,
            linkedin=log.linkedin_actions if log else 0,
            calls=log.follow_up_calls if log else 0,
            looms=log.loom_audits_sent if log else 0,
            targets_met=log.all_targets_met if log else False,
        )
        days.append(item)

        if log:
            total_cold_emails += log.cold_emails_sent
            total_linkedin += log.linkedin_actions
            total_calls += log.follow_up_calls
            total_looms += log.loom_audits_sent
            if log.all_targets_met:
                days_met_target += 1

    return WeeklySummaryResponse(
        days=days,
        total_cold_emails=total_cold_emails,
        total_linkedin=total_linkedin,
        total_calls=total_calls,
        total_looms=total_looms,
        days_met_target=days_met_target,
    )


def log_activity(
    db: Session,
    activity_type: str,
    contact_id: Optional[int] = None,
    notes: Optional[str] = None,
) -> LogActivityResponse:
    """Log an outreach activity and optionally create an interaction."""
    log = get_or_create_today_log(db)

    # Map activity type to log field and interaction type
    type_mapping = {
        "cold_email": ("cold_emails_sent", InteractionType.COLD_EMAIL),
        "linkedin": ("linkedin_actions", InteractionType.LINKEDIN_ACTION),
        "call": ("follow_up_calls", InteractionType.FOLLOW_UP_CALL),
        "loom": ("loom_audits_sent", InteractionType.LOOM_AUDIT),
    }

    if activity_type not in type_mapping:
        raise ValueError(f"Invalid activity type: {activity_type}")

    field_name, interaction_type = type_mapping[activity_type]
    target_mapping = {
        "cold_emails_sent": "target_cold_emails",
        "linkedin_actions": "target_linkedin",
        "follow_up_calls": "target_calls",
        "loom_audits_sent": "target_looms",
    }

    # Increment the count
    current_value = getattr(log, field_name, 0)
    setattr(log, field_name, current_value + 1)

    # Check if targets are met
    log.check_targets_met()

    interaction_id = None
    # Create interaction if contact is specified
    if contact_id:
        interaction = Interaction(
            contact_id=contact_id,
            type=interaction_type,
            subject=f"Daily {activity_type.replace('_', ' ').title()}",
            notes=notes,
            interaction_date=datetime.utcnow(),
        )
        db.add(interaction)
        db.flush()
        interaction_id = interaction.id

    db.commit()
    db.refresh(log)

    new_count = getattr(log, field_name)
    target = getattr(log, target_mapping[field_name])

    return LogActivityResponse(
        message=f"Logged {activity_type.replace('_', ' ')}",
        activity_type=activity_type,
        new_count=new_count,
        target=target,
        interaction_id=interaction_id,
    )


def deduct_activity(
    db: Session,
    activity_type: str,
) -> LogActivityResponse:
    """Deduct an outreach activity (undo a log)."""
    log = get_or_create_today_log(db)

    # Map activity type to log field
    type_mapping = {
        "cold_email": "cold_emails_sent",
        "linkedin": "linkedin_actions",
        "call": "follow_up_calls",
        "loom": "loom_audits_sent",
    }

    if activity_type not in type_mapping:
        raise ValueError(f"Invalid activity type: {activity_type}")

    field_name = type_mapping[activity_type]
    target_mapping = {
        "cold_emails_sent": "target_cold_emails",
        "linkedin_actions": "target_linkedin",
        "follow_up_calls": "target_calls",
        "loom_audits_sent": "target_looms",
    }

    # Decrement the count (minimum 0)
    current_value = getattr(log, field_name, 0)
    if current_value <= 0:
        raise ValueError(f"Cannot deduct: {activity_type.replace('_', ' ')} count is already 0")

    setattr(log, field_name, current_value - 1)

    # Recheck if targets are met
    log.check_targets_met()

    db.commit()
    db.refresh(log)

    new_count = getattr(log, field_name)
    target = getattr(log, target_mapping[field_name])

    return LogActivityResponse(
        message=f"Deducted {activity_type.replace('_', ' ')}",
        activity_type=activity_type,
        new_count=new_count,
        target=target,
        interaction_id=None,
    )


def update_settings(db: Session, **kwargs) -> OutreachSettings:
    """Update outreach settings."""
    settings = get_or_create_settings(db)

    for key, value in kwargs.items():
        if value is not None and hasattr(settings, key):
            setattr(settings, key, value)

    db.commit()
    db.refresh(settings)
    return settings
