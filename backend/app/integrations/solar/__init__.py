# Defines solar-data provider integrations.

from app.core.config import Settings
from app.integrations.solar.disabled import DisabledSolarProvider
from app.integrations.solar.google_solar import GoogleSolarProvider
from app.integrations.solar.provider import SolarDataProvider


def get_solar_provider(settings: Settings) -> SolarDataProvider:
    if settings.solar_provider == "google" and settings.google_solar_api_key:
        return GoogleSolarProvider(api_key=settings.google_solar_api_key)
    return DisabledSolarProvider()
