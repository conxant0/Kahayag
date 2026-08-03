# Defines shading-analysis orchestration.

from app.domain.shading.analysis import analyze_building_insights
from app.features.shading.schemas import ShadingAnalysisRequest, ShadingAnalysisResponse
from app.integrations.solar.provider import SolarDataProvider


def build_shading_analysis_response(
    request: ShadingAnalysisRequest,
    *,
    solar_provider: SolarDataProvider,
) -> ShadingAnalysisResponse:
    analysis = analyze_building_insights(
        latitude=request.latitude,
        longitude=request.longitude,
        building_insights=solar_provider.find_closest_building_insights(
            latitude=request.latitude,
            longitude=request.longitude,
        ),
    )
    return ShadingAnalysisResponse.model_validate(analysis, from_attributes=True)
