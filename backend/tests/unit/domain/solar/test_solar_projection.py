# Covers deterministic 25-year investment projection behavior.

from decimal import Decimal

from app.domain.solar.projection import project_investment


def test_projection_preserves_backend_year_one_values_and_degrades_generation() -> None:
    projection = project_investment(
        year_one_generation_kwh=Decimal("4730"),
        baseline_monthly_consumption_kwh=Decimal("500"),
        baseline_rate_php_per_kwh=Decimal("12"),
        baseline_annual_savings_php=22704,
        monthly_consumption_kwh=Decimal("500"),
        rate_php_per_kwh=Decimal("12"),
        system_cost_php=216000,
    )

    assert len(projection.years) == 25
    assert projection.years[0].generation_kwh == Decimal("4730.0")
    assert projection.years[0].annual_savings_php == 22704
    assert projection.years[1].generation_kwh == Decimal("4706.4")
    assert projection.monthly_savings_php == 1892
    assert projection.break_even_year == Decimal("9.7")
    assert projection.year_10_net_php == 5999
    assert projection.year_25_net_php == 318814
    assert projection.lifetime_gross_savings_php == 534814
    assert projection.co2_tonnes_per_year == Decimal("2.1")


def test_projection_recomputes_usage_and_rate_without_linear_frontend_scaling() -> None:
    projection = project_investment(
        year_one_generation_kwh=Decimal("4730"),
        baseline_monthly_consumption_kwh=Decimal("500"),
        baseline_rate_php_per_kwh=Decimal("12"),
        baseline_annual_savings_php=22704,
        monthly_consumption_kwh=Decimal("300"),
        rate_php_per_kwh=Decimal("15"),
        system_cost_php=216000,
    )

    assert projection.annual_savings_php == 21600
    assert projection.monthly_savings_php == 1800


def test_projection_returns_no_break_even_when_savings_never_cover_cost() -> None:
    projection = project_investment(
        year_one_generation_kwh=Decimal("100"),
        baseline_monthly_consumption_kwh=Decimal("500"),
        baseline_rate_php_per_kwh=Decimal("12"),
        baseline_annual_savings_php=480,
        monthly_consumption_kwh=Decimal("500"),
        rate_php_per_kwh=Decimal("12"),
        system_cost_php=1_000_000,
    )

    assert projection.break_even_year is None
    assert projection.year_25_net_php < 0
