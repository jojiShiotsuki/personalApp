from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models.crm import Contact, Deal, Interaction, ContactStatus, DealStage, InteractionType
from app.schemas.crm import (
    ContactCreate, ContactUpdate, ContactResponse,
    DealCreate, DealUpdate, DealResponse,
    InteractionCreate, InteractionUpdate, InteractionResponse
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/api/crm", tags=["crm"])

# ===== CONTACT ROUTES =====

@router.get("/contacts", response_model=List[ContactResponse])
def get_contacts(
    status: Optional[ContactStatus] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all contacts with optional filtering"""
    query = db.query(Contact)

    if status:
        query = query.filter(Contact.status == status)
    if search:
        query = query.filter(
            (Contact.name.contains(search)) |
            (Contact.email.contains(search)) |
            (Contact.company.contains(search))
        )

    contacts = query.offset(skip).limit(limit).all()
    return contacts

@router.get("/contacts/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    """Get a single contact by ID"""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@router.post("/contacts", response_model=ContactResponse, status_code=201)
def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact"""
    db_contact = Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact

@router.put("/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing contact"""
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    update_data = contact_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_contact, field, value)

    db_contact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_contact)
    return db_contact

@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """Delete a contact"""
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(db_contact)
    db.commit()
    return None

# ===== DEAL ROUTES =====

@router.get("/deals", response_model=List[DealResponse])
def get_deals(
    stage: Optional[DealStage] = None,
    contact_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all deals with optional filtering"""
    from sqlalchemy import func

    # Subquery to count interactions per contact after deal creation
    interaction_count_subquery = (
        db.query(
            Deal.id.label('deal_id'),
            func.count(Interaction.id).label('followup_count')
        )
        .outerjoin(
            Interaction,
            (Interaction.contact_id == Deal.contact_id) &
            (Interaction.interaction_date >= Deal.created_at)
        )
        .group_by(Deal.id)
        .subquery()
    )

    # Main query with followup count
    query = (
        db.query(
            Deal,
            func.coalesce(interaction_count_subquery.c.followup_count, 0).label('followup_count')
        )
        .outerjoin(interaction_count_subquery, Deal.id == interaction_count_subquery.c.deal_id)
        .options(joinedload(Deal.contact))
    )

    if stage:
        query = query.filter(Deal.stage == stage)
    if contact_id:
        query = query.filter(Deal.contact_id == contact_id)

    results = query.offset(skip).limit(limit).all()

    # Attach followup_count to each deal object
    deals_with_count = []
    for deal, followup_count in results:
        deal.followup_count = followup_count
        deals_with_count.append(deal)

    return [DealResponse.model_validate(deal) for deal in deals_with_count]

@router.get("/deals/{deal_id}", response_model=DealResponse)
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    """Get a single deal by ID"""
    from sqlalchemy import func

    # Count interactions for this deal
    followup_count = (
        db.query(func.count(Interaction.id))
        .join(Deal, Deal.contact_id == Interaction.contact_id)
        .filter(Deal.id == deal_id)
        .filter(Interaction.interaction_date >= Deal.created_at)
        .scalar() or 0
    )

    deal = db.query(Deal).options(joinedload(Deal.contact)).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Attach followup_count to deal object
    deal.followup_count = followup_count
    # Explicitly validate to trigger model_validator
    return DealResponse.model_validate(deal)

@router.post("/deals", response_model=DealResponse, status_code=201)
def create_deal(deal: DealCreate, db: Session = Depends(get_db)):
    """Create a new deal"""
    # Verify contact exists
    contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db_deal = Deal(**deal.model_dump())
    
    # Auto-set next follow-up date to 3 days from now if not provided
    if db_deal.next_followup_date is None:
        db_deal.next_followup_date = (datetime.utcnow() + timedelta(days=3)).date()
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    # Load the contact relationship
    db.refresh(db_deal, attribute_names=['contact'])
    # Log activity
    log_activity(db, "deal_created", "deal", db_deal.id, {
        "value": db_deal.value,
        "stage": db_deal.stage,
        "contact_id": db_deal.contact_id
    })
    return DealResponse.model_validate(db_deal)

@router.put("/deals/{deal_id}", response_model=DealResponse)
def update_deal(deal_id: int, deal_update: DealUpdate, db: Session = Depends(get_db)):
    """Update an existing deal"""
    db_deal = db.query(Deal).options(joinedload(Deal.contact)).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    update_data = deal_update.model_dump(exclude_unset=True)

    # If stage changed to closed_won or closed_lost, set actual_close_date
    if "stage" in update_data:
        if update_data["stage"] in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
            if not db_deal.actual_close_date:
                update_data["actual_close_date"] = datetime.utcnow().date()

    for field, value in update_data.items():
        setattr(db_deal, field, value)

    db_deal.updated_at = datetime.utcnow()
    db.commit()
    # Log activity if deal closed
    if "stage" in update_data:
        new_stage = update_data["stage"]
        if new_stage in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
            log_activity(db, "deal_closed", "deal", deal_id, {
                "won": new_stage == DealStage.CLOSED_WON,
                "value": db_deal.value,
                "contact_id": db_deal.contact_id
            })
    db.refresh(db_deal)
    return DealResponse.model_validate(db_deal)

@router.patch("/deals/{deal_id}/stage", response_model=DealResponse)
def update_deal_stage(
    deal_id: int,
    stage: DealStage,
    db: Session = Depends(get_db)
):
    """Update only the stage of a deal (for drag-drop)"""
    db_deal = db.query(Deal).options(joinedload(Deal.contact)).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    db_deal.stage = stage

    # Set actual_close_date if closing
    if stage in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
        if not db_deal.actual_close_date:
            db_deal.actual_close_date = datetime.utcnow().date()

    db_deal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_deal)
    return DealResponse.model_validate(db_deal)

@router.post("/deals/bulk-delete", status_code=200)
def bulk_delete_deals(deal_ids: List[int], db: Session = Depends(get_db)):
    """Delete multiple deals by their IDs"""
    if not deal_ids:
        raise HTTPException(status_code=400, detail="No deal IDs provided")

    deals = db.query(Deal).filter(Deal.id.in_(deal_ids)).all()

    if not deals:
        raise HTTPException(status_code=404, detail="No deals found with the provided IDs")

    deleted_count = len(deals)

    for deal in deals:
        db.delete(deal)

    db.commit()

    return {"deleted_count": deleted_count, "message": f"Successfully deleted {deleted_count} deal(s)"}


@router.post("/deals/bulk-stage-update", status_code=200)
def bulk_update_deal_stage(
    deal_ids: List[int] = Query(..., description="List of deal IDs to update"),
    stage: DealStage = Query(..., description="New stage for the deals"),
    db: Session = Depends(get_db)
):
    """Update the stage of multiple deals"""
    if not deal_ids:
        raise HTTPException(status_code=400, detail="No deal IDs provided")

    deals = db.query(Deal).filter(Deal.id.in_(deal_ids)).all()

    if not deals:
        raise HTTPException(status_code=404, detail="No deals found with the provided IDs")

    updated_count = 0
    for deal in deals:
        deal.stage = stage
        # Set actual_close_date if closing
        if stage in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
            if not deal.actual_close_date:
                deal.actual_close_date = datetime.utcnow().date()
        deal.updated_at = datetime.utcnow()
        updated_count += 1

    db.commit()

    return {"updated_count": updated_count, "message": f"Successfully updated {updated_count} deal(s) to {stage.value}"}


@router.delete("/deals/{deal_id}", status_code=204)
def delete_deal(deal_id: int, db: Session = Depends(get_db)):
    """Delete a deal"""
    db_deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    db.delete(db_deal)
    db.commit()
    return None


# ===== INTERACTION ROUTES =====

@router.get("/interactions", response_model=List[InteractionResponse])
def get_interactions(
    contact_id: Optional[int] = None,
    type: Optional[InteractionType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all interactions with optional filtering"""
    query = db.query(Interaction)

    if contact_id:
        query = query.filter(Interaction.contact_id == contact_id)
    if type:
        query = query.filter(Interaction.type == type)

    interactions = query.order_by(Interaction.interaction_date.desc()).offset(skip).limit(limit).all()
    return interactions

@router.get("/interactions/{interaction_id}", response_model=InteractionResponse)
def get_interaction(interaction_id: int, db: Session = Depends(get_db)):
    """Get a single interaction by ID"""
    interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return interaction

@router.post("/interactions", response_model=InteractionResponse, status_code=201)
def create_interaction(interaction: InteractionCreate, db: Session = Depends(get_db)):
    """Create a new interaction"""
    # Verify contact exists
    contact = db.query(Contact).filter(Contact.id == interaction.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db_interaction = Interaction(**interaction.model_dump())
    db.add(db_interaction)
    db.commit()
    db.refresh(db_interaction)
    return db_interaction

@router.put("/interactions/{interaction_id}", response_model=InteractionResponse)
def update_interaction(
    interaction_id: int,
    interaction_update: InteractionUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing interaction"""
    db_interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
    if not db_interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    update_data = interaction_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_interaction, field, value)

    db.commit()
    db.refresh(db_interaction)
    return db_interaction

@router.delete("/interactions/{interaction_id}", status_code=204)
def delete_interaction(interaction_id: int, db: Session = Depends(get_db)):
    """Delete an interaction"""
    db_interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
    if not db_interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    db.delete(db_interaction)
    db.commit()
    return None

@router.patch("/deals/{deal_id}/snooze", response_model=DealResponse)
def snooze_deal(
    deal_id: int,
    db: Session = Depends(get_db)
):
    """Snooze deal follow-up by 3 days (set next_followup_date to today + 3)"""
    from sqlalchemy import func
    
    # Get deal with followup count
    followup_count = (
        db.query(func.count(Interaction.id))
        .join(Deal, Deal.contact_id == Interaction.contact_id)
        .filter(Deal.id == deal_id)
        .filter(Interaction.interaction_date >= Deal.created_at)
        .scalar() or 0
    )
    
    db_deal = db.query(Deal).options(joinedload(Deal.contact)).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Set next follow-up to 3 days from now
    # Add 3 days to existing next_followup_date, or set to today + 3 if not set
    if db_deal.next_followup_date:
        db_deal.next_followup_date = db_deal.next_followup_date + timedelta(days=3)
    else:
        db_deal.next_followup_date = (datetime.utcnow() + timedelta(days=3)).date()
    db_deal.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_deal)
    
    # Attach followup_count
    db_deal.followup_count = followup_count
    return db_deal

@router.patch("/deals/{deal_id}/unsnooze", response_model=DealResponse)
def unsnooze_deal(
    deal_id: int,
    db: Session = Depends(get_db)
):
    """Un-snooze deal follow-up by 3 days (subtract 3 days from next_followup_date)"""
    from sqlalchemy import func
    
    # Get deal with followup count
    followup_count = (
        db.query(func.count(Interaction.id))
        .join(Deal, Deal.contact_id == Interaction.contact_id)
        .filter(Deal.id == deal_id)
        .filter(Interaction.interaction_date >= Deal.created_at)
        .scalar() or 0
    )
    
    db_deal = db.query(Deal).options(joinedload(Deal.contact)).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Subtract 3 days from existing next_followup_date, or set to today if not set
    if db_deal.next_followup_date:
        db_deal.next_followup_date = db_deal.next_followup_date - timedelta(days=3)
    else:
        db_deal.next_followup_date = datetime.utcnow().date()
    db_deal.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_deal)
    
    # Attach followup_count
    db_deal.followup_count = followup_count
    return db_deal

