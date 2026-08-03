# Defines optional shading-analysis API boundaries.

from fastapi import APIRouter, Depends, HTTPException

from app.domain.shading.errors import InvalidSunshineDataError
from app.features.assessment.dependencies import get_assessment_solar_provider
from app.features.shading.schemas import ShadingAnalysisRequest, ShadingAnalysisResponse
from app.features.shading.service import build_shading_analysis_response
from app.integrations.solar.errors import (
    BuildingNotFoundError,
    SolarApiError,
    SolarProviderDisabledError,
)
from app.integrations.solar.provider import SolarDataProvider

router = APIRouter()


@router.post("/shading/analyze", response_model=ShadingAnalysisResponse)
def analyze_property_shading(
    request: ShadingAnalysisRequest,
    solar_provider: SolarDataProvider = Depends(get_assessment_solar_provider),
) -> ShadingAnalysisResponse:
    try:
        return build_shading_analysis_response(request, solar_provider=solar_provider)
    except SolarProviderDisabledError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except BuildingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except InvalidSunshineDataError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except SolarApiError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
