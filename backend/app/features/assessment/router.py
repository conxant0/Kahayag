# Defines assessment API endpoint boundaries.

from fastapi import APIRouter, Depends, HTTPException

from app.domain.solar.errors import NoFeasibleSystemError
from app.features.assessment.dependencies import get_assessment_solar_provider
from app.features.assessment.schemas import (
    AssessmentRequest,
    CompletedAssessment,
    PanelCountAdjustmentRequest,
    PanelCountAdjustmentResponse,
)
from app.features.assessment.service import (
    adjust_panel_count,
    build_assessment_response,
)
from app.integrations.solar.provider import SolarDataProvider

router = APIRouter()


@router.post("/assessments", response_model=CompletedAssessment)
def create_assessment(
    request: AssessmentRequest,
    solar_provider: SolarDataProvider = Depends(get_assessment_solar_provider),
) -> CompletedAssessment:
    try:
        return build_assessment_response(request, solar_provider=solar_provider)
    except NoFeasibleSystemError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/assessments/panel-count-adjustment", response_model=PanelCountAdjustmentResponse
)
def adjust_assessment_panel_count(
    request: PanelCountAdjustmentRequest,
    solar_provider: SolarDataProvider = Depends(get_assessment_solar_provider),
) -> PanelCountAdjustmentResponse:
    try:
        return adjust_panel_count(request, solar_provider=solar_provider)
    except NoFeasibleSystemError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
