import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestApproximateGeolocation:
    def test_rejects_private_client_ip(self, client):
        response = client.post("/api/v1/geolocation/approximate")

        assert response.status_code == 503
        assert "localhost" in response.json()["detail"].lower()

    def test_returns_coordinates_for_public_ip(self, client, monkeypatch):
        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"status": "success", "lat": 10.32, "lon": 123.89}

        def fake_get(url, **kwargs):
            assert "8.8.8.8" in url
            return FakeResponse()

        monkeypatch.setattr("app.features.geolocation.router.httpx.get", fake_get)

        response = client.post(
            "/api/v1/geolocation/approximate",
            headers={"x-forwarded-for": "8.8.8.8"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["latitude"] == 10.32
        assert body["longitude"] == 123.89
        assert body["source"] == "ip-approximate"
