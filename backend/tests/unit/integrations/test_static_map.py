from decimal import Decimal

import httpx

from app.features.reports.schemas import GeoPoint
from app.integrations.maps.static_map import fetch_static_map, mercator_pixel


def test_mercator_pixel_places_the_map_center_in_the_middle() -> None:
    center = GeoPoint(latitude=Decimal("10.3157"), longitude=Decimal("123.8854"))

    assert mercator_pixel(center, center=center, zoom=20, width=640, height=480) == (
        320.0,
        240.0,
    )


def test_mercator_pixel_moves_eastward_points_to_the_right() -> None:
    center = GeoPoint(latitude=Decimal("10.3157"), longitude=Decimal("123.8854"))
    east = GeoPoint(latitude=Decimal("10.3157"), longitude=Decimal("123.8855"))

    assert mercator_pixel(east, center=center, zoom=20, width=640, height=480)[0] > 320


def _roof() -> tuple[GeoPoint, ...]:
    return (
        GeoPoint(latitude=Decimal("10.3157"), longitude=Decimal("123.8854")),
        GeoPoint(latitude=Decimal("10.3158"), longitude=Decimal("123.8854")),
        GeoPoint(latitude=Decimal("10.3158"), longitude=Decimal("123.8855")),
    )


def test_static_map_failure_returns_no_image(monkeypatch) -> None:
    def fail(*_args, **_kwargs):
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr("app.integrations.maps.static_map.httpx.get", fail)

    assert fetch_static_map(_roof()) is None


def test_static_map_prefers_google_when_a_server_key_is_configured(
    monkeypatch,
) -> None:
    requested: list[str] = []

    def respond(url, params=None, timeout=None):
        requested.append(url)
        return httpx.Response(
            200, content=b"png", headers={"content-type": "image/png"}
        )

    monkeypatch.setattr("app.integrations.maps.static_map.httpx.get", respond)

    result = fetch_static_map(_roof(), google_maps_api_key="server-key")

    assert result is not None
    assert result.attribution == "Imagery: Google"
    assert requested == ["https://maps.googleapis.com/maps/api/staticmap"]


def test_static_map_falls_back_to_esri_when_google_rejects_the_key(
    monkeypatch,
) -> None:
    def respond(url, params=None, timeout=None):
        if "googleapis" in url:
            return httpx.Response(403, content=b"denied")
        return httpx.Response(
            200, content=b"png", headers={"content-type": "image/png"}
        )

    monkeypatch.setattr("app.integrations.maps.static_map.httpx.get", respond)

    result = fetch_static_map(_roof(), google_maps_api_key="restricted-key")

    assert result is not None
    assert result.attribution == "Imagery: Esri World Imagery"
