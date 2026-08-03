# Defines property search and roof-outline endpoints for the location step.
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import DependsGeocodingProvider
from app.core.config import Settings, get_settings
from app.integrations.geocoding.errors import GeocodingApiError, GeocodingTimeoutError
from app.integrations.geocoding.provider import GeocodingProvider
from app.integrations.solar import get_solar_provider
from app.integrations.solar.building_outline import extract_roof_outline
from app.integrations.solar.errors import (
    BuildingNotFoundError,
    SolarApiError,
    SolarProviderDisabledError,
)
from app.integrations.solar.provider import SolarDataProvider

router = APIRouter()

DependsSettings = Depends(get_settings)


def _get_solar_provider(settings: Settings = DependsSettings) -> SolarDataProvider:
    return get_solar_provider(settings)


DependsSolarProvider = Depends(_get_solar_provider)


@router.get("/properties/search")
def search_property_addresses(
    query: str = Query(min_length=1),
    limit: int = Query(default=5, ge=1, le=10),
    geocoding_provider: GeocodingProvider = DependsGeocodingProvider,
) -> list[dict[str, float | str]]:
    try:
        results = geocoding_provider.search(query, limit=limit)
    except GeocodingTimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
    except GeocodingApiError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return [
        {
            "address": item["display_name"],
            "latitude": float(item["lat"]),
            "longitude": float(item["lon"]),
        }
        for item in results
    ]


@router.get("/properties/roof-outline")
def get_roof_outline(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    solar_provider: SolarDataProvider = DependsSolarProvider,
) -> dict:
    """Return the building footprint under a point, for seeding a roof trace.

    The tracing step opens on this rather than on a fixed square, so the first
    shape on screen is roughly the roof someone is about to adjust. Every
    failure is a 404: there is nothing wrong with the request, there is simply
    no outline to offer, and the caller falls back to drawing its own.
    """
    try:
        payload = solar_provider.find_closest_building_insights(
            latitude=latitude, longitude=longitude
        )
    except (BuildingNotFoundError, SolarProviderDisabledError) as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except SolarApiError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    outline = extract_roof_outline(payload)
    if outline is None:
        raise HTTPException(
            status_code=404,
            detail="No usable roof outline was found for this location.",
        )

    return outline
