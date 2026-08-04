# Defines unit tests for catalog rejection copy.

from app.domain.design.rejection import humanize_catalog_rejection, make_rejection


def test_humanize_dc_ac_ratio_for_battery_slot() -> None:
    rejection = make_rejection(
        "key",
        "dc_ac_oversizing",
        "DC:AC ratio 0.72 outside 1.05–1.3 window",
        dc_ac_ratio=0.72,
        min_ratio=1.05,
        max_ratio=1.3,
    )

    message = humanize_catalog_rejection(rejection, slot="battery")

    assert "hybrid inverter" in message
    assert "inv_" not in message
    assert "DC:AC" not in message


def test_humanize_battery_compat_for_grid_tie_inverter() -> None:
    rejection = make_rejection(
        "key",
        "battery_compat",
        "Inverter inv_005 is not battery-compatible",
        inverter_id="inv_005",
    )

    message = humanize_catalog_rejection(rejection, slot="inverter")

    assert "grid-tie" in message
    assert "inv_005" not in message


def test_humanize_mppt_minimum_panel_count() -> None:
    rejection = make_rejection(
        "key",
        "mppt_voltage",
        "need at least 8 panels for MPPT minimum voltage",
        panel_count=5,
    )

    message = humanize_catalog_rejection(rejection, slot="inverter")

    assert message == "Need at least 8 panels for this inverter's voltage range."


def test_humanize_budget_exceeds_limit() -> None:
    rejection = make_rejection(
        "key",
        "budget",
        "Estimated cost ₱350,000 exceeds budget ₱300,000",
        estimated_cost_php=350000,
        budget_php=300000,
    )

    message = humanize_catalog_rejection(rejection, slot="panel")

    assert "budget" in message.lower()
    assert "₱300,000" in message
