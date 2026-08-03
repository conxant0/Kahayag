from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.features.assessment.dependencies import get_assessment_solar_provider
from app.integrations.solar.errors import (
    BuildingNotFoundError,
    SolarApiError,
    SolarProviderDisabledError,
)
from app.main import app

REQUEST = {"latitude": 10.3157, "longitude": 123.8854}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_returns_provisional_shading_analysis(
    client: TestClient,
    cebu_building_insights_payload: dict,
) -> None:
    class Provider:
        def find_closest_building_insights(self, *, latitude: float, longitude: float) -> dict:
            return cebu_building_insights_payload

    app.dependency_overrides[get_assessment_solar_provider] = Provider

    response = client.post("/api/v1/shading/analyze", json=REQUEST)

    assert response.status_code == 200
    assert response.json() | {
        "shading_impact": "low",
        "sunshine_retention_ratio": "0.96",
        "roof_segment_count": 6,
        "is_provisional": True,
    } == response.json()


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (SolarProviderDisabledError("disabled"), 503),
        (BuildingNotFoundError("missing building"), 404),
        (SolarApiError("upstream failed"), 502),
    ],
)
def test_translates_provider_failures(
    client: TestClient,
    error: Exception,
    expected_status: int,
) -> None:
    class Provider:
        def find_closest_building_insights(self, *, latitude: float, longitude: float) -> dict:
            raise error

    app.dependency_overrides[get_assessment_solar_provider] = Provider

    response = client.post("/api/v1/shading/analyze", json=REQUEST)

    assert response.status_code == expected_status
    assert response.json()["detail"] == str(error)


def test_returns_422_for_malformed_sunshine_data(client: TestClient) -> None:
    class Provider:
        def find_closest_building_insights(self, *, latitude: float, longitude: float) -> dict:
            return {}

    app.dependency_overrides[get_assessment_solar_provider] = Provider

    response = client.post("/api/v1/shading/analyze", json=REQUEST)

    assert response.status_code == 422
    assert "solarPotential" in response.json()["detail"]
