from decimal import Decimal

import pytest

from app.domain.solar.assumptions import PANEL_CATEGORIES
from app.domain.solar.errors import NoFeasibleSystemError
from app.domain.solar.recommendations import (
    build_adjustment_rationale,
    build_budget_shortfall_rationale,
    build_rationale,
    calculate_budget_gap_php,
    classify_adjustment_constraint,
    determine_panel_count,
    max_panels_by_budget,
    max_panels_by_demand,
    validate_layout_panel_count,
)

PANEL = PANEL_CATEGORIES["standard-450"]


@pytest.mark.parametrize(
    ("max_by_roof", "max_by_budget", "max_by_demand", "expected"),
    [
        (10, 4, 8, (4, "budget")),
        (10, None, 4, (4, "demand")),
        (3, None, 8, (3, "roof_area")),
    ],
)
def test_determine_panel_count_uses_lowest_constraint(
    max_by_roof: int,
    max_by_budget: int | None,
    max_by_demand: int,
    expected: tuple[int, str],
) -> None:
    assert (
        determine_panel_count(
            max_by_roof,
            max_by_budget,
            max_by_demand,
            100_000 if max_by_budget is not None else None,
            PANEL,
        )
        == expected
    )


def test_determine_panel_count_returns_one_for_budget_shortfall() -> None:
    assert determine_panel_count(10, 0, 8, 30_000, PANEL) == (1, "budget")


@pytest.mark.parametrize(
    ("max_by_roof", "max_by_budget", "max_by_demand", "expected_constraint"),
    [
        (10, 4, 4, "budget"),
        (4, None, 4, "demand"),
        (4, 4, 4, "budget"),
    ],
)
def test_determine_panel_count_breaks_ties_in_budget_demand_roof_order(
    max_by_roof: int,
    max_by_budget: int | None,
    max_by_demand: int,
    expected_constraint: str,
) -> None:
    _, limiting_constraint = determine_panel_count(
        max_by_roof,
        max_by_budget,
        max_by_demand,
        100_000 if max_by_budget is not None else None,
        PANEL,
    )

    assert limiting_constraint == expected_constraint


@pytest.mark.parametrize("max_by_roof,max_by_demand", [(0, 5), (5, 0)])
def test_determine_panel_count_rejects_infeasible_system(
    max_by_roof: int,
    max_by_demand: int,
) -> None:
    with pytest.raises(NoFeasibleSystemError):
        determine_panel_count(max_by_roof, None, max_by_demand, None, PANEL)


def test_max_panels_by_budget_uses_base_cost() -> None:
    assert max_panels_by_budget(270_000, PANEL.wattage_w) == 10
    assert max_panels_by_budget(None, PANEL.wattage_w) is None


def test_max_panels_by_demand_floors_panel_count() -> None:
    assert max_panels_by_demand(Decimal("2.03"), PANEL.wattage_w) == 4


@pytest.mark.parametrize(
    ("requested", "roof", "budget", "demand", "expected"),
    [
        (1, 10, 0, 5, "budget"),
        (3, 10, 3, 5, "budget"),
        (4, 10, 8, 4, "demand"),
        (5, 5, None, 3, "roof_area"),
        (2, 10, None, 5, "user_selected"),
    ],
)
def test_classify_adjustment_constraint(
    requested: int,
    roof: int,
    budget: int | None,
    demand: int,
    expected: str,
) -> None:
    assert classify_adjustment_constraint(requested, roof, budget, demand) == expected


def test_validate_layout_allows_minimum_estimate_when_budget_covers_zero() -> None:
    validate_layout_panel_count(1, 10, 0, 30_000, PANEL)


def test_validate_layout_rejects_roof_limit() -> None:
    with pytest.raises(NoFeasibleSystemError, match="exceed the usable roof area"):
        validate_layout_panel_count(4, 3, None, None, PANEL)


def test_validate_layout_rejects_budget_limit() -> None:
    with pytest.raises(NoFeasibleSystemError, match="exceed the ₱100,000 budget"):
        validate_layout_panel_count(5, 10, 4, 100_000, PANEL)


def test_build_budget_shortfall_rationale() -> None:
    assert build_budget_shortfall_rationale(PANEL, 30_000, 20_000) == (
        "₱30,000 does not cover a single standard-450 panel. "
        "This is the smallest system we can estimate and is ₱20,000 above your budget."
    )


def test_build_rationale_for_budget_constraint() -> None:
    rationale = build_rationale(
        "budget", 4, Decimal("1.80"), 10, 4, 8, PANEL, 100_000, 0
    )

    assert "stay within budget" in rationale


def test_build_rationale_for_demand_constraint_includes_budget() -> None:
    rationale = build_rationale(
        "demand", 4, Decimal("1.80"), 10, 8, 4, PANEL, 200_000, 0
    )

    assert "match estimated electricity consumption" in rationale
    assert "budget allows" in rationale


def test_build_rationale_for_roof_constraint() -> None:
    rationale = build_rationale(
        "roof_area", 3, Decimal("1.35"), 3, None, 8, PANEL, None, None
    )

    assert "most the usable roof area can fit" in rationale


def test_build_rationale_uses_budget_shortfall_copy() -> None:
    rationale = build_rationale(
        "budget", 1, Decimal("0.45"), 10, 0, 8, PANEL, 30_000, 20_000
    )

    assert rationale == build_budget_shortfall_rationale(PANEL, 30_000, 20_000)


def test_calculate_budget_gap_is_never_negative() -> None:
    assert calculate_budget_gap_php(50_000, 40_000) == 10_000
    assert calculate_budget_gap_php(50_000, 60_000) == 0
    assert calculate_budget_gap_php(50_000, None) is None


def test_build_adjustment_rationale_mentions_demand_cap() -> None:
    rationale = build_adjustment_rationale(
        6, Decimal("2.70"), 10, 8, 4, PANEL, 200_000, 0
    )

    assert "by request" in rationale
    assert "Savings are capped" in rationale


def test_build_adjustment_rationale_uses_budget_shortfall_copy() -> None:
    rationale = build_adjustment_rationale(
        1, Decimal("0.45"), 10, 0, 8, PANEL, 30_000, 20_000
    )

    assert rationale == build_budget_shortfall_rationale(PANEL, 30_000, 20_000)
