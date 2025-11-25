from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
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

class ParseError(BaseModel):
    line_number: int
    text: str
    error: str

class BulkParseResponse(BaseModel):
    goals: List[GoalResponse]
    errors: List[ParseError]
    total_lines: int
    success_count: int
    error_count: int

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

@router.post("/parse-bulk", response_model=BulkParseResponse, status_code=201)
def parse_bulk_goals(request: GoalBulkParseRequest, db: Session = Depends(get_db)):
    """
    Parse multiple goals from text (one per line) and create them.
    Returns structured response with success/error details.

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
    parse_errors = []

    for idx, line in enumerate(lines, start=1):
        try:
            parsed = GoalParser.parse(line)

            # Validate required fields
            if not parsed.get("title") or parsed["title"] == "New Goal":
                raise ValueError("Could not extract a meaningful title from the text")

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
            parse_errors.append(ParseError(
                line_number=idx,
                text=line[:100] + ("..." if len(line) > 100 else ""),
                error=str(e)
            ))
            continue

    if not created_goals and parse_errors:
        raise HTTPException(
            status_code=400,
            detail=f"No valid goals could be parsed. {len(parse_errors)} line(s) had errors."
        )

    if created_goals:
        db.commit()
        # Refresh all goals and set empty key_results
        for goal in created_goals:
            db.refresh(goal)
            goal.key_results = []

    return BulkParseResponse(
        goals=created_goals,
        errors=parse_errors,
        total_lines=len(lines),
        success_count=len(created_goals),
        error_count=len(parse_errors)
    )
