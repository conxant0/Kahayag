from math import cos, log, pi, radians, tan
from typing import NamedTuple

import httpx

from app.features.reports.schemas import GeoPoint

# Google Static Maps matches the satellite basemap the app itself renders,
# so the PDF's photo agrees with what the homeowner traced on. It needs a
# server-usable key (APP_GOOGLE_MAPS_API_KEY with the Static Maps API
# enabled); without one, or when the call fails, Esri World Imagery's
# keyless export endpoint fills in (attribution required, shared rate
# limit).
GOOGLE_STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap"
STATIC_MAP_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
MAP_WIDTH = 640
MAP_HEIGHT = 480
MAP_ZOOM = 20
_EARTH_RADIUS_M = 6378137


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


def _bounding_box(
    center: GeoPoint, zoom: int = MAP_ZOOM
) -> tuple[float, float, float, float]:
    resolution = (2 * pi * _EARTH_RADIUS_M) / (256 * 2**zoom)
    center_x, center_y = _mercator_meters(center)
    half_width = MAP_WIDTH / 2 * resolution
    half_height = MAP_HEIGHT / 2 * resolution
    return (
        center_x - half_width,
        center_y - half_height,
        center_x + half_width,
        center_y + half_height,
    )


class StaticMapImage(NamedTuple):
    image: bytes
    attribution: str
    # The Web Mercator zoom the image was rendered at. Overlay drawing must
    # project with this same zoom or the roof lands in the wrong place.
    zoom: int


def _fetch_image(url: str, params: dict) -> bytes | None:
    try:
        response = httpx.get(url, params=params, timeout=10.0)
    except httpx.HTTPError:
        return None

    if (
        not response.is_success
        or not response.content
        or not response.headers.get("content-type", "").startswith("image/")
    ):
        return None
    return response.content


def fetch_static_map(
    roof_polygon: tuple[GeoPoint, ...],
    *,
    google_maps_api_key: str = "",
) -> StaticMapImage | None:
    center = map_center(roof_polygon)
    if center is None:
        return None

    if google_maps_api_key:
        image = _fetch_image(
            GOOGLE_STATIC_MAP_URL,
            {
                "center": f"{center.latitude},{center.longitude}",
                "zoom": MAP_ZOOM,
                "size": f"{MAP_WIDTH}x{MAP_HEIGHT}",
                "maptype": "satellite",
                "key": google_maps_api_key,
            },
        )
        if image is not None:
            return StaticMapImage(image, "Imagery: Google", MAP_ZOOM)

    # Esri's export rejects extents finer than the imagery available at the
    # location — Cebu tops out below zoom 20 — so walk down until it serves
    # one rather than giving up and printing the schematic fallback.
    for zoom in (MAP_ZOOM, MAP_ZOOM - 1, MAP_ZOOM - 2):
        xmin, ymin, xmax, ymax = _bounding_box(center, zoom)
        image = _fetch_image(
            STATIC_MAP_URL,
            {
                "bbox": f"{xmin},{ymin},{xmax},{ymax}",
                "bboxSR": 3857,
                "imageSR": 3857,
                "size": f"{MAP_WIDTH},{MAP_HEIGHT}",
                "format": "png",
                "f": "image",
            },
        )
        if image is not None:
            return StaticMapImage(image, "Imagery: Esri World Imagery", zoom)
    return None
