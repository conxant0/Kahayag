# Defines normalized shading analysis derived from Solar API building insights.

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from app.domain.shading.errors import InvalidSunshineDataError

ShadingImpact = Literal["low", "moderate", "high", "severe"]

SHADING_LIMITATIONS = (
    "Shading analysis is based on satellite imagery and modeled sunshine, not an on-site survey.",
    "Tree growth, new construction, or seasonal changes may differ from the imagery date.",
)

IMPACT_THRESHOLDS = (
    (Decimal("0.90"), "low"),
    (Decimal("0.75"), "moderate"),
    (Decimal("0.60"), "high"),
)


@dataclass(frozen=True)
class RoofSegmentShading:
    segment_index: int
    center_latitude: float
    center_longitude: float
    area_m2: Decimal
    pitch_degrees: Decimal
    azimuth_degrees: Decimal
    median_sunshine_hours_per_year: Decimal
    max_sunshine_hours_per_year: Decimal
    sunshine_retention_ratio: Decimal


@dataclass(frozen=True)
class ShadingAnalysis:
    query_latitude: float
    query_longitude: float
    building_center_latitude: float
    building_center_longitude: float
    imagery_quality: str
    max_sunshine_hours_per_year: Decimal
    whole_roof_median_sunshine_hours_per_year: Decimal
    whole_roof_min_sunshine_hours_per_year: Decimal
    sunshine_retention_ratio: Decimal
    shading_impact: ShadingImpact
    estimated_generation_derate_ratio: Decimal
    roof_area_m2: Decimal
    roof_segment_count: int
    roof_segments: tuple[RoofSegmentShading, ...]
    data_source: str
    imagery_date: str | None
    limitations: tuple[str, ...]


def _quantize_sunshine(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.1"))


def _clamp_retention_ratio(ratio: Decimal) -> Decimal:
    """Google Solar stats can exceed 1.0 after rounding; treat as unshaded."""
    if ratio > Decimal(1):
        return Decimal(1)
    if ratio < Decimal(0):
        return Decimal(0)
    return ratio


def _median_quantile(quantiles: list[float]) -> float:
    if not quantiles:
        raise InvalidSunshineDataError("sunshineQuantiles must not be empty")
    return quantiles[len(quantiles) // 2]


def classify_shading_impact(retention_ratio: Decimal) -> ShadingImpact:
    for threshold, impact in IMPACT_THRESHOLDS:
        if retention_ratio >= threshold:
            return impact
    return "severe"


def analyze_building_insights(
    *,
    latitude: float,
    longitude: float,
    building_insights: dict,
    data_source: str = "google_solar_api",
) -> ShadingAnalysis:
    solar_potential = building_insights.get("solarPotential")
    if not solar_potential:
        raise InvalidSunshineDataError("building insights missing solarPotential")

    max_sunshine = solar_potential.get("maxSunshineHoursPerYear")
    whole_roof_stats = solar_potential.get("wholeRoofStats")
    if max_sunshine is None or not whole_roof_stats:
        raise InvalidSunshineDataError(
            "building insights missing maxSunshineHoursPerYear or wholeRoofStats"
        )

    quantiles = whole_roof_stats.get("sunshineQuantiles") or []
    if not quantiles:
        raise InvalidSunshineDataError("wholeRoofStats missing sunshineQuantiles")

    median_sunshine = _median_quantile(quantiles)
    min_sunshine = quantiles[0]
    if max_sunshine <= 0:
        raise InvalidSunshineDataError("maxSunshineHoursPerYear must be greater than zero")

    retention_ratio = _clamp_retention_ratio(
        (Decimal(str(median_sunshine)) / Decimal(str(max_sunshine))).quantize(
            Decimal("0.01")
        )
    )
    shading_impact = classify_shading_impact(retention_ratio)

    center = building_insights.get("center") or {}
    imagery_date = _format_imagery_date(building_insights.get("imageryDate"))

    roof_segments = _parse_roof_segments(
        solar_potential.get("roofSegmentStats") or [],
        max_sunshine=max_sunshine,
    )

    return ShadingAnalysis(
        query_latitude=latitude,
        query_longitude=longitude,
        building_center_latitude=float(center.get("latitude", latitude)),
        building_center_longitude=float(center.get("longitude", longitude)),
        imagery_quality=str(building_insights.get("imageryQuality", "UNKNOWN")),
        max_sunshine_hours_per_year=_quantize_sunshine(max_sunshine),
        whole_roof_median_sunshine_hours_per_year=_quantize_sunshine(median_sunshine),
        whole_roof_min_sunshine_hours_per_year=_quantize_sunshine(min_sunshine),
        sunshine_retention_ratio=retention_ratio,
        shading_impact=shading_impact,
        estimated_generation_derate_ratio=retention_ratio,
        roof_area_m2=_quantize_sunshine(float(whole_roof_stats.get("areaMeters2", 0))),
        roof_segment_count=len(roof_segments),
        roof_segments=roof_segments,
        data_source=data_source,
        imagery_date=imagery_date,
        limitations=SHADING_LIMITATIONS,
    )


def _parse_roof_segments(
    segments: list[dict],
    *,
    max_sunshine: float,
) -> tuple[RoofSegmentShading, ...]:
    parsed: list[RoofSegmentShading] = []
    for index, segment in enumerate(segments):
        stats = segment.get("stats") or {}
        quantiles = stats.get("sunshineQuantiles") or []
        if not quantiles:
            continue

        center = segment.get("center") or {}
        center_latitude = center.get("latitude")
        center_longitude = center.get("longitude")
        if center_latitude is None or center_longitude is None:
            continue

        segment_median = _median_quantile(quantiles)
        segment_max = quantiles[-1]
        segment_retention = _clamp_retention_ratio(
            (Decimal(str(segment_median)) / Decimal(str(max_sunshine))).quantize(
                Decimal("0.01")
            )
        )

        parsed.append(
            RoofSegmentShading(
                segment_index=index,
                center_latitude=float(center_latitude),
                center_longitude=float(center_longitude),
                area_m2=_quantize_sunshine(float(stats.get("areaMeters2", 0))),
                pitch_degrees=_quantize_sunshine(float(segment.get("pitchDegrees", 0))),
                azimuth_degrees=_quantize_sunshine(float(segment.get("azimuthDegrees", 0))),
                median_sunshine_hours_per_year=_quantize_sunshine(segment_median),
                max_sunshine_hours_per_year=_quantize_sunshine(segment_max),
                sunshine_retention_ratio=segment_retention,
            )
        )
    return tuple(parsed)


def _format_imagery_date(raw: dict | None) -> str | None:
    if not raw:
        return None
    year = raw.get("year")
    month = raw.get("month")
    day = raw.get("day")
    if year and month and day:
        return f"{year:04d}-{month:02d}-{day:02d}"
    return None
