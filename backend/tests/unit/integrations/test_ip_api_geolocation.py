import httpx
import pytest

from app.integrations.geolocation.errors import GeolocationLookupError
from app.integrations.geolocation.ip_api import IpApiGeolocationProvider


def test_locate_returns_coordinates_on_success(monkeypatch) -> None:
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": "success", "lat": 10.32, "lon": 123.89}

    def fake_get(url, **kwargs):
        assert "8.8.8.8" in url
        return FakeResponse()

    monkeypatch.setattr("app.integrations.geolocation.ip_api.httpx.get", fake_get)

    assert IpApiGeolocationProvider().locate("8.8.8.8") == (10.32, 123.89)


def test_locate_raises_on_transport_error(monkeypatch) -> None:
    def fail(*_args, **_kwargs):
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr("app.integrations.geolocation.ip_api.httpx.get", fail)

    with pytest.raises(GeolocationLookupError):
        IpApiGeolocationProvider().locate("8.8.8.8")


def test_locate_raises_on_provider_failure_status(monkeypatch) -> None:
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": "fail", "message": "invalid query"}

    monkeypatch.setattr(
        "app.integrations.geolocation.ip_api.httpx.get",
        lambda *_a, **_k: FakeResponse(),
    )

    with pytest.raises(GeolocationLookupError, match="invalid query"):
        IpApiGeolocationProvider().locate("8.8.8.8")
