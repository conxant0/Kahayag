# Defines deterministic long-term solar investment projections.

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.domain.solar.assumptions import (
    ANALYSIS_YEARS,
    ANNUAL_PANEL_DEGRADATION_RATIO,
    ELECTRICITY_ESCALATION_RATIO,
    GRID_CO2_KG_PER_KWH,
)


@dataclass(frozen=True)
class ProjectionYear:
    year: int
    generation_kwh: Decimal
    annual_savings_php: int
    cumulative_net_php: int


@dataclass(frozen=True)
class InvestmentProjection:
    years: tuple[ProjectionYear, ...]
    monthly_savings_php: int
    annual_savings_php: int
    co2_tonnes_per_year: Decimal
    break_even_year: Decimal | None
    year_10_net_php: int
    year_25_net_php: int
    lifetime_gross_savings_php: int


def _rounded_int(value: Decimal) -> int:
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def project_investment(
    *,
    year_one_generation_kwh: Decimal,
    baseline_monthly_consumption_kwh: Decimal,
    baseline_rate_php_per_kwh: Decimal,
    baseline_annual_savings_php: int,
    monthly_consumption_kwh: Decimal,
    rate_php_per_kwh: Decimal,
    system_cost_php: int,
    generation_ratio: Decimal = Decimal(1),
    installed_cost_ratio: Decimal = Decimal(1),
) -> InvestmentProjection:
    baseline_self_consumed_kwh = min(
        year_one_generation_kwh,
        baseline_monthly_consumption_kwh * 12,
    )
    baseline_gross_savings = baseline_self_consumed_kwh * baseline_rate_php_per_kwh
    savings_retention_ratio = (
        Decimal(baseline_annual_savings_php) / baseline_gross_savings
        if baseline_gross_savings > 0
        else Decimal(0)
    )
    generation = year_one_generation_kwh * generation_ratio
    annual_consumption_kwh = monthly_consumption_kwh * 12
    installed_cost = Decimal(system_cost_php) * installed_cost_ratio
    cumulative = -installed_cost
    gross_savings = 0
    break_even_year = None
    rows = []

    for year in range(1, ANALYSIS_YEARS + 1):
        escalated_rate = rate_php_per_kwh * (
            Decimal(1) + ELECTRICITY_ESCALATION_RATIO
        ) ** (year - 1)
        annual_savings = _rounded_int(
            min(generation, annual_consumption_kwh)
            * escalated_rate
            * savings_retention_ratio
        )
        previous = cumulative
        cumulative += annual_savings
        gross_savings += annual_savings
        if break_even_year is None and cumulative >= 0 and annual_savings > 0:
            break_even_year = (
                Decimal(year - 1) + (-previous / Decimal(annual_savings))
            ).quantize(Decimal("0.1"))
        rows.append(
            ProjectionYear(
                year=year,
                generation_kwh=generation.quantize(Decimal("0.1")),
                annual_savings_php=annual_savings,
                cumulative_net_php=_rounded_int(cumulative),
            )
        )
        generation *= Decimal(1) - ANNUAL_PANEL_DEGRADATION_RATIO

    return InvestmentProjection(
        years=tuple(rows),
        monthly_savings_php=rows[0].annual_savings_php // 12,
        annual_savings_php=rows[0].annual_savings_php,
        co2_tonnes_per_year=(
            year_one_generation_kwh * GRID_CO2_KG_PER_KWH / 1000
        ).quantize(Decimal("0.1")),
        break_even_year=break_even_year,
        year_10_net_php=rows[9].cumulative_net_php,
        year_25_net_php=rows[-1].cumulative_net_php,
        lifetime_gross_savings_php=gross_savings,
    )
