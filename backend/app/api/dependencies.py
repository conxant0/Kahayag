# Defines dependencies shared across API routes.

from fastapi import Depends

from app.integrations.geocoding import get_geocoding_provider
from app.integrations.geocoding.provider import GeocodingProvider
from app.integrations.geolocation import get_geolocation_provider
from app.integrations.geolocation.provider import GeolocationProvider


def get_property_geocoding_provider() -> GeocodingProvider:
    return get_geocoding_provider()


def get_property_geolocation_provider() -> GeolocationProvider:
    return get_geolocation_provider()


DependsGeocodingProvider = Depends(get_property_geocoding_provider)
DependsGeolocationProvider = Depends(get_property_geolocation_provider)
