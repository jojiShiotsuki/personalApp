from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from app.database import get_db
from app.models.goal import Goal, Quarter, Month
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse, KeyResult

router = APIRouter(prefix="/api/goals", tags=["goals"])

@router.get("", response_model=List[GoalResponse])
def get_goals(
    quarter: Optional[Quarter] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all goals with optional filtering by quarter and year"""
    query = db.query(Goal)

    if quarter:
        query = query.filter(Goal.quarter == quarter)
    if year:
        query = query.filter(Goal.year == year)

    goals = query.order_by(Goal.year.desc(), Goal.quarter, Goal.month).all()

    # Parse key_results JSON string to list
    for goal in goals:
        if goal.key_results:
            try:
                parsed_results = json.loads(goal.key_results)
                goal.key_results = [KeyResult(**kr) for kr in parsed_results]
            except:
                goal.key_results = []
        else:
            goal.key_results = []

    return goals

@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    """Get a single goal by ID"""
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Parse key_results
    if goal.key_results:
        try:
            parsed_results = json.loads(goal.key_results)
            goal.key_results = [KeyResult(**kr) for kr in parsed_results]
        except:
            goal.key_results = []

    return goal

@router.post("", response_model=GoalResponse, status_code=201)
def create_goal(goal: GoalCreate, db: Session = Depends(get_db)):
    """Create a new goal"""
    goal_data = goal.model_dump()

    # Convert key_results list to JSON string
    if goal_data.get("key_results") is not None:
        goal_data["key_results"] = json.dumps([kr.model_dump() for kr in goal_data["key_results"]])

    db_goal = Goal(**goal_data)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)

    # Parse back for response
    if db_goal.key_results:
        try:
            parsed_results = json.loads(db_goal.key_results)
            db_goal.key_results = [KeyResult(**kr) for kr in parsed_results]
        except:
            db_goal.key_results = []

    return db_goal

@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(goal_id: int, goal_update: GoalUpdate, db: Session = Depends(get_db)):
    """Update an existing goal"""
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_data = goal_update.model_dump(exclude_unset=True)

    # Convert key_results list to JSON string
    if "key_results" in update_data and update_data["key_results"] is not None:
        update_data["key_results"] = json.dumps([kr.model_dump() for kr in update_data["key_results"]])

    for field, value in update_data.items():
        setattr(db_goal, field, value)

    db_goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_goal)

    # Parse back for response
    if db_goal.key_results:
        try:
            parsed_results = json.loads(db_goal.key_results)
            db_goal.key_results = [KeyResult(**kr) for kr in parsed_results]
        except:
            db_goal.key_results = []

    return db_goal

@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    """Delete a goal"""
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.delete(db_goal)
    db.commit()
    return None

@router.patch("/{goal_id}/progress", response_model=GoalResponse)
def update_goal_progress(
    goal_id: int,
    progress: float,
    db: Session = Depends(get_db)
):
    """Update only the progress of a goal"""
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if progress < 0 or progress > 100:
        raise HTTPException(status_code=400, detail="Progress must be between 0 and 100")

    db_goal.progress = progress
    db_goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_goal)

    # Parse key_results
    if db_goal.key_results:
        try:
            parsed_results = json.loads(db_goal.key_results)
            db_goal.key_results = [KeyResult(**kr) for kr in parsed_results]
        except:
            db_goal.key_results = []

    return db_goal
