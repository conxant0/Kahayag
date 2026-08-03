from math import cos, log, pi, radians, tan

import httpx

from app.features.reports.schemas import GeoPoint

# Esri World Imagery's export endpoint is keyless satellite tile service
# (attribution required, shared rate limit). Swap for a paid provider
# (Google/Mapbox static maps) if usage outgrows that limit.
STATIC_MAP_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
MAP_WIDTH = 640
MAP_HEIGHT = 480
MAP_ZOOM = 20
_EARTH_RADIUS_M = 6378137
_MERCATOR_RESOLUTION_M_PER_PX = (2 * pi * _EARTH_RADIUS_M) / (256 * 2**MAP_ZOOM)


def map_center(points: tuple[GeoPoint, ...]) -> GeoPoint | None:
    if not points:
        return None
    return GeoPoint(
        latitude=sum(point.latitude for point in points) / len(points),
        longitude=sum(point.longitude for point in points) / len(points),
    )


def mercator_pixel(
    point: GeoPoint,
    *,
    center: GeoPoint,
    zoom: int,
    width: int,
    height: int,
) -> tuple[float, float]:
    scale = 256 * 2**zoom

    def world(coordinate: GeoPoint) -> tuple[float, float]:
        latitude = radians(float(coordinate.latitude))
        return (
            (float(coordinate.longitude) + 180) / 360 * scale,
            (1 - log(tan(latitude) + 1 / cos(latitude)) / pi) / 2 * scale,
        )

    point_x, point_y = world(point)
    center_x, center_y = world(center)
    return width / 2 + point_x - center_x, height / 2 + point_y - center_y


def _mercator_meters(point: GeoPoint) -> tuple[float, float]:
    x = radians(float(point.longitude)) * _EARTH_RADIUS_M
    y = log(tan(pi / 4 + radians(float(point.latitude)) / 2)) * _EARTH_RADIUS_M
    return x, y


def _bounding_box(center: GeoPoint) -> tuple[float, float, float, float]:
    center_x, center_y = _mercator_meters(center)
    half_width = MAP_WIDTH / 2 * _MERCATOR_RESOLUTION_M_PER_PX
    half_height = MAP_HEIGHT / 2 * _MERCATOR_RESOLUTION_M_PER_PX
    return (
        center_x - half_width,
        center_y - half_height,
        center_x + half_width,
        center_y + half_height,
    )


def fetch_static_map(roof_polygon: tuple[GeoPoint, ...]) -> bytes | None:
    center = map_center(roof_polygon)
    if center is None:
        return None
    xmin, ymin, xmax, ymax = _bounding_box(center)
    try:
        response = httpx.get(
            STATIC_MAP_URL,
            params={
                "bbox": f"{xmin},{ymin},{xmax},{ymax}",
                "bboxSR": 3857,
                "imageSR": 3857,
                "size": f"{MAP_WIDTH},{MAP_HEIGHT}",
                "format": "png",
                "f": "image",
            },
            timeout=10.0,
        )
    except httpx.HTTPError:
        return None

    if (
        not response.is_success
        or not response.content
        or not response.headers.get("content-type", "").startswith("image/")
    ):
        return None
    return response.content
