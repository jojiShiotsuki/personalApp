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
import re
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


def _parse_float(s: str) -> Optional[float]:
    """Extract the first float from a raw string. "4.9 stars" → 4.9, "" → None."""
    if not s:
        return None
    match = re.search(r"\d+(?:\.\d+)?", s)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _parse_int(s: str) -> Optional[int]:
    """Extract the first integer from a raw string. "(107)" → 107, "" → None."""
    if not s:
        return None
    match = re.search(r"\d+", s)
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


@router.get("", response_model=List[CallProspectResponse])
def list_call_prospects(
    status: Optional[str] = None,
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """List all call prospects, optionally filtered by status and/or campaign.

    campaign_id=0 is treated as "unassigned" — matches prospects with NULL
    campaign_id. Omit the param to see prospects across all campaigns.
    """
    query = db.query(CallProspect).order_by(CallProspect.updated_at.desc())
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        query = query.filter(CallProspect.status == status)
    if campaign_id is not None:
        if campaign_id == 0:
            query = query.filter(CallProspect.campaign_id.is_(None))
        else:
            query = query.filter(CallProspect.campaign_id == campaign_id)
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
        rating=data.rating,
        reviews_count=data.reviews_count,
        google_maps_url=data.google_maps_url.strip() if data.google_maps_url else None,
        working_hours=data.working_hours.strip() if data.working_hours else None,
        description=data.description,
        notes=data.notes,
        status=data.status.value,
        campaign_id=data.campaign_id,
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

    def _get(row: dict, header: Optional[str]) -> str:
        """Safe stripped lookup — returns empty string if header is None or missing.

        Strips a leading apostrophe (Apollo's Excel text-protection prefix on
        phone numbers, e.g. "'+61 499 153 849") since it serves no purpose in
        a database value and breaks tel: links.
        """
        if not header:
            return ""
        value = (row.get(header) or "").strip()
        if value.startswith("'"):
            value = value[1:].strip()
        return value

    def _build_notes(row: dict) -> Optional[str]:
        """
        Compose the final notes field:
        - Direct notes mapping value (if set) goes first
        - Then each notes_append_columns value, labeled as "ColumnName: value"
        - Joined with " | ". Empty values are skipped.
        """
        parts: list[str] = []
        direct = _get(row, mapping.notes)
        if direct:
            parts.append(direct)
        for col in mapping.notes_append_columns:
            val = _get(row, col)
            if val:
                parts.append(f"{col}: {val}")
        return " | ".join(parts) if parts else None

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
            business_name = _get(row, mapping.business_name)
            if not business_name:
                skipped_count += 1
                errors.append(f"Row {idx}: missing business_name")
                continue

            phone = _get(row, mapping.phone)
            first_name = _get(row, mapping.first_name)
            last_name = _get(row, mapping.last_name)
            position = _get(row, mapping.position)
            email = _get(row, mapping.email)
            linkedin_url = _get(row, mapping.linkedin_url)
            vertical = _get(row, mapping.vertical)
            address = _get(row, mapping.address)
            facebook_url = _get(row, mapping.facebook_url)
            website = _get(row, mapping.website)
            source = _get(row, mapping.source)
            rating = _parse_float(_get(row, mapping.rating))
            reviews_count = _parse_int(_get(row, mapping.reviews_count))
            google_maps_url = _get(row, mapping.google_maps_url)
            working_hours = _get(row, mapping.working_hours)
            description = _get(row, mapping.description)
            notes = _build_notes(row)

            if phone:
                phone_key = phone.lower()
                if phone_key in existing_phones:
                    skipped_count += 1
                    continue
                existing_phones.add(phone_key)

            pending.append(
                CallProspect(
                    business_name=business_name,
                    first_name=first_name or None,
                    last_name=last_name or None,
                    position=position or None,
                    email=email or None,
                    linkedin_url=linkedin_url or None,
                    phone=phone or None,
                    vertical=vertical or None,
                    address=address or None,
                    facebook_url=facebook_url or None,
                    website=website or None,
                    source=source or None,
                    rating=rating,
                    reviews_count=reviews_count,
                    google_maps_url=google_maps_url or None,
                    working_hours=working_hours or None,
                    description=description or None,
                    notes=notes,
                    status=CallStatus.NEW.value,
                    campaign_id=data.campaign_id,
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
