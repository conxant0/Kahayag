import time
from unittest.mock import MagicMock, patch

from app.integrations.geocoding.nominatim import NominatimGeocodingProvider


def _mock_response(payload):
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


def test_geocode_returns_none_for_no_results():
    provider = NominatimGeocodingProvider(
        base_url="https://nominatim.example", user_agent="test-agent"
    )
    with patch("httpx.get", return_value=_mock_response([])):
        assert provider.geocode("nowhere") is None


def test_geocode_returns_lat_lon_for_first_result():
    provider = NominatimGeocodingProvider(
        base_url="https://nominatim.example", user_agent="test-agent"
    )
    payload = [{"lat": "14.5995", "lon": "120.9842"}]
    with patch("httpx.get", return_value=_mock_response(payload)):
        assert provider.geocode("Manila") == (14.5995, 120.9842)


def test_geocode_throttles_consecutive_requests():
    provider = NominatimGeocodingProvider(
        base_url="https://nominatim.example", user_agent="test-agent"
    )
    with patch("httpx.get", return_value=_mock_response([])):
        start = time.monotonic()
        provider.geocode("first")
        provider.geocode("second")
        elapsed = time.monotonic() - start
    assert elapsed >= 1.0


def test_get_geocoding_provider_reuses_singleton_instance():
    from app.integrations.geocoding import get_geocoding_provider

    get_geocoding_provider.cache_clear()
    try:
        first = get_geocoding_provider()
        second = get_geocoding_provider()
    finally:
        get_geocoding_provider.cache_clear()

    assert first is second
