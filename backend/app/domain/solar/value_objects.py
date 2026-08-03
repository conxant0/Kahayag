# Defines framework-independent solar-domain values and measurement concepts.

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class GeoCoordinate:
    """A WGS84 coordinate in decimal degrees."""

    latitude: Decimal
    longitude: Decimal


@dataclass(frozen=True)
class RoofPolygon:
    """An ordered ring of coordinates describing one roof boundary."""

    vertices: tuple[GeoCoordinate, ...]


@dataclass(frozen=True)
class RoofArea:
    """A calculated roof area in square meters."""

    area_m2: Decimal
