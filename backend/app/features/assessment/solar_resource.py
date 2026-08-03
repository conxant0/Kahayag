# Resolves location-specific solar resource data for assessments.

from app.domain.shading.analysis import ShadingAnalysis, analyze_building_insights
from app.domain.shading.errors import InvalidSunshineDataError
from app.domain.solar.resource import (
    SolarResource,
    nationwide_fallback_solar_resource,
    solar_resource_from_shading_analysis,
)
from app.integrations.solar.errors import (
    BuildingNotFoundError,
    SolarApiError,
    SolarProviderDisabledError,
)
from app.integrations.solar.provider import SolarDataProvider

SOLAR_API_FALLBACK_LIMITATION = (
    "Location-specific solar sunshine could not be retrieved; "
    "generation uses the nationwide planning fallback."
)


def resolve_solar_resource(
    *,
    latitude: float,
    longitude: float,
    solar_provider: SolarDataProvider,
) -> tuple[SolarResource, ShadingAnalysis | None, str | None]:
    try:
        building_insights = solar_provider.find_closest_building_insights(
            latitude=latitude,
            longitude=longitude,
        )
        analysis = analyze_building_insights(
            latitude=latitude,
            longitude=longitude,
            building_insights=building_insights,
        )
        return solar_resource_from_shading_analysis(analysis), analysis, None
    except (
        SolarProviderDisabledError,
        BuildingNotFoundError,
        SolarApiError,
        InvalidSunshineDataError,
    ):
        return (
            nationwide_fallback_solar_resource(),
            None,
            SOLAR_API_FALLBACK_LIMITATION,
        )
