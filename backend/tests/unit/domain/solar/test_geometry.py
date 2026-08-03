from decimal import Decimal

import pytest

from app.domain.solar.errors import (
    DegenerateRoofPolygonError,
    InsufficientRoofAreaError,
    SelfIntersectingRoofPolygonError,
)
from app.domain.solar.geometry import calculate_roof_area
from app.shared.schemas import GeoCoordinate, RoofPolygon


def _coordinate(latitude: str, longitude: str) -> GeoCoordinate:
    return GeoCoordinate(latitude=Decimal(latitude), longitude=Decimal(longitude))


def test_calculates_area_for_a_square_roof() -> None:
    # ~10m x 10m square near the equator, where 1 degree of longitude and
    # latitude is close to 111,320m.
    side_degrees = Decimal(10) / Decimal(111320)
    polygon = RoofPolygon(
        vertices=(
            _coordinate("0", "0"),
            _coordinate("0", str(side_degrees)),
            _coordinate(str(side_degrees), str(side_degrees)),
            _coordinate(str(side_degrees), "0"),
        )
    )

    area = calculate_roof_area(polygon)

    assert area.area_m2 == pytest.approx(Decimal(100), abs=Decimal(1))


def test_calculates_area_for_a_triangle() -> None:
    # Right triangle with ~10m legs near the equator.
    side_degrees = Decimal(10) / Decimal(111320)
    polygon = RoofPolygon(
        vertices=(
            _coordinate("0", "0"),
            _coordinate("0", str(side_degrees)),
            _coordinate(str(side_degrees), "0"),
        )
    )

    area = calculate_roof_area(polygon)

    assert area.area_m2 == pytest.approx(Decimal(50), abs=Decimal(1))


def test_calculates_area_for_a_concave_polygon() -> None:
    # Arrow/chevron shape: concave but simple (non-self-intersecting).
    unit = Decimal(10) / Decimal(111320)
    polygon = RoofPolygon(
        vertices=(
            _coordinate("0", "0"),
            _coordinate(str(unit * 2), str(unit)),
            _coordinate("0", str(unit * 2)),
            _coordinate(str(unit), str(unit)),
        )
    )

    area = calculate_roof_area(polygon)

    assert area.area_m2 > 0


def test_rejects_self_intersecting_bowtie_polygon() -> None:
    polygon = RoofPolygon(
        vertices=(
            _coordinate("10.3157", "123.8854"),
            _coordinate("10.3158", "123.8855"),
            _coordinate("10.3157", "123.8855"),
            _coordinate("10.3158", "123.8854"),
        )
    )

    with pytest.raises(SelfIntersectingRoofPolygonError):
        calculate_roof_area(polygon)


def test_rejects_collinear_vertices_as_degenerate() -> None:
    polygon = RoofPolygon(
        vertices=(
            _coordinate("10.3157", "123.8854"),
            _coordinate("10.3158", "123.8854"),
            _coordinate("10.3159", "123.8854"),
        )
    )

    with pytest.raises(DegenerateRoofPolygonError):
        calculate_roof_area(polygon)


def test_rejects_duplicate_vertices_as_degenerate() -> None:
    polygon = RoofPolygon(
        vertices=(
            _coordinate("10.3157", "123.8854"),
            _coordinate("10.3157", "123.8854"),
            _coordinate("10.3157", "123.8854"),
        )
    )

    with pytest.raises(DegenerateRoofPolygonError):
        calculate_roof_area(polygon)


def test_rejects_valid_polygon_below_minimum_usable_area() -> None:
    # A real, non-degenerate 1m x 1m square: too small to fit any panel.
    side_degrees = Decimal(1) / Decimal(111320)
    polygon = RoofPolygon(
        vertices=(
            _coordinate("0", "0"),
            _coordinate("0", str(side_degrees)),
            _coordinate(str(side_degrees), str(side_degrees)),
            _coordinate(str(side_degrees), "0"),
        )
    )

    with pytest.raises(InsufficientRoofAreaError):
        calculate_roof_area(polygon)


def test_accepts_candidate_polygon_large_enough_for_one_panel() -> None:
    # ~2.2 m² is above the smallest documented panel footprint (1.9888 m²).
    side_degrees = Decimal("2.2").sqrt() / Decimal(111320)
    polygon = RoofPolygon(
        vertices=(
            _coordinate("0", "0"),
            _coordinate("0", str(side_degrees)),
            _coordinate(str(side_degrees), str(side_degrees)),
            _coordinate(str(side_degrees), "0"),
        )
    )

    area = calculate_roof_area(polygon)

    assert area.area_m2 == pytest.approx(Decimal("2.2"), abs=Decimal("0.1"))


def test_accepts_polygon_with_duplicate_vertex_alongside_real_area() -> None:
    # A valid square with a redundant repeated corner should still validate
    # cleanly, using the same deduplicated point set for both the shape and
    # self-intersection checks.
    side_degrees = Decimal(10) / Decimal(111320)
    polygon = RoofPolygon(
        vertices=(
            _coordinate("0", "0"),
            _coordinate("0", str(side_degrees)),
            _coordinate(str(side_degrees), str(side_degrees)),
            _coordinate(str(side_degrees), "0"),
            _coordinate(str(side_degrees), "0"),
        )
    )

    area = calculate_roof_area(polygon)

    assert area.area_m2 == pytest.approx(Decimal(100), abs=Decimal(1))


def test_returned_area_uses_explicit_square_meter_units() -> None:
    side_degrees = Decimal(5) / Decimal(111320)
    polygon = RoofPolygon(
        vertices=(
            _coordinate("0", "0"),
            _coordinate("0", str(side_degrees)),
            _coordinate(str(side_degrees), str(side_degrees)),
            _coordinate(str(side_degrees), "0"),
        )
    )

    area = calculate_roof_area(polygon)

    assert isinstance(area.area_m2, Decimal)
    assert area.area_m2 > 0
