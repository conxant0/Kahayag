# Defines dependencies shared across API routes.

from fastapi import Depends

from app.integrations.geocoding import get_geocoding_provider
from app.integrations.geocoding.provider import GeocodingProvider


def get_property_geocoding_provider() -> GeocodingProvider:
    return get_geocoding_provider()


DependsGeocodingProvider = Depends(get_property_geocoding_provider)
