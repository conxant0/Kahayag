"""Deterministic solar demand calculation rules."""

from dataclasses import dataclass
from decimal import Decimal

from app.domain.solar.assumptions import (
    COST_BASE_PHP_PER_KWP,
    COST_HIGH_PHP_PER_KWP,
    COST_LOW_PHP_PER_KWP,
    DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH,
    PERFORMANCE_RATIO,
)
from app.domain.solar.resource import (
    SolarResource,
    annual_yield_per_kwp_kwh,
    nationwide_fallback_solar_resource,
)


def annualize_kwh(monthly_kwh: Decimal) -> Decimal:
    return monthly_kwh * Decimal(12)


def calculate_system_capacity_kwp(panel_count: int, panel_wattage_w: int) -> Decimal:
    return ((Decimal(panel_count) * panel_wattage_w) / 1000).quantize(Decimal("0.01"))


@dataclass(frozen=True)
class DemandEstimate:
    estimated_monthly_consumption_kwh: Decimal
    annual_consumption_kwh: Decimal
    consumption_limited_system_size_kwp: Decimal
    consumption_source: str
    uses_default_tariff: bool
    resolved_tariff_php_per_kwh: Decimal


def estimate_demand(
    *,
    monthly_bill_php: Decimal | None = None,
    monthly_consumption_kwh: Decimal | None = None,
    electricity_rate_php_per_kwh: Decimal | None = None,
    solar_resource: SolarResource | None = None,
) -> DemandEstimate:
    resolved_tariff_php_per_kwh = (
        electricity_rate_php_per_kwh
        if electricity_rate_php_per_kwh is not None
        else DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH
    )

    if monthly_consumption_kwh is not None:
        if monthly_consumption_kwh <= 0:
            raise ValueError("monthly_consumption_kwh must be greater than zero")
        estimated_monthly_consumption_kwh = monthly_consumption_kwh
        consumption_source = "direct"
        uses_default_tariff = False
    else:
        if monthly_bill_php is None:
            raise ValueError(
                "monthly_bill_php is required when monthly_consumption_kwh is absent"
            )
        if monthly_bill_php <= 0:
            raise ValueError("monthly_bill_php must be greater than zero")
        if resolved_tariff_php_per_kwh <= 0:
            raise ValueError("electricity_rate_php_per_kwh must be greater than zero")

        estimated_monthly_consumption_kwh = (
            monthly_bill_php / resolved_tariff_php_per_kwh
        )
        consumption_source = "bill"
        uses_default_tariff = electricity_rate_php_per_kwh is None

    annual_consumption_kwh = annualize_kwh(estimated_monthly_consumption_kwh)
    yield_per_kwp_kwh = (
        annual_yield_per_kwp_kwh(solar_resource)
        if solar_resource is not None
        else annual_yield_per_kwp_kwh(nationwide_fallback_solar_resource())
    )
    consumption_limited_system_size_kwp = annual_consumption_kwh / yield_per_kwp_kwh

    return DemandEstimate(
        estimated_monthly_consumption_kwh=(estimated_monthly_consumption_kwh),
        annual_consumption_kwh=annual_consumption_kwh,
        consumption_limited_system_size_kwp=(consumption_limited_system_size_kwp),
        consumption_source=consumption_source,
        uses_default_tariff=uses_default_tariff,
        resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
    )


def calculate_annual_generation_kwh(
    system_capacity_kwp: Decimal,
    *,
    solar_resource: SolarResource,
) -> Decimal:
    return (
        system_capacity_kwp * annual_yield_per_kwp_kwh(solar_resource)
    ).quantize(Decimal("1"))


def calculate_consumption_offset_ratio(
    annual_generation_kwh: Decimal,
    annual_consumption_kwh: Decimal,
) -> Decimal:
    return min(Decimal(1), annual_generation_kwh / annual_consumption_kwh).quantize(
        Decimal("0.01")
    )


def calculate_cost_range_php(system_capacity_kwp: Decimal) -> tuple[int, int]:
    return (
        int(system_capacity_kwp * COST_LOW_PHP_PER_KWP),
        int(system_capacity_kwp * COST_HIGH_PHP_PER_KWP),
    )


def calculate_base_cost_php(system_capacity_kwp: Decimal) -> int:
    return int(system_capacity_kwp * COST_BASE_PHP_PER_KWP)


def calculate_annual_savings_php(
    billable_generation_kwh: Decimal,
    electricity_rate_php_per_kwh: Decimal,
) -> int:
    return int(billable_generation_kwh * electricity_rate_php_per_kwh)


def calculate_monthly_savings_php(annual_savings_php: int) -> int:
    return annual_savings_php // 12


def calculate_payback_years(
    estimated_base_cost_php: int,
    annual_savings_php: int,
) -> Decimal | None:
    if annual_savings_php <= 0:
        return None
    return (Decimal(estimated_base_cost_php) / annual_savings_php).quantize(
        Decimal("0.1")
    )
