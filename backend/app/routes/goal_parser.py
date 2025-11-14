from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, Field
import json

from app.database import get_db
from app.models.goal import Goal
from app.schemas.goal import GoalResponse
from app.services.goal_parser import GoalParser

router = APIRouter(prefix="/api/goal-parser", tags=["goal-parser"])

class GoalParseRequest(BaseModel):
    text: str = Field(..., min_length=1)

class GoalBulkParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)

@router.post("/parse", response_model=GoalResponse, status_code=201)
def parse_goal(request: GoalParseRequest, db: Session = Depends(get_db)):
    """
    Parse natural language text and create a goal.

    Examples:
    - "Launch new website Q1 January"
    - "Complete certification Q2 April high priority"
    - "Reach 10k followers Q3 July urgent"
    """
    parsed = GoalParser.parse(request.text)

    # Convert key_results to JSON string if present
    goal_data = {
        "title": parsed["title"],
        "description": parsed.get("description"),
        "quarter": parsed["quarter"],
        "month": parsed["month"],
        "year": parsed["year"],
        "priority": parsed["priority"],
        "progress": 0.0,
        "key_results": None,  # Empty for quick add
    }

    db_goal = Goal(**goal_data)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)

    # Parse key_results for response
    db_goal.key_results = []

    return db_goal

@router.post("/parse-bulk", response_model=List[GoalResponse], status_code=201)
def parse_bulk_goals(request: GoalBulkParseRequest, db: Session = Depends(get_db)):
    """
    Parse multiple goals from text (one per line) and create them.

    Example:
    Launch new website Q1 January
    Complete certification Q2 April high priority
    Reach 10k followers Q3 July urgent
    Q4 December: Year-end review - Complete annual goals assessment
    """
    lines = [line.strip() for line in request.text.split('\n') if line.strip()]

    if not lines:
        raise HTTPException(status_code=400, detail="No goals to parse")

    created_goals = []

    for line in lines:
        try:
            parsed = GoalParser.parse(line)

            goal_data = {
                "title": parsed["title"],
                "description": parsed.get("description"),
                "quarter": parsed["quarter"],
                "month": parsed["month"],
                "year": parsed["year"],
                "priority": parsed["priority"],
                "progress": 0.0,
                "key_results": None,
            }

            db_goal = Goal(**goal_data)
            db.add(db_goal)
            created_goals.append(db_goal)
        except Exception as e:
            # Skip invalid lines but continue processing
            continue

    if not created_goals:
        raise HTTPException(status_code=400, detail="No valid goals could be parsed")

    db.commit()

    # Refresh all goals and set empty key_results
    for goal in created_goals:
        db.refresh(goal)
        goal.key_results = []

    return created_goals
