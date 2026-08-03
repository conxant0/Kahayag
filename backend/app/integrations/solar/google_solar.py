# Defines the Google Solar API building insights client.

import httpx

from app.integrations.solar.errors import BuildingNotFoundError, SolarApiError

BUILDING_INSIGHTS_URL = "https://solar.googleapis.com/v1/buildingInsights:findClosest"
DATA_LAYERS_URL = "https://solar.googleapis.com/v1/dataLayers:get"


class GoogleSolarProvider:
    def __init__(self, *, api_key: str) -> None:
        self._api_key = api_key

    def find_closest_building_insights(
        self, *, latitude: float, longitude: float
    ) -> dict:
        response = _get(
            BUILDING_INSIGHTS_URL,
            params={
                "location.latitude": latitude,
                "location.longitude": longitude,
                "key": self._api_key,
            },
        )

        if response.status_code == 404:
            raise BuildingNotFoundError(
                "No building with solar coverage was found within approximately "
                "50 meters of the provided coordinates."
            )

        if response.status_code >= 400:
            detail = _extract_error_detail(response)
            raise SolarApiError(
                f"Google Solar API request failed ({response.status_code}): {detail}"
            )

        return response.json()

    def get_data_layers(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int = 100,
    ) -> dict:
        response = _get(
            DATA_LAYERS_URL,
            params={
                "location.latitude": latitude,
                "location.longitude": longitude,
                "radiusMeters": radius_meters,
                "view": "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
                "requiredQuality": "BASE",
                "key": self._api_key,
            },
        )

        if response.status_code >= 400:
            detail = _extract_error_detail(response)
            raise SolarApiError(
                f"Google Solar dataLayers request failed ({response.status_code}): {detail}"
            )

        payload = response.json()
        if not payload.get("annualFluxUrl") or not payload.get("maskUrl"):
            raise SolarApiError(
                "Google Solar dataLayers response is missing annual flux or mask URLs."
            )

        return payload


def _get(url: str, *, params: dict) -> httpx.Response:
    try:
        return httpx.get(url, params=params, timeout=30.0)
    except httpx.HTTPError as exc:
        raise SolarApiError(f"Google Solar API transport error: {exc}") from exc


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or "unknown error"

    error = payload.get("error", {})
    message = error.get("message")
    if message:
        return message
    return response.text or "unknown error"
