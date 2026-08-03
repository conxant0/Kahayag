from math import cos, log, pi, radians, tan

import httpx

from app.features.reports.schemas import GeoPoint

STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap"
MAP_WIDTH = 640
MAP_HEIGHT = 480
MAP_ZOOM = 20


def map_center(points: tuple[GeoPoint, ...]) -> GeoPoint:
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


def fetch_static_map(
    roof_polygon: tuple[GeoPoint, ...], *, api_key: str
) -> bytes | None:
    center = map_center(roof_polygon)
    try:
        response = httpx.get(
            STATIC_MAP_URL,
            params={
                "center": f"{center.latitude},{center.longitude}",
                "zoom": MAP_ZOOM,
                "size": f"{MAP_WIDTH}x{MAP_HEIGHT}",
                "maptype": "satellite",
                "key": api_key,
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
