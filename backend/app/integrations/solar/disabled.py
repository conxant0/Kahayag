# Defines behavior when no solar data provider is configured.

from app.integrations.solar.errors import SolarProviderDisabledError


class DisabledSolarProvider:
    def find_closest_building_insights(
        self, *, latitude: float, longitude: float
    ) -> dict:
        raise SolarProviderDisabledError(
            "Solar shading analysis is disabled. Configure APP_SOLAR_PROVIDER=google "
            "and APP_GOOGLE_SOLAR_API_KEY to enable the Google Solar API."
        )

    def get_data_layers(
        self, *, latitude: float, longitude: float, radius_meters: int = 100
    ) -> dict:
        raise SolarProviderDisabledError(
            "Solar flux visualization is disabled. Configure APP_SOLAR_PROVIDER=google "
            "and APP_GOOGLE_SOLAR_API_KEY to enable the Google Solar API."
        )
