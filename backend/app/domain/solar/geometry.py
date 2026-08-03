# Defines roof geometry and panel-capacity rules.

import math
from decimal import Decimal

from shapely.geometry import Polygon
from shapely.validation import explain_validity

from app.domain.solar.errors import (
    DegenerateRoofPolygonError,
    InsufficientRoofAreaError,
    SelfIntersectingRoofPolygonError,
)
from app.domain.solar.value_objects import GeoCoordinate, RoofArea, RoofPolygon

_EARTH_RADIUS_M = 6371000.0

# Below this area, floating-point noise in the projection/shoelace math can
# leave a nonzero-but-meaningless residual for a shape that is really
# degenerate (duplicate or collinear vertices). This is a numerical
# tolerance, not a business rule.
_DEGENERATE_AREA_TOLERANCE_M2 = Decimal("0.01")

# Smallest documented panel footprint (docs/calculations_guide.md Section 3.1).
# Usable-area filtering belongs to the tracing UI, so this geometry boundary
# must not apply a second planning derate.
_MIN_PANEL_AREA_M2 = Decimal("1.9888")

# Vertices closer together than this (in meters) are treated as duplicates.
_DUPLICATE_VERTEX_TOLERANCE_M = 1e-6

# Cross-product magnitude (in m^2) below which three points are treated as
# collinear. Real roof vertices are meters apart, so this is far below any
# genuine corner while still absorbing floating-point noise.
_COLLINEARITY_TOLERANCE_M2 = 1e-6


def _to_local_meters(vertex: GeoCoordinate, origin: GeoCoordinate) -> tuple[float, float]:
    """Project a coordinate to a local equirectangular plane centered on `origin`.

    Roof polygons span at most tens of meters, so this flat-earth
    approximation (accurate near the origin latitude) is sufficient and
    avoids depending on a full geodesic projection library.
    """
    lat_rad = math.radians(float(origin.latitude))
    x = (
        _EARTH_RADIUS_M
        * math.radians(float(vertex.longitude - origin.longitude))
        * math.cos(lat_rad)
    )
    y = _EARTH_RADIUS_M * math.radians(float(vertex.latitude - origin.latitude))
    return x, y


def _distinct_points(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Collapse points within `_DUPLICATE_VERTEX_TOLERANCE_M` of an earlier point."""
    distinct: list[tuple[float, float]] = []
    for point in points:
        if not any(
            math.dist(point, kept) < _DUPLICATE_VERTEX_TOLERANCE_M for kept in distinct
        ):
            distinct.append(point)
    return distinct


def _all_collinear(points: list[tuple[float, float]]) -> bool:
    """Check whether every point lies on the line through the first two points."""
    (x0, y0), (x1, y1) = points[0], points[1]
    dx, dy = x1 - x0, y1 - y0
    return all(
        abs(dx * (y - y0) - dy * (x - x0)) <= _COLLINEARITY_TOLERANCE_M2
        for x, y in points[2:]
    )


def _raise_degenerate() -> None:
    raise DegenerateRoofPolygonError(
        "Roof polygon encloses no area; vertices may be duplicated or collinear"
    )


def calculate_roof_area(polygon: RoofPolygon) -> RoofArea:
    """Validate a submitted roof polygon and calculate its traced area.

    The result is the traced polygon area before the tracing UI applies its
    usable-area deduction for edges, access, spacing, ridges, and obstructions.

    Raises DegenerateRoofPolygonError for duplicate or collinear vertices that
    enclose no area, SelfIntersectingRoofPolygonError for edges that
    cross themselves (e.g. a bowtie shape), or InsufficientRoofAreaError for a
    valid shape too small to plausibly fit a solar panel.
    """
    origin = polygon.vertices[0]
    projected = [_to_local_meters(vertex, origin) for vertex in polygon.vertices]

    distinct = _distinct_points(projected)
    if len(distinct) < 3 or _all_collinear(distinct):
        _raise_degenerate()

    shape = Polygon(distinct)
    if not shape.is_valid:
        raise SelfIntersectingRoofPolygonError(
            f"Roof polygon is not a simple polygon: {explain_validity(shape)}"
        )

    area_m2 = Decimal(str(shape.area))
    if area_m2 <= _DEGENERATE_AREA_TOLERANCE_M2:
        _raise_degenerate()
    if area_m2 < _MIN_PANEL_AREA_M2:
        raise InsufficientRoofAreaError(
            f"Roof polygon area ({area_m2} m^2) is too small to fit any solar panel"
        )

    return RoofArea(area_m2=area_m2)


def max_panels_by_roof(
    usable_area_m2: Decimal,
    panel_area_m2: Decimal,
) -> int:
    """Return the panel count for an area already filtered for usability."""
    return int(usable_area_m2 // panel_area_m2)
