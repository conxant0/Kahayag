from fastapi.testclient import TestClient

from app.api.dependencies import get_property_geocoding_provider
from app.main import app


class DummyGeocodingProvider:
    def search(self, query: str, *, limit: int = 5) -> list[dict[str, str]]:
        return [
            {
                "display_name": "123 Sample Street, Quezon City, Metro Manila",
                "lat": "14.5995",
                "lon": "120.9842",
            }
        ]


def test_search_property_addresses_returns_results() -> None:
    app.dependency_overrides[get_property_geocoding_provider] = (
        lambda: DummyGeocodingProvider()
    )

    try:
        client = TestClient(app)
        response = client.get(
            "/api/v1/properties/search", params={"query": "123 Sample Street"}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["address"] == "123 Sample Street, Quezon City, Metro Manila"
    assert payload[0]["latitude"] == 14.5995
    assert payload[0]["longitude"] == 120.9842
