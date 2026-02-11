from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.database import get_db
from app.models.outreach import SearchPlannerCombination
from app.schemas.search_planner import (
    GenerateCombinationsRequest,
    GenerateCombinationsResponse,
    SearchPlannerCombinationResponse,
    SearchPlannerStatsResponse,
    MarkSearchedRequest,
)
from app.data.cities import get_countries, get_cities

router = APIRouter(prefix="/api/lead-discovery/planner", tags=["search-planner"])


@router.get("/countries")
def list_countries():
    return get_countries()


@router.get("/cities/{country}")
def list_cities(country: str):
    cities = get_cities(country)
    if not cities:
        raise HTTPException(status_code=404, detail=f"Country '{country}' not supported")
    return cities


@router.post("/generate", response_model=GenerateCombinationsResponse)
def generate_combinations(
    request: GenerateCombinationsRequest,
    db: Session = Depends(get_db),
):
    cities = get_cities(request.country)
    if not cities:
        raise HTTPException(status_code=404, detail=f"Country '{request.country}' not supported")

    created = 0
    already_existed = 0

    for city in cities:
        existing = db.query(SearchPlannerCombination).filter(
            SearchPlannerCombination.country == request.country,
            SearchPlannerCombination.city == city,
            SearchPlannerCombination.niche == request.niche,
        ).first()

        if existing:
            already_existed += 1
        else:
            db.add(SearchPlannerCombination(
                country=request.country,
                city=city,
                niche=request.niche,
            ))
            created += 1

    db.commit()

    total = db.query(SearchPlannerCombination).filter(
        SearchPlannerCombination.country == request.country,
        SearchPlannerCombination.niche == request.niche,
    ).count()

    return GenerateCombinationsResponse(
        created=created,
        already_existed=already_existed,
        total=total,
    )


@router.get("/niches")
def list_niches(
    country: str | None = None,
    db: Session = Depends(get_db),
):
    """Get all distinct niches that have been generated."""
    query = db.query(SearchPlannerCombination.niche).distinct()
    if country:
        query = query.filter(SearchPlannerCombination.country == country)
    return [row.niche for row in query.order_by(SearchPlannerCombination.niche).all()]


@router.get("/combinations", response_model=list[SearchPlannerCombinationResponse])
def get_combinations(
    country: str | None = None,
    niche: str | None = None,
    is_searched: bool | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(SearchPlannerCombination)

    if country:
        query = query.filter(SearchPlannerCombination.country == country)
    if niche:
        query = query.filter(SearchPlannerCombination.niche == niche)
    if is_searched is not None:
        query = query.filter(SearchPlannerCombination.is_searched == is_searched)

    return query.order_by(
        SearchPlannerCombination.is_searched.asc(),
        SearchPlannerCombination.city.asc(),
    ).all()


@router.get("/stats", response_model=SearchPlannerStatsResponse)
def get_planner_stats(
    country: str | None = None,
    niche: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(SearchPlannerCombination)
    if country:
        query = query.filter(SearchPlannerCombination.country == country)
    if niche:
        query = query.filter(SearchPlannerCombination.niche == niche)

    total = query.count()
    searched = query.filter(SearchPlannerCombination.is_searched == True).count()
    total_leads = query.with_entities(
        func.coalesce(func.sum(SearchPlannerCombination.leads_found), 0)
    ).scalar()

    return SearchPlannerStatsResponse(
        total=total,
        searched=searched,
        not_searched=total - searched,
        total_leads_found=total_leads or 0,
    )


@router.patch("/combinations/{combination_id}/mark-searched")
def mark_combination_searched(
    combination_id: int,
    data: MarkSearchedRequest,
    db: Session = Depends(get_db),
):
    combo = db.query(SearchPlannerCombination).filter(
        SearchPlannerCombination.id == combination_id
    ).first()
    if not combo:
        raise HTTPException(status_code=404, detail="Combination not found")

    combo.is_searched = True
    combo.searched_at = datetime.utcnow()
    combo.leads_found = data.leads_found
    db.commit()
    db.refresh(combo)
    return combo


@router.patch("/combinations/{combination_id}/reset")
def reset_combination(
    combination_id: int,
    db: Session = Depends(get_db),
):
    combo = db.query(SearchPlannerCombination).filter(
        SearchPlannerCombination.id == combination_id
    ).first()
    if not combo:
        raise HTTPException(status_code=404, detail="Combination not found")

    combo.is_searched = False
    combo.searched_at = None
    combo.leads_found = 0
    db.commit()
    db.refresh(combo)
    return combo


@router.delete("/combinations")
def delete_combinations(
    country: str,
    niche: str,
    db: Session = Depends(get_db),
):
    deleted = db.query(SearchPlannerCombination).filter(
        SearchPlannerCombination.country == country,
        SearchPlannerCombination.niche == niche,
    ).delete(synchronize_session='fetch')
    db.commit()
    return {"deleted": deleted}
