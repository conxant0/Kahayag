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


def test_static_map_failure_returns_no_image(monkeypatch) -> None:
    roof = (
        GeoPoint(latitude=Decimal("10.3157"), longitude=Decimal("123.8854")),
        GeoPoint(latitude=Decimal("10.3158"), longitude=Decimal("123.8854")),
        GeoPoint(latitude=Decimal("10.3158"), longitude=Decimal("123.8855")),
    )

    def fail(*_args, **_kwargs):
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr("app.integrations.maps.static_map.httpx.get", fail)

    assert fetch_static_map(roof, api_key="test-key") is None
