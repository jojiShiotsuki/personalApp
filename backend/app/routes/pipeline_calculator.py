from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.pipeline_calculator import (
    PipelineSettingsBase,
    PipelineSettingsUpdate,
    PipelineSettingsResponse,
    PipelineCalculation,
)
from app.services import pipeline_calculator_service

router = APIRouter(prefix="/api/pipeline", tags=["pipeline-calculator"])


@router.get("/settings", response_model=PipelineSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """Get current pipeline settings."""
    return pipeline_calculator_service.get_or_create_settings(db)


@router.put("/settings", response_model=PipelineSettingsResponse)
def update_settings(
    data: PipelineSettingsUpdate,
    db: Session = Depends(get_db),
):
    """Update pipeline settings."""
    return pipeline_calculator_service.update_settings(db, data)


@router.get("/calculate", response_model=PipelineCalculation)
def calculate_pipeline(db: Session = Depends(get_db)):
    """Calculate required activities based on saved settings."""
    return pipeline_calculator_service.get_pipeline_calculation(db)


@router.post("/calculate", response_model=PipelineCalculation)
def calculate_custom_pipeline(data: PipelineSettingsBase):
    """Calculate required activities with custom settings (without saving)."""
    return pipeline_calculator_service.calculate_custom_pipeline(data)
