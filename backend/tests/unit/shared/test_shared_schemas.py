from copy import deepcopy
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.shared.schemas import (
    GeoCoordinate,
    MapViewport,
    PropertyLocation,
    RoofArea,
    RoofPolygon,
)

VALID_COORDINATE = {"latitude": "10.3157", "longitude": "123.8854"}


def test_geo_coordinate_accepts_valid_payload() -> None:
    coordinate = GeoCoordinate.model_validate(VALID_COORDINATE)

    assert coordinate.latitude == Decimal("10.3157")
    assert coordinate.longitude == Decimal("123.8854")


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("latitude", "90.1"),
        ("latitude", "-90.1"),
        ("longitude", "180.1"),
        ("longitude", "-180.1"),
    ],
)
def test_geo_coordinate_rejects_out_of_range_values(field: str, value: str) -> None:
    invalid = {**VALID_COORDINATE, field: value}

    with pytest.raises(ValidationError):
        GeoCoordinate.model_validate(invalid)


def test_geo_coordinate_rejects_unknown_fields() -> None:
    invalid = {**VALID_COORDINATE, "provider_place_id": "ChIJ123"}

    with pytest.raises(ValidationError):
        GeoCoordinate.model_validate(invalid)


@pytest.mark.parametrize("field", ["latitude", "longitude"])
def test_geo_coordinate_requires_every_field(field: str) -> None:
    invalid = deepcopy(VALID_COORDINATE)
    invalid.pop(field)

    with pytest.raises(ValidationError):
        GeoCoordinate.model_validate(invalid)


def test_map_viewport_accepts_valid_payload() -> None:
    viewport = MapViewport.model_validate(
        {"center": VALID_COORDINATE, "zoom_level": "18"}
    )

    assert viewport.center.latitude == Decimal("10.3157")
    assert viewport.zoom_level == Decimal(18)


@pytest.mark.parametrize("zoom_level", ["-1", "22.1"])
def test_map_viewport_rejects_out_of_range_zoom(zoom_level: str) -> None:
    invalid = {"center": VALID_COORDINATE, "zoom_level": zoom_level}

    with pytest.raises(ValidationError):
        MapViewport.model_validate(invalid)


@pytest.mark.parametrize("field", ["center", "zoom_level"])
def test_map_viewport_requires_every_field(field: str) -> None:
    invalid = {"center": VALID_COORDINATE, "zoom_level": "18"}
    invalid.pop(field)

    with pytest.raises(ValidationError):
        MapViewport.model_validate(invalid)


def test_map_viewport_rejects_unknown_fields() -> None:
    invalid = {
        "center": VALID_COORDINATE,
        "zoom_level": "18",
        "provider_camera": {},
    }

    with pytest.raises(ValidationError):
        MapViewport.model_validate(invalid)


def test_roof_polygon_accepts_a_triangle() -> None:
    polygon = RoofPolygon.model_validate(
        {
            "vertices": [
                {"latitude": "10.3157", "longitude": "123.8854"},
                {"latitude": "10.3158", "longitude": "123.8854"},
                {"latitude": "10.3158", "longitude": "123.8855"},
            ]
        }
    )

    assert len(polygon.vertices) == 3


def test_roof_polygon_rejects_fewer_than_three_vertices() -> None:
    invalid = {
        "vertices": [
            {"latitude": "10.3157", "longitude": "123.8854"},
            {"latitude": "10.3158", "longitude": "123.8854"},
        ]
    }

    with pytest.raises(ValidationError):
        RoofPolygon.model_validate(invalid)


def test_roof_polygon_requires_vertices() -> None:
    with pytest.raises(ValidationError):
        RoofPolygon.model_validate({})


def test_roof_polygon_rejects_unknown_fields() -> None:
    invalid = {
        "vertices": [
            {"latitude": "10.3157", "longitude": "123.8854"},
            {"latitude": "10.3158", "longitude": "123.8854"},
            {"latitude": "10.3158", "longitude": "123.8855"},
        ],
        "provider_shape": {},
    }

    with pytest.raises(ValidationError):
        RoofPolygon.model_validate(invalid)


def test_roof_area_accepts_positive_value() -> None:
    area = RoofArea.model_validate({"area_m2": "40.00"})

    assert area.area_m2 == Decimal("40.00")


@pytest.mark.parametrize("area_m2", ["0", "-5"])
def test_roof_area_rejects_non_positive_value(area_m2: str) -> None:
    with pytest.raises(ValidationError):
        RoofArea.model_validate({"area_m2": area_m2})


def test_roof_area_requires_area_m2() -> None:
    with pytest.raises(ValidationError):
        RoofArea.model_validate({})


def test_roof_area_rejects_unknown_fields() -> None:
    invalid = {"area_m2": "40.00", "area_sqft": "430.56"}

    with pytest.raises(ValidationError):
        RoofArea.model_validate(invalid)


def test_property_location_accepts_valid_payload() -> None:
    location = PropertyLocation.model_validate(
        {
            "address": "123 Demo Street, Cebu City, Philippines",
            "coordinate": VALID_COORDINATE,
        }
    )

    assert location.address.startswith("123 Demo Street")


def test_property_location_rejects_empty_address() -> None:
    invalid = {"address": "", "coordinate": VALID_COORDINATE}

    with pytest.raises(ValidationError):
        PropertyLocation.model_validate(invalid)


@pytest.mark.parametrize("field", ["address", "coordinate"])
def test_property_location_requires_every_field(field: str) -> None:
    valid = {
        "address": "123 Demo Street, Cebu City, Philippines",
        "coordinate": VALID_COORDINATE,
    }
    invalid = deepcopy(valid)
    invalid.pop(field)

    with pytest.raises(ValidationError):
        PropertyLocation.model_validate(invalid)


def test_property_location_rejects_unknown_fields() -> None:
    invalid = {
        "address": "123 Demo Street, Cebu City, Philippines",
        "coordinate": VALID_COORDINATE,
        "provider_place_id": "ChIJ123",
    }

    with pytest.raises(ValidationError):
        PropertyLocation.model_validate(invalid)
