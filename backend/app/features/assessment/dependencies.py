# Defines assessment-specific dependency composition.

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.integrations.solar import get_solar_provider
from app.integrations.solar.provider import SolarDataProvider


def get_assessment_solar_provider(
    settings: Settings = Depends(get_settings),
) -> SolarDataProvider:
    return get_solar_provider(settings)
