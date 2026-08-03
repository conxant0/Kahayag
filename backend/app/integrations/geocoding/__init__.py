# Defines optional geocoding integrations.
from functools import lru_cache

from app.core.config import get_settings
from app.integrations.geocoding.nominatim import NominatimGeocodingProvider
from app.integrations.geocoding.provider import GeocodingProvider


@lru_cache
def get_geocoding_provider() -> GeocodingProvider:
    settings = get_settings()
    return NominatimGeocodingProvider(
        base_url=settings.nominatim_base_url,
        user_agent=settings.nominatim_user_agent,
    )
