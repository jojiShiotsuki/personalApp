from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
from collections import defaultdict
from app.database import get_db
from app.models.social_content import SocialContent as SocialContentModel
from app.schemas.social_content import (
    SocialContent,
    SocialContentCreate,
    SocialContentUpdate,
)

router = APIRouter(prefix="/api/social-content", tags=["social-content"])


def get_iso_week_dates(year: int, week: int):
    """Get start and end date for an ISO week"""
    # January 4th is always in week 1
    jan4 = date(year, 1, 4)
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    target_monday = week1_monday + timedelta(weeks=week - 1)
    target_sunday = target_monday + timedelta(days=6)
    return target_monday, target_sunday


@router.get("/", response_model=List[SocialContent])
def list_content(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    content_type: Optional[str] = None,
    platform: Optional[str] = None,
    project_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """List all social content with optional filters"""
    query = db.query(SocialContentModel)

    # Apply filters
    if status:
        statuses = status.split(",")
        query = query.filter(SocialContentModel.status.in_(statuses))

    if content_type:
        types = content_type.split(",")
        query = query.filter(SocialContentModel.content_type.in_(types))

    if project_id:
        query = query.filter(SocialContentModel.project_id == project_id)

    if start_date:
        query = query.filter(SocialContentModel.content_date >= start_date)

    if end_date:
        query = query.filter(SocialContentModel.content_date <= end_date)

    # Platform filter requires JSON query
    if platform:
        query = query.filter(
            SocialContentModel.platforms.contains([platform])
        )

    query = query.order_by(SocialContentModel.content_date)
    return query.offset(skip).limit(limit).all()


@router.get("/{content_id}", response_model=SocialContent)
def get_content(content_id: int, db: Session = Depends(get_db)):
    """Get a single content item by ID"""
    content = db.query(SocialContentModel).filter(
        SocialContentModel.id == content_id
    ).first()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with id {content_id} not found",
        )

    return content


@router.post("/", response_model=SocialContent, status_code=status.HTTP_201_CREATED)
def create_content(
    content: SocialContentCreate,
    db: Session = Depends(get_db),
):
    """Create new social content item"""
    db_content = SocialContentModel(**content.model_dump())
    db.add(db_content)
    db.commit()
    db.refresh(db_content)
    return db_content


@router.put("/{content_id}", response_model=SocialContent)
def update_content(
    content_id: int,
    content: SocialContentUpdate,
    db: Session = Depends(get_db),
):
    """Update existing content item"""
    db_content = db.query(SocialContentModel).filter(
        SocialContentModel.id == content_id
    ).first()

    if not db_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with id {content_id} not found",
        )

    # Update only provided fields
    update_data = content.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_content, field, value)

    db.commit()
    db.refresh(db_content)
    return db_content


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(content_id: int, db: Session = Depends(get_db)):
    """Delete content item"""
    db_content = db.query(SocialContentModel).filter(
        SocialContentModel.id == content_id
    ).first()

    if not db_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with id {content_id} not found",
        )

    db.delete(db_content)
    db.commit()
    return None


@router.get("/by-date/{year}/{month}", response_model=List[SocialContent])
def get_month_content(year: int, month: int, db: Session = Depends(get_db)):
    """Get all content for a specific month"""
    start_date = date(year, month, 1)

    # Calculate last day of month
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    content = db.query(SocialContentModel).filter(
        SocialContentModel.content_date >= start_date,
        SocialContentModel.content_date <= end_date,
    ).order_by(SocialContentModel.content_date).all()

    return content


@router.get("/by-date/{year}/{month}/{week}", response_model=List[SocialContent])
def get_week_content(year: int, month: int, week: int, db: Session = Depends(get_db)):
    """Get all content for a specific ISO week"""
    start_date, end_date = get_iso_week_dates(year, week)

    content = db.query(SocialContentModel).filter(
        SocialContentModel.content_date >= start_date,
        SocialContentModel.content_date <= end_date,
    ).order_by(SocialContentModel.content_date).all()

    return content


@router.get("/calendar-summary/{year}")
def get_year_summary(year: int, db: Session = Depends(get_db)):
    """Get summary statistics for all months in a year"""
    from app.schemas.social_content import MonthSummary

    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    all_content = db.query(SocialContentModel).filter(
        SocialContentModel.content_date >= start_date,
        SocialContentModel.content_date <= end_date,
    ).all()

    # Group by month
    months_data = defaultdict(lambda: {
        "total": 0,
        "by_status": defaultdict(int),
        "by_type": defaultdict(int),
    })

    for content in all_content:
        month = content.content_date.month
        months_data[month]["total"] += 1
        months_data[month]["by_status"][content.status.value] += 1
        months_data[month]["by_type"][content.content_type.value] += 1

    # Convert to list of MonthSummary
    result = []
    for month in range(1, 13):
        data = months_data.get(month, {
            "total": 0,
            "by_status": {},
            "by_type": {},
        })
        result.append(MonthSummary(
            month=month,
            total_content=data["total"],
            by_status=dict(data["by_status"]),
            by_type=dict(data["by_type"]),
        ))

    return {"year": year, "months": result}
