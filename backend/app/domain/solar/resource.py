# Defines location-specific solar resource inputs for generation calculations.

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from app.domain.solar.assumptions import PEAK_SUN_HOURS_PER_DAY, PERFORMANCE_RATIO
from app.domain.shading.analysis import ShadingAnalysis

SolarResourceSource = Literal["google_solar_api", "nationwide_fallback"]


@dataclass(frozen=True)
class SolarResource:
    annual_sunshine_hours_per_kwp: Decimal
    peak_sun_hours_per_day: Decimal
    source: SolarResourceSource
    shading_impact: str | None = None
    sunshine_retention_ratio: Decimal | None = None


def nationwide_fallback_solar_resource() -> SolarResource:
    annual_sunshine_hours = PEAK_SUN_HOURS_PER_DAY * Decimal(365)
    return SolarResource(
        annual_sunshine_hours_per_kwp=annual_sunshine_hours,
        peak_sun_hours_per_day=PEAK_SUN_HOURS_PER_DAY,
        source="nationwide_fallback",
    )


def solar_resource_from_shading_analysis(analysis: ShadingAnalysis) -> SolarResource:
    annual_sunshine_hours = analysis.whole_roof_median_sunshine_hours_per_year
    return SolarResource(
        annual_sunshine_hours_per_kwp=annual_sunshine_hours,
        peak_sun_hours_per_day=(annual_sunshine_hours / Decimal(365)).quantize(
            Decimal("0.01")
        ),
        source="google_solar_api",
        shading_impact=analysis.shading_impact,
        sunshine_retention_ratio=analysis.sunshine_retention_ratio,
    )


def annual_yield_per_kwp_kwh(solar_resource: SolarResource) -> Decimal:
    return solar_resource.annual_sunshine_hours_per_kwp * PERFORMANCE_RATIO
