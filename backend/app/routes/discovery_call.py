from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.discovery_call import CallOutcome
from app.schemas.discovery_call import (
    DiscoveryCallCreate,
    DiscoveryCallUpdate,
    DiscoveryCallResponse,
    DiscoveryCallStats,
    DiscoveryCallListResponse,
)
from app.services import discovery_call_service

router = APIRouter(prefix="/api/discovery-calls", tags=["discovery-calls"])


@router.get("", response_model=DiscoveryCallListResponse)
def list_discovery_calls(
    contact_id: Optional[int] = Query(None, description="Filter by contact ID"),
    deal_id: Optional[int] = Query(None, description="Filter by deal ID"),
    outcome: Optional[CallOutcome] = Query(None, description="Filter by outcome"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all discovery calls with optional filters and stats."""
    return discovery_call_service.get_discovery_calls_with_stats(
        db,
        contact_id=contact_id,
        deal_id=deal_id,
        outcome=outcome,
        limit=limit,
    )


@router.get("/stats", response_model=DiscoveryCallStats)
def get_stats(db: Session = Depends(get_db)):
    """Get discovery call statistics."""
    return discovery_call_service.get_discovery_call_stats(db)


@router.get("/upcoming-follow-ups", response_model=List[DiscoveryCallResponse])
def get_upcoming_follow_ups(
    days: int = Query(7, ge=1, le=30, description="Number of days to look ahead"),
    db: Session = Depends(get_db),
):
    """Get discovery calls with follow-ups scheduled in the next N days."""
    calls = discovery_call_service.get_upcoming_follow_ups(db, days=days)
    return [discovery_call_service.build_discovery_call_response(c) for c in calls]


@router.post("", response_model=DiscoveryCallResponse)
def create_discovery_call(data: DiscoveryCallCreate, db: Session = Depends(get_db)):
    """Create a new discovery call."""
    try:
        call = discovery_call_service.create_discovery_call(db, data)
        return discovery_call_service.build_discovery_call_response(call)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{call_id}", response_model=DiscoveryCallResponse)
def get_discovery_call(call_id: int, db: Session = Depends(get_db)):
    """Get a discovery call by ID."""
    call = discovery_call_service.get_discovery_call(db, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Discovery call not found")
    return discovery_call_service.build_discovery_call_response(call)


@router.put("/{call_id}", response_model=DiscoveryCallResponse)
def update_discovery_call(
    call_id: int,
    data: DiscoveryCallUpdate,
    db: Session = Depends(get_db),
):
    """Update a discovery call."""
    try:
        call = discovery_call_service.update_discovery_call(db, call_id, data)
        return discovery_call_service.build_discovery_call_response(call)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{call_id}")
def delete_discovery_call(call_id: int, db: Session = Depends(get_db)):
    """Delete a discovery call."""
    try:
        discovery_call_service.delete_discovery_call(db, call_id)
        return {"message": "Discovery call deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/contact/{contact_id}", response_model=List[DiscoveryCallResponse])
def get_contact_calls(
    contact_id: int,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get all discovery calls for a specific contact."""
    calls = discovery_call_service.get_all_discovery_calls(
        db, contact_id=contact_id, limit=limit
    )
    return [discovery_call_service.build_discovery_call_response(c) for c in calls]


@router.get("/deal/{deal_id}", response_model=List[DiscoveryCallResponse])
def get_deal_calls(
    deal_id: int,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get all discovery calls for a specific deal."""
    calls = discovery_call_service.get_all_discovery_calls(
        db, deal_id=deal_id, limit=limit
    )
    return [discovery_call_service.build_discovery_call_response(c) for c in calls]
