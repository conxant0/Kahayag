# Defines the neutral roof outline read out of a Solar building-insights payload.
#
# The provider's shape stops here. Callers get plain bounding boxes and areas,
# and never see `solarPotential`, `roofSegmentStats`, or the `sw`/`ne` spelling
# the API happens to use.

from typing import Any

# Below this, a "segment" is noise rather than a roof plane worth tracing onto.
_MIN_SEGMENT_AREA_M2 = 4.0


def _coordinate(value: Any) -> tuple[float, float] | None:
    if not isinstance(value, dict):
        return None

    latitude = value.get("latitude")
    longitude = value.get("longitude")
    if not isinstance(latitude, (int, float)) or not isinstance(
        longitude, (int, float)
    ):
        return None

    return float(latitude), float(longitude)


def _bounding_box(value: Any) -> dict[str, float] | None:
    """Normalises the API's `sw`/`ne` corners into named edges."""
    if not isinstance(value, dict):
        return None

    south_west = _coordinate(value.get("sw"))
    north_east = _coordinate(value.get("ne"))
    if south_west is None or north_east is None:
        return None

    south, west = south_west
    north, east = north_east

    # A degenerate box describes no area and cannot seed an outline.
    if south >= north or west >= east:
        return None

    return {"south": south, "west": west, "north": north, "east": east}


def _segment(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    box = _bounding_box(value.get("boundingBox"))
    if box is None:
        return None

    stats = value.get("stats")
    area = stats.get("areaMeters2") if isinstance(stats, dict) else None
    if not isinstance(area, (int, float)) or area < _MIN_SEGMENT_AREA_M2:
        return None

    pitch = value.get("pitchDegrees")
    azimuth = value.get("azimuthDegrees")
    return {
        "bounding_box": box,
        "area_square_meters": float(area),
        "pitch_degrees": float(pitch) if isinstance(pitch, (int, float)) else None,
        "azimuth_degrees": (
            float(azimuth) if isinstance(azimuth, (int, float)) else None
        ),
    }


def extract_roof_outline(payload: Any) -> dict[str, Any] | None:
    """Reads the building's footprint and its roof planes, largest plane first.

    Returns None when the payload carries no usable geometry, which the caller
    reports as "no outline available" rather than guessing one.
    """
    if not isinstance(payload, dict):
        return None

    building_box = _bounding_box(payload.get("boundingBox"))
    centre = _coordinate(payload.get("center"))

    potential = payload.get("solarPotential")
    raw_segments = (
        potential.get("roofSegmentStats") if isinstance(potential, dict) else None
    )
    segments = [
        segment
        for segment in (_segment(item) for item in raw_segments or [])
        if segment is not None
    ]
    # Largest first, so a caller seeding a single outline takes the main roof
    # plane rather than whichever one the API happened to list first.
    segments.sort(key=lambda segment: segment["area_square_meters"], reverse=True)

    if building_box is None and not segments:
        return None

    return {
        "center": (
            {"latitude": centre[0], "longitude": centre[1]}
            if centre is not None
            else None
        ),
        "bounding_box": building_box,
        "segments": segments,
    }
