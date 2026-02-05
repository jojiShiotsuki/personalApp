from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, extract
from typing import Optional, List

from app.models.discovery_call import DiscoveryCall, CallOutcome
from app.models.crm import Contact, Deal
from app.schemas.discovery_call import (
    DiscoveryCallCreate,
    DiscoveryCallUpdate,
    DiscoveryCallResponse,
    DiscoveryCallStats,
    DiscoveryCallListResponse,
)


def create_discovery_call(db: Session, data: DiscoveryCallCreate) -> DiscoveryCall:
    """Create a new discovery call."""
    # Verify contact exists
    contact = db.query(Contact).filter(Contact.id == data.contact_id).first()
    if not contact:
        raise ValueError(f"Contact with id {data.contact_id} not found")

    # Verify deal exists if provided
    if data.deal_id:
        deal = db.query(Deal).filter(Deal.id == data.deal_id).first()
        if not deal:
            raise ValueError(f"Deal with id {data.deal_id} not found")

    call = DiscoveryCall(
        contact_id=data.contact_id,
        deal_id=data.deal_id,
        call_date=data.call_date,
        call_duration_minutes=data.call_duration_minutes,
        attendees=data.attendees,
        situation=data.situation,
        situation_questions=data.situation_questions,
        problem=data.problem,
        problem_questions=data.problem_questions,
        implication=data.implication,
        implication_questions=data.implication_questions,
        need_payoff=data.need_payoff,
        need_payoff_questions=data.need_payoff_questions,
        objections=data.objections,
        next_steps=data.next_steps,
        budget_discussed=data.budget_discussed,
        budget_range=data.budget_range,
        timeline_discussed=data.timeline_discussed,
        timeline=data.timeline,
        decision_maker_present=data.decision_maker_present,
        outcome=data.outcome,
        follow_up_date=data.follow_up_date,
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def get_discovery_call(db: Session, call_id: int) -> Optional[DiscoveryCall]:
    """Get a discovery call by ID."""
    return db.query(DiscoveryCall).filter(DiscoveryCall.id == call_id).first()


def get_all_discovery_calls(
    db: Session,
    contact_id: Optional[int] = None,
    deal_id: Optional[int] = None,
    outcome: Optional[CallOutcome] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[DiscoveryCall]:
    """Get all discovery calls with optional filters."""
    query = db.query(DiscoveryCall)

    if contact_id:
        query = query.filter(DiscoveryCall.contact_id == contact_id)

    if deal_id:
        query = query.filter(DiscoveryCall.deal_id == deal_id)

    if outcome:
        query = query.filter(DiscoveryCall.outcome == outcome)

    query = query.order_by(desc(DiscoveryCall.call_date))
    return query.offset(offset).limit(limit).all()


def update_discovery_call(db: Session, call_id: int, data: DiscoveryCallUpdate) -> DiscoveryCall:
    """Update a discovery call."""
    call = get_discovery_call(db, call_id)
    if not call:
        raise ValueError("Discovery call not found")

    # Verify deal exists if updating deal_id
    if data.deal_id is not None:
        deal = db.query(Deal).filter(Deal.id == data.deal_id).first()
        if not deal:
            raise ValueError(f"Deal with id {data.deal_id} not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(call, key, value)

    db.commit()
    db.refresh(call)
    return call


def delete_discovery_call(db: Session, call_id: int) -> bool:
    """Delete a discovery call."""
    call = get_discovery_call(db, call_id)
    if not call:
        raise ValueError("Discovery call not found")

    db.delete(call)
    db.commit()
    return True


def get_discovery_call_stats(db: Session) -> DiscoveryCallStats:
    """Get statistics for all discovery calls."""
    all_calls = db.query(DiscoveryCall).all()
    today = date.today()

    total_calls = len(all_calls)

    # Calls this month
    calls_this_month = sum(
        1 for c in all_calls
        if c.call_date.year == today.year and c.call_date.month == today.month
    )

    # Average SPIN completion
    if total_calls > 0:
        avg_spin = sum(c.spin_completion for c in all_calls) / total_calls
    else:
        avg_spin = 0

    # Outcome breakdown
    outcome_breakdown = {}
    for outcome in CallOutcome:
        count = sum(1 for c in all_calls if c.outcome == outcome)
        if count > 0:
            outcome_breakdown[outcome.value] = count

    # Average duration
    calls_with_duration = [c for c in all_calls if c.call_duration_minutes]
    avg_duration = None
    if calls_with_duration:
        avg_duration = sum(c.call_duration_minutes for c in calls_with_duration) / len(calls_with_duration)

    # Follow-ups scheduled (future follow-up dates)
    follow_ups_scheduled = sum(
        1 for c in all_calls
        if c.follow_up_date and c.follow_up_date >= today
    )

    # Proposals sent
    proposals_sent = sum(
        1 for c in all_calls
        if c.outcome == CallOutcome.SENT_PROPOSAL
    )

    # Deals closed
    deals_closed = sum(
        1 for c in all_calls
        if c.outcome == CallOutcome.CLOSED_DEAL
    )

    return DiscoveryCallStats(
        total_calls=total_calls,
        calls_this_month=calls_this_month,
        avg_spin_completion=round(avg_spin, 1),
        outcome_breakdown=outcome_breakdown,
        avg_duration_minutes=round(avg_duration, 1) if avg_duration else None,
        follow_ups_scheduled=follow_ups_scheduled,
        proposals_sent=proposals_sent,
        deals_closed=deals_closed,
    )


def build_discovery_call_response(call: DiscoveryCall) -> DiscoveryCallResponse:
    """Build a DiscoveryCallResponse with computed fields."""
    return DiscoveryCallResponse(
        id=call.id,
        contact_id=call.contact_id,
        deal_id=call.deal_id,
        call_date=call.call_date,
        call_duration_minutes=call.call_duration_minutes,
        attendees=call.attendees,
        situation=call.situation,
        situation_questions=call.situation_questions,
        problem=call.problem,
        problem_questions=call.problem_questions,
        implication=call.implication,
        implication_questions=call.implication_questions,
        need_payoff=call.need_payoff,
        need_payoff_questions=call.need_payoff_questions,
        objections=call.objections,
        next_steps=call.next_steps,
        budget_discussed=call.budget_discussed,
        budget_range=call.budget_range,
        timeline_discussed=call.timeline_discussed,
        timeline=call.timeline,
        decision_maker_present=call.decision_maker_present,
        outcome=call.outcome,
        follow_up_date=call.follow_up_date,
        created_at=call.created_at,
        updated_at=call.updated_at,
        spin_completion=call.spin_completion,
        contact_name=call.contact.name if call.contact else None,
        contact_company=call.contact.company if call.contact else None,
        deal_title=call.deal.title if call.deal else None,
    )


def get_discovery_calls_with_stats(
    db: Session,
    contact_id: Optional[int] = None,
    deal_id: Optional[int] = None,
    outcome: Optional[CallOutcome] = None,
    limit: int = 50,
) -> DiscoveryCallListResponse:
    """Get discovery calls with statistics."""
    calls = get_all_discovery_calls(
        db,
        contact_id=contact_id,
        deal_id=deal_id,
        outcome=outcome,
        limit=limit,
    )

    stats = get_discovery_call_stats(db)

    return DiscoveryCallListResponse(
        calls=[build_discovery_call_response(c) for c in calls],
        stats=stats,
    )


def get_upcoming_follow_ups(db: Session, days: int = 7) -> List[DiscoveryCall]:
    """Get discovery calls with follow-ups scheduled in the next N days."""
    today = date.today()
    from datetime import timedelta
    end_date = today + timedelta(days=days)

    return (
        db.query(DiscoveryCall)
        .filter(
            DiscoveryCall.follow_up_date >= today,
            DiscoveryCall.follow_up_date <= end_date,
        )
        .order_by(DiscoveryCall.follow_up_date)
        .all()
    )
