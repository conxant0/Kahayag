import pytest
from fastapi.testclient import TestClient

from app.api.v1.properties import _get_solar_provider
from app.integrations.solar.errors import (
    BuildingNotFoundError,
    SolarApiError,
    SolarProviderDisabledError,
)
from app.main import app

BUILDING_INSIGHTS = {
    "center": {"latitude": 10.3157, "longitude": 123.8854},
    "boundingBox": {
        "sw": {"latitude": 10.3155, "longitude": 123.8852},
        "ne": {"latitude": 10.3159, "longitude": 123.8856},
    },
    "solarPotential": {
        "roofSegmentStats": [
            {
                "boundingBox": {
                    "sw": {"latitude": 10.3156, "longitude": 123.8853},
                    "ne": {"latitude": 10.3158, "longitude": 123.8855},
                },
                "stats": {"areaMeters2": 64.0},
                "pitchDegrees": 12.0,
                "azimuthDegrees": 190.0,
            }
        ]
    },
}


class StubSolarProvider:
    def __init__(self, *, payload=None, error=None) -> None:
        self._payload = payload
        self._error = error

    def find_closest_building_insights(self, *, latitude: float, longitude: float):
        if self._error is not None:
            raise self._error
        return self._payload

    def get_data_layers(self, *, latitude, longitude, radius_meters=100):  # pragma: no cover
        raise NotImplementedError


def _call(provider) -> "object":
    app.dependency_overrides[_get_solar_provider] = lambda: provider
    try:
        return TestClient(app).get(
            "/api/v1/properties/roof-outline",
            params={"latitude": 10.3157, "longitude": 123.8854},
        )
    finally:
        app.dependency_overrides.clear()


def test_returns_the_building_outline() -> None:
    response = _call(StubSolarProvider(payload=BUILDING_INSIGHTS))

    assert response.status_code == 200
    body = response.json()
    assert body["bounding_box"]["south"] == pytest.approx(10.3155)
    assert body["segments"][0]["area_square_meters"] == pytest.approx(64.0)


@pytest.mark.parametrize(
    "error",
    [
        BuildingNotFoundError("no building here"),
        SolarProviderDisabledError("solar provider is off"),
    ],
)
def test_reports_a_missing_outline_as_not_found(error: Exception) -> None:
    # Nothing is wrong with the request in either case; there is simply no
    # outline to offer, and the caller draws its own instead.
    response = _call(StubSolarProvider(error=error))

    assert response.status_code == 404


def test_reports_a_provider_failure_as_a_gateway_error() -> None:
    # This one is not the caller's problem to route around.
    response = _call(StubSolarProvider(error=SolarApiError("upstream exploded")))

    assert response.status_code == 502


def test_reports_a_payload_without_geometry_as_not_found() -> None:
    response = _call(StubSolarProvider(payload={"solarPotential": {}}))

    assert response.status_code == 404


def test_rejects_coordinates_outside_the_valid_range() -> None:
    app.dependency_overrides[_get_solar_provider] = lambda: StubSolarProvider(
        payload=BUILDING_INSIGHTS
    )
    try:
        response = TestClient(app).get(
            "/api/v1/properties/roof-outline",
            params={"latitude": 999, "longitude": 123.8854},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
