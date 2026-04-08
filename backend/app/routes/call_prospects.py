"""
Cold Calls pipeline routes — CRUD and CSV import for CallProspect.

Endpoints:
  GET    /api/cold-calls              list (optional status filter)
  POST   /api/cold-calls              create
  PUT    /api/cold-calls/{id}         update (stage, notes, fields)
  DELETE /api/cold-calls/{id}         delete
  POST   /api/cold-calls/import       bulk CSV import (Outscraper)
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.call_prospect import CallProspect, CallStatus
from app.schemas.call_prospect import (
    CallProspectCreate,
    CallProspectCsvImportRequest,
    CallProspectCsvImportResponse,
    CallProspectResponse,
    CallProspectUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cold-calls", tags=["cold-calls"])


VALID_STATUSES = {s.value for s in CallStatus}


@router.get("", response_model=List[CallProspectResponse])
def list_call_prospects(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all call prospects, optionally filtered by status."""
    query = db.query(CallProspect).order_by(CallProspect.updated_at.desc())
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        query = query.filter(CallProspect.status == status)
    return query.all()


@router.post("", response_model=CallProspectResponse, status_code=201)
def create_call_prospect(data: CallProspectCreate, db: Session = Depends(get_db)):
    """
    Create a single call prospect.

    Phone-based dedupe: if a prospect with the same normalized phone already
    exists, returns 409 Conflict so the frontend can render an inline error.
    Normalization matches the bulk import logic — strip + lowercase.
    """
    normalized_phone: Optional[str] = None
    if data.phone:
        normalized_phone = data.phone.strip()
        if normalized_phone:
            existing = (
                db.query(CallProspect.id)
                .filter(CallProspect.phone.isnot(None))
                .filter(sa_func.lower(CallProspect.phone) == normalized_phone.lower())
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail="Lead with this phone already exists",
                )

    prospect = CallProspect(
        business_name=data.business_name.strip(),
        phone=normalized_phone or None,
        vertical=data.vertical.strip() if data.vertical else None,
        address=data.address.strip() if data.address else None,
        facebook_url=data.facebook_url.strip() if data.facebook_url else None,
        website=data.website.strip() if data.website else None,
        source=data.source.strip() if data.source else None,
        notes=data.notes,
        status=data.status.value,
    )
    db.add(prospect)
    db.commit()
    db.refresh(prospect)
    return prospect


@router.put("/{prospect_id}", response_model=CallProspectResponse)
def update_call_prospect(
    prospect_id: int,
    data: CallProspectUpdate,
    db: Session = Depends(get_db),
):
    """Update a call prospect (used for drag-to-stage and notes editing)."""
    prospect = db.query(CallProspect).filter(CallProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Call prospect not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("business_name", "phone", "vertical", "address") and value:
            value = value.strip()
        if field == "status" and value is not None:
            # Pydantic gives us a CallStatus enum; store the string value.
            value = value.value if hasattr(value, "value") else value
        setattr(prospect, field, value)

    db.commit()
    db.refresh(prospect)
    return prospect


@router.delete("/{prospect_id}", status_code=204)
def delete_call_prospect(prospect_id: int, db: Session = Depends(get_db)):
    """Delete a call prospect."""
    prospect = db.query(CallProspect).filter(CallProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Call prospect not found")
    db.delete(prospect)
    db.commit()
    return None


@router.post("/import", response_model=CallProspectCsvImportResponse)
def import_call_prospects(
    data: CallProspectCsvImportRequest,
    db: Session = Depends(get_db),
):
    """
    Bulk import call prospects from CSV data (Outscraper output).

    All imported rows land in NEW status. Deduplication is by normalized phone
    number — rows with a phone already in the database are skipped silently.
    """
    mapping = data.column_mapping
    imported_count = 0
    skipped_count = 0
    errors: list[str] = []

    # Batch dedupe: load existing phones once
    existing_phones: set[str] = {
        (r[0] or "").strip().lower()
        for r in db.query(CallProspect.phone)
        .filter(CallProspect.phone.isnot(None))
        .all()
        if r[0]
    }

    CHUNK_SIZE = 200
    pending: list[CallProspect] = []

    for idx, row in enumerate(data.data, start=1):
        try:
            business_name = (row.get(mapping.business_name) or "").strip()
            if not business_name:
                skipped_count += 1
                errors.append(f"Row {idx}: missing business_name")
                continue

            phone = (row.get(mapping.phone) or "").strip() if mapping.phone else ""
            vertical = (row.get(mapping.vertical) or "").strip() if mapping.vertical else ""
            address = (row.get(mapping.address) or "").strip() if mapping.address else ""

            if phone:
                phone_key = phone.lower()
                if phone_key in existing_phones:
                    skipped_count += 1
                    continue
                existing_phones.add(phone_key)

            pending.append(
                CallProspect(
                    business_name=business_name,
                    phone=phone or None,
                    vertical=vertical or None,
                    address=address or None,
                    status=CallStatus.NEW.value,
                )
            )
            imported_count += 1

            if len(pending) >= CHUNK_SIZE:
                try:
                    db.bulk_save_objects(pending)
                    db.commit()
                except Exception as e:
                    logger.error("Bulk insert failed at row %d: %s", idx, e)
                    db.rollback()
                    raise
                pending.clear()
        except Exception as e:
            skipped_count += 1
            errors.append(f"Row {idx}: {str(e)}")

    if pending:
        try:
            db.bulk_save_objects(pending)
            db.commit()
        except Exception as e:
            logger.error("Final bulk insert failed: %s", e)
            db.rollback()
            raise

    return CallProspectCsvImportResponse(
        imported_count=imported_count,
        skipped_count=skipped_count,
        errors=errors[:50],
    )
