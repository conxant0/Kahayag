from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest

from app.domain.solar.calculations import (
    calculate_annual_generation_kwh,
    calculate_annual_savings_php,
    calculate_base_cost_php,
    calculate_billable_generation_kwh,
    calculate_consumption_offset_ratio,
    calculate_monthly_savings_php,
    calculate_payback_years,
    estimate_demand,
)
from app.domain.solar.resource import SolarResource


def test_estimates_demand_from_bill_with_default_tariff() -> None:
    result = estimate_demand(monthly_bill_php=Decimal("6000"))

    assert result.estimated_monthly_consumption_kwh == Decimal("500")
    assert result.annual_consumption_kwh == Decimal("6000")
    assert (
        result.consumption_limited_system_size_kwp
        == Decimal("6000") / Decimal("1460")
    )
    assert result.consumption_source == "bill"
    assert result.uses_default_tariff is True


def test_estimates_demand_from_bill_with_custom_tariff() -> None:
    result = estimate_demand(
        monthly_bill_php=Decimal("4800"),
        electricity_rate_php_per_kwh=Decimal("10"),
    )

    assert result.estimated_monthly_consumption_kwh == Decimal("480")
    assert result.annual_consumption_kwh == Decimal("5760")
    assert (
        result.consumption_limited_system_size_kwp
        == Decimal("5760") / Decimal("1460")
    )
    assert result.consumption_source == "bill"
    assert result.uses_default_tariff is False


def test_uses_direct_monthly_consumption() -> None:
    result = estimate_demand(monthly_consumption_kwh=Decimal("420.5"))

    assert result.estimated_monthly_consumption_kwh == Decimal("420.5")
    assert result.annual_consumption_kwh == Decimal("5046.0")
    assert (
        result.consumption_limited_system_size_kwp
        == Decimal("5046.0") / Decimal("1460")
    )
    assert result.consumption_source == "direct"
    assert result.uses_default_tariff is False


def test_direct_consumption_ignores_bill_and_tariff() -> None:
    result = estimate_demand(
        monthly_consumption_kwh=Decimal("500"),
        monthly_bill_php=Decimal("-1"),
        electricity_rate_php_per_kwh=Decimal("0"),
    )

    assert result.estimated_monthly_consumption_kwh == Decimal("500")
    assert result.consumption_source == "direct"
    assert result.uses_default_tariff is False


def test_demand_estimate_is_frozen() -> None:
    result = estimate_demand(monthly_consumption_kwh=Decimal("500"))

    with pytest.raises(FrozenInstanceError):
        result.annual_consumption_kwh = Decimal("0")


def test_rejects_missing_consumption_and_bill() -> None:
    with pytest.raises(
        ValueError,
        match="monthly_bill_php is required",
    ):
        estimate_demand()


def test_calculates_monthly_savings_from_annual_savings() -> None:
    assert calculate_monthly_savings_php(65_700) == 5_475


def test_calculates_base_cost_from_system_capacity() -> None:
    assert calculate_base_cost_php(Decimal("2.70")) == 162_000


def test_caps_billable_generation_at_annual_consumption() -> None:
    assert calculate_billable_generation_kwh(
        Decimal("7000"), Decimal("6000")
    ) == Decimal("6000")


def test_calculates_offset_from_self_consumed_energy() -> None:
    assert calculate_consumption_offset_ratio(
        self_consumed_energy_kwh=Decimal("2400"),
        annual_consumption_kwh=Decimal("6000"),
    ) == Decimal("0.40")


def test_rejects_zero_annual_consumption_for_offset() -> None:
    with pytest.raises(
        ValueError,
        match="annual_consumption_kwh must be greater than zero",
    ):
        calculate_consumption_offset_ratio(
            self_consumed_energy_kwh=Decimal("100"),
            annual_consumption_kwh=Decimal("0"),
        )


def test_calculates_annual_savings_from_self_consumed_energy() -> None:
    assert calculate_annual_savings_php(
        self_consumed_energy_kwh=Decimal("2400"),
        electricity_rate_php_per_kwh=Decimal("12"),
    ) == 28_800


def test_generation_uses_explicit_half_even_rounding() -> None:
    resource = SolarResource(
        annual_sunshine_hours_per_kwp=Decimal("3.125"),
        peak_sun_hours_per_day=Decimal("0"),
        source="google_solar_api",
    )

    assert calculate_annual_generation_kwh(
        Decimal("1"), solar_resource=resource
    ) == Decimal("2")


def test_calculates_payback_years() -> None:
    assert calculate_payback_years(162_000, 65_700) == Decimal("2.5")


def test_payback_is_absent_when_savings_are_zero() -> None:
    assert calculate_payback_years(162_000, 0) is None


@pytest.mark.parametrize("value", [Decimal("0"), Decimal("-1")])
def test_rejects_nonpositive_direct_consumption(value: Decimal) -> None:
    with pytest.raises(
        ValueError,
        match="monthly_consumption_kwh must be greater than zero",
    ):
        estimate_demand(monthly_consumption_kwh=value)


@pytest.mark.parametrize("value", [Decimal("0"), Decimal("-1")])
def test_rejects_nonpositive_active_bill(value: Decimal) -> None:
    with pytest.raises(
        ValueError,
        match="monthly_bill_php must be greater than zero",
    ):
        estimate_demand(monthly_bill_php=value)


@pytest.mark.parametrize("value", [Decimal("0"), Decimal("-1")])
def test_rejects_nonpositive_active_tariff(value: Decimal) -> None:
    with pytest.raises(
        ValueError,
        match="electricity_rate_php_per_kwh must be greater than zero",
    ):
        estimate_demand(
            monthly_bill_php=Decimal("6000"),
            electricity_rate_php_per_kwh=value,
        )
