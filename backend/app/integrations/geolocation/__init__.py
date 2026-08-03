# Defines IP-geolocation provider integrations.
from functools import lru_cache

from app.integrations.geolocation.ip_api import IpApiGeolocationProvider
from app.integrations.geolocation.provider import GeolocationProvider


@lru_cache
def get_geolocation_provider() -> GeolocationProvider:
    return IpApiGeolocationProvider()
