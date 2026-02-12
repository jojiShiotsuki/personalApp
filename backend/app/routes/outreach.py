from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

from app.database import get_db
from app.models.outreach import OutreachNiche, OutreachSituation, OutreachTemplate
from app.models.crm import Contact, Deal, ContactStatus, DealStage
from app.schemas.outreach import (
    NicheCreate, NicheResponse,
    SituationCreate, SituationResponse,
    TemplateCreate, TemplateUpdate, TemplateResponse,
    AddToPipelineRequest, AddToPipelineResponse,
)

router = APIRouter(prefix="/api/outreach", tags=["outreach"])


# ============== NICHES ==============

@router.get("/niches", response_model=List[NicheResponse])
def list_niches(db: Session = Depends(get_db)):
    return db.query(OutreachNiche).order_by(OutreachNiche.name).all()


@router.post("/niches", response_model=NicheResponse, status_code=201)
def create_niche(data: NicheCreate, db: Session = Depends(get_db)):
    niche = OutreachNiche(name=data.name.strip())
    try:
        db.add(niche)
        db.commit()
        db.refresh(niche)
        return niche
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Niche already exists")


@router.delete("/niches/{niche_id}", status_code=204)
def delete_niche(niche_id: int, db: Session = Depends(get_db)):
    niche = db.query(OutreachNiche).filter(OutreachNiche.id == niche_id).first()
    if not niche:
        raise HTTPException(status_code=404, detail="Niche not found")
    db.delete(niche)
    db.commit()


# ============== SITUATIONS ==============

@router.get("/situations", response_model=List[SituationResponse])
def list_situations(db: Session = Depends(get_db)):
    return db.query(OutreachSituation).order_by(OutreachSituation.name).all()


@router.post("/situations", response_model=SituationResponse, status_code=201)
def create_situation(data: SituationCreate, db: Session = Depends(get_db)):
    situation = OutreachSituation(name=data.name.strip())
    try:
        db.add(situation)
        db.commit()
        db.refresh(situation)
        return situation
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Situation already exists")


@router.put("/situations/{situation_id}", response_model=SituationResponse)
def update_situation(situation_id: int, data: SituationCreate, db: Session = Depends(get_db)):
    situation = db.query(OutreachSituation).filter(OutreachSituation.id == situation_id).first()
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")
    situation.name = data.name.strip()
    try:
        db.commit()
        db.refresh(situation)
        return situation
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Situation name already exists")


@router.delete("/situations/{situation_id}", status_code=204)
def delete_situation(situation_id: int, db: Session = Depends(get_db)):
    situation = db.query(OutreachSituation).filter(OutreachSituation.id == situation_id).first()
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")
    db.delete(situation)
    db.commit()


# ============== TEMPLATES ==============

@router.get("/templates", response_model=List[TemplateResponse])
def list_templates(
    niche_id: Optional[int] = None,
    situation_id: Optional[int] = None,
    template_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(OutreachTemplate)
    if niche_id is not None:
        query = query.filter(OutreachTemplate.niche_id == niche_id)
    if situation_id is not None:
        query = query.filter(OutreachTemplate.situation_id == situation_id)
    if template_type is not None:
        query = query.filter(OutreachTemplate.template_type == template_type)
    return query.all()


@router.post("/templates", response_model=TemplateResponse, status_code=201)
def create_or_update_template(data: TemplateCreate, db: Session = Depends(get_db)):
    # Check if template exists for this niche+situation+template_type combo
    # NULL niche_id requires is_(None) for proper SQL comparison
    niche_filter = (
        OutreachTemplate.niche_id.is_(None) if data.niche_id is None
        else OutreachTemplate.niche_id == data.niche_id
    )
    existing = db.query(OutreachTemplate).filter(
        niche_filter,
        OutreachTemplate.situation_id == data.situation_id,
        OutreachTemplate.template_type == data.template_type
    ).first()

    if existing:
        # Update existing
        existing.content = data.content
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        template = OutreachTemplate(
            niche_id=data.niche_id,
            situation_id=data.situation_id,
            template_type=data.template_type,
            content=data.content
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return template


@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(OutreachTemplate).filter(OutreachTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.content = data.content
    db.commit()
    db.refresh(template)
    return template


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(OutreachTemplate).filter(OutreachTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()


# ============== QUICK ACTIONS ==============

@router.post("/add-to-pipeline", response_model=AddToPipelineResponse)
def add_to_pipeline(data: AddToPipelineRequest, db: Session = Depends(get_db)):
    # Create contact
    contact = Contact(
        name=data.name.strip(),
        source="TikTok Outreach",
        notes=f"Niche: {data.niche}\nSituation: {data.situation}",
        status=ContactStatus.LEAD,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)

    # Create deal
    deal = Deal(
        contact_id=contact.id,
        title=f"{data.name} - {data.niche}",
        stage=DealStage.LEAD,
        probability=10,
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)

    return AddToPipelineResponse(
        contact_id=contact.id,
        deal_id=deal.id,
        message=f"Added {data.name} to pipeline"
    )
