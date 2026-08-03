from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.features.solar_flux.router import _get_solar_provider
from app.features.solar_flux.url_codec import encode_flux_url
from app.integrations.solar.errors import SolarProviderDisabledError
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_prepares_proxied_flux_paths(client: TestClient) -> None:
    class Provider:
        def get_data_layers(self, *, latitude: float, longitude: float, radius_meters: int) -> dict:
            assert (latitude, longitude, radius_meters) == (10.3157, 123.8854, 100)
            return {
                "annualFluxUrl": "https://solar.example/annual",
                "maskUrl": "https://solar.example/mask",
                "imageryQuality": "HIGH",
            }

    app.dependency_overrides[_get_solar_provider] = Provider

    response = client.post(
        "/api/v1/solar/flux/prepare",
        json={"latitude": 10.3157, "longitude": 123.8854},
    )

    assert response.status_code == 200
    assert response.json()["annual_flux_path"].startswith("/solar/flux/geotiff/annual/")
    assert response.json()["mask_path"].startswith("/solar/flux/geotiff/mask/")


def test_returns_provider_failure_without_blocking_assessment(client: TestClient) -> None:
    class Provider:
        def get_data_layers(self, **_: object) -> dict:
            raise SolarProviderDisabledError("Solar provider disabled")

    app.dependency_overrides[_get_solar_provider] = Provider

    response = client.post(
        "/api/v1/solar/flux/prepare",
        json={"latitude": 10.3157, "longitude": 123.8854},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Solar provider disabled"


def test_rejects_malformed_flux_token(client: TestClient) -> None:
    response = client.get("/api/v1/solar/flux/geotiff/annual/not-a-token!")

    assert response.status_code == 404
    assert response.json()["detail"] == "Invalid flux layer token."


def test_proxies_a_valid_flux_layer(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(google_solar_api_key="test")
    monkeypatch.setattr(
        "app.features.solar_flux.router.fetch_geotiff_bytes",
        lambda source_url, api_key: b"tiff-bytes",
    )

    response = client.get(
        f"/api/v1/solar/flux/geotiff/annual/{encode_flux_url('https://solar.example/annual')}"
    )

    assert response.status_code == 200
    assert response.content == b"tiff-bytes"
    assert response.headers["content-type"] == "image/tiff"
