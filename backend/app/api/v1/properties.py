# Defines property search endpoint for address lookup and map selection.
from fastapi import APIRouter, HTTPException, Query

from app.api.dependencies import DependsGeocodingProvider
from app.integrations.geocoding.errors import GeocodingApiError, GeocodingTimeoutError
from app.integrations.geocoding.provider import GeocodingProvider

router = APIRouter()


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
