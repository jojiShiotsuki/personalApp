from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.schemas.sprint import (
    SprintCreate,
    SprintUpdate,
    SprintResponse,
    SprintDayResponse,
    SprintListResponse,
    ToggleTaskResponse,
    UpdateNotesRequest,
    UpdateNotesResponse,
)
from app.services import sprint_service
from app.models.sprint import SPRINT_DAY_TASKS


class PlaybookSuggestion(BaseModel):
    """A suggested task from the playbook."""
    title: str
    description: str = ""


class PlaybookSuggestionsResponse(BaseModel):
    """Response containing playbook suggestions for a day."""
    day_number: int
    suggestions: List[PlaybookSuggestion]

router = APIRouter(prefix="/api/sprint", tags=["sprint"])


@router.get("", response_model=Optional[SprintResponse])
def get_active_sprint(db: Session = Depends(get_db)):
    """Get the current active sprint."""
    sprint = sprint_service.get_active_sprint(db)
    if not sprint:
        return None
    return sprint_service.build_sprint_response(db, sprint)


@router.get("/all", response_model=List[SprintListResponse])
def get_all_sprints(db: Session = Depends(get_db)):
    """Get all sprints."""
    sprints = sprint_service.get_all_sprints(db)
    return [
        SprintListResponse(
            id=s.id,
            title=s.title,
            start_date=s.start_date,
            end_date=s.end_date,
            status=s.status,
            progress_percentage=s.progress_percentage,
            created_at=s.created_at,
        )
        for s in sprints
    ]


@router.post("", response_model=SprintResponse)
def create_sprint(data: SprintCreate, db: Session = Depends(get_db)):
    """Create a new sprint."""
    try:
        sprint = sprint_service.create_sprint(db, data)
        return sprint_service.build_sprint_response(db, sprint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{sprint_id}", response_model=SprintResponse)
def get_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Get a sprint by ID."""
    sprint = sprint_service.get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint_service.build_sprint_response(db, sprint)


@router.put("/{sprint_id}", response_model=SprintListResponse)
def update_sprint(sprint_id: int, data: SprintUpdate, db: Session = Depends(get_db)):
    """Update a sprint's details."""
    try:
        sprint = sprint_service.update_sprint(db, sprint_id, data)
        return SprintListResponse(
            id=sprint.id,
            title=sprint.title,
            start_date=sprint.start_date,
            end_date=sprint.end_date,
            status=sprint.status,
            progress_percentage=sprint.progress_percentage,
            created_at=sprint.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{sprint_id}")
def delete_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Delete a sprint."""
    try:
        sprint_service.delete_sprint(db, sprint_id)
        return {"message": "Sprint deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{sprint_id}/pause", response_model=SprintResponse)
def pause_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Pause an active sprint."""
    try:
        sprint = sprint_service.pause_sprint(db, sprint_id)
        return sprint_service.build_sprint_response(db, sprint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{sprint_id}/resume", response_model=SprintResponse)
def resume_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Resume a paused sprint."""
    try:
        sprint = sprint_service.resume_sprint(db, sprint_id)
        return sprint_service.build_sprint_response(db, sprint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{sprint_id}/abandon", response_model=SprintResponse)
def abandon_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Abandon a sprint."""
    try:
        sprint = sprint_service.abandon_sprint(db, sprint_id)
        return sprint_service.build_sprint_response(db, sprint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{sprint_id}/complete", response_model=SprintResponse)
def complete_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Mark a sprint as completed."""
    try:
        sprint = sprint_service.complete_sprint(db, sprint_id)
        return sprint_service.build_sprint_response(db, sprint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{sprint_id}/advance-day", response_model=SprintResponse)
def advance_day(sprint_id: int, db: Session = Depends(get_db)):
    """Advance the sprint to the next day (for testing/development)."""
    try:
        sprint = sprint_service.advance_day(db, sprint_id)
        return sprint_service.build_sprint_response(db, sprint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{sprint_id}/go-back-day", response_model=SprintResponse)
def go_back_day(sprint_id: int, db: Session = Depends(get_db)):
    """Go back to the previous day (for testing/development)."""
    try:
        sprint = sprint_service.go_back_day(db, sprint_id)
        return sprint_service.build_sprint_response(db, sprint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{sprint_id}/day/{day_number}", response_model=SprintDayResponse)
def get_sprint_day(sprint_id: int, day_number: int, db: Session = Depends(get_db)):
    """Get a specific day within a sprint."""
    sprint_day = sprint_service.get_sprint_day(db, sprint_id, day_number)
    if not sprint_day:
        raise HTTPException(status_code=404, detail="Sprint day not found")
    return sprint_service.build_sprint_day_response(db, sprint_day)


@router.post("/{sprint_id}/day/{day_number}/task/{task_index}", response_model=ToggleTaskResponse)
def toggle_task(sprint_id: int, day_number: int, task_index: int, db: Session = Depends(get_db)):
    """Toggle a task's completion status."""
    try:
        return sprint_service.toggle_task(db, sprint_id, day_number, task_index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{sprint_id}/day/{day_number}/notes", response_model=UpdateNotesResponse)
def update_day_notes(
    sprint_id: int,
    day_number: int,
    data: UpdateNotesRequest,
    db: Session = Depends(get_db)
):
    """Update notes for a sprint day."""
    try:
        return sprint_service.update_day_notes(db, sprint_id, day_number, data.notes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/playbook/{day_number}", response_model=PlaybookSuggestionsResponse)
def get_playbook_suggestions(day_number: int):
    """Get playbook task suggestions for a specific day (1-30)."""
    if day_number < 1 or day_number > 30:
        raise HTTPException(status_code=400, detail="Day number must be between 1 and 30")

    suggestions = SPRINT_DAY_TASKS.get(day_number, [
        {"title": "Complete daily outreach targets", "completed": False}
    ])

    return PlaybookSuggestionsResponse(
        day_number=day_number,
        suggestions=[PlaybookSuggestion(title=s["title"]) for s in suggestions]
    )
