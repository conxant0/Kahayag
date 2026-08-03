# Defines configuration recommendation and alternative-selection rules.

from decimal import Decimal

from app.domain.solar.assumptions import (
    COST_BASE_PHP_PER_KWP,
    PanelCategory,
)
from app.domain.solar.errors import NoFeasibleSystemError

# Budget affordability is sized against the base cost tier, not the low or
# high tier, per docs/calculations_guide.md Step 7 ("Use the base cost for
# affordability sizing").
def _cost_per_panel_base_php(panel_wattage_w: int) -> Decimal:
    return (Decimal(panel_wattage_w) / 1000) * COST_BASE_PHP_PER_KWP


def max_panels_by_budget(
    budget_php: int | None,
    panel_wattage_w: int,
) -> int | None:
    if budget_php is None:
        return None
    return int(Decimal(budget_php) // _cost_per_panel_base_php(panel_wattage_w))


def max_panels_by_demand(
    consumption_limited_system_size_kwp: Decimal,
    panel_wattage_w: int,
) -> int:
    return int((consumption_limited_system_size_kwp * 1000) // panel_wattage_w)


def determine_panel_count(
    max_by_roof: int,
    max_by_budget: int | None,
    max_by_demand: int,
    budget_php: int | None,
    panel_category: PanelCategory,
) -> tuple[int, str]:
    if max_by_roof < 1:
        raise NoFeasibleSystemError(
            f"The usable roof area cannot fit a single {panel_category.id} panel."
        )
    if max_by_demand < 1:
        raise NoFeasibleSystemError(
            "The estimated electricity consumption cannot justify a single "
            f"{panel_category.id} panel."
        )
    if max_by_budget is not None and max_by_budget < 1:
        return 1, "budget"

    # Budget is checked before demand, and demand before roof, so a tie
    # between constraints resolves toward the one the household controls
    # most directly (docs/calculations_guide.md Step 8's min() has no
    # documented tie-break; this order is ours).
    candidates: list[tuple[str, int]] = []
    if max_by_budget is not None:
        candidates.append(("budget", max_by_budget))
    candidates.append(("demand", max_by_demand))
    candidates.append(("roof_area", max_by_roof))

    limiting_constraint, panel_count = min(
        candidates, key=lambda candidate: candidate[1]
    )
    return panel_count, limiting_constraint


def build_budget_shortfall_rationale(
    panel_category: PanelCategory,
    budget_php: int,
    budget_gap_php: int,
) -> str:
    return (
        f"₱{budget_php:,} does not cover a single {panel_category.id} panel. "
        "This is the smallest system we can estimate and is "
        f"₱{budget_gap_php:,} above your budget."
    )


def build_rationale(
    limiting_constraint: str,
    panel_count: int,
    system_capacity_kwp: Decimal,
    max_by_roof: int,
    max_by_budget: int | None,
    max_by_demand: int,
    panel_category: PanelCategory,
    budget_php: int | None,
    budget_gap_php: int | None,
) -> str:
    if budget_php is not None and budget_gap_php is not None and budget_gap_php > 0:
        return build_budget_shortfall_rationale(
            panel_category, budget_php, budget_gap_php
        )
    if limiting_constraint == "budget":
        return (
            f"Sized to {panel_count} panels ({system_capacity_kwp} kWp) to "
            f"stay within budget ({max_by_budget} panels max); the usable "
            f"roof area could support up to {max_by_roof} panels and "
            f"estimated consumption could use up to {max_by_demand} panels."
        )
    if limiting_constraint == "demand":
        base = (
            f"Sized to {panel_count} panels ({system_capacity_kwp} kWp) to "
            f"match estimated electricity consumption ({max_by_demand} "
            f"panels max); the usable roof area could support up to "
            f"{max_by_roof} panels."
        )
        if max_by_budget is not None:
            base += f" The budget allows for up to {max_by_budget} panels."
        return base
    base = (
        f"Sized to {panel_count} panels ({system_capacity_kwp} kWp), "
        f"the most the usable roof area can fit ({max_by_roof} panels max)."
    )
    if max_by_budget is not None:
        base += f" The budget allows for up to {max_by_budget} panels."
    base += f" Estimated consumption could use up to {max_by_demand} panels."
    return base


def calculate_budget_gap_php(
    estimated_cost_low_php: int,
    budget_php: int | None,
) -> int | None:
    if budget_php is None:
        return None
    return max(0, estimated_cost_low_php - budget_php)


def validate_layout_panel_count(
    requested_panel_count: int,
    max_by_roof: int,
    max_by_budget: int | None,
    budget_php: int | None,
    panel_category: PanelCategory,
) -> None:
    """Layout edits may exceed demand; roof area and budget remain hard limits."""
    if requested_panel_count > max_by_roof:
        raise NoFeasibleSystemError(
            f"{requested_panel_count} panels exceed the usable roof area, "
            f"which fits up to {max_by_roof} {panel_category.id} panels."
        )
    is_minimum_estimate = max_by_budget == 0 and requested_panel_count == 1
    if (
        max_by_budget is not None
        and requested_panel_count > max_by_budget
        and not is_minimum_estimate
    ):
        raise NoFeasibleSystemError(
            f"{requested_panel_count} panels exceed the ₱{budget_php:,} "
            f"budget, which covers up to {max_by_budget} {panel_category.id} "
            f"panels."
        )


def classify_adjustment_constraint(
    requested_panel_count: int,
    max_by_roof: int,
    max_by_budget: int | None,
    max_by_demand: int,
) -> str:
    if max_by_budget == 0 and requested_panel_count == 1:
        return "budget"
    if max_by_budget is not None and requested_panel_count == max_by_budget:
        return "budget"
    if requested_panel_count == max_by_demand:
        return "demand"
    if requested_panel_count == max_by_roof:
        return "roof_area"
    return "user_selected"


def build_adjustment_rationale(
    requested_panel_count: int,
    system_capacity_kwp: Decimal,
    max_by_roof: int,
    max_by_budget: int | None,
    max_by_demand: int,
    panel_category: PanelCategory,
    budget_php: int | None,
    budget_gap_php: int | None,
) -> str:
    if budget_php is not None and budget_gap_php is not None and budget_gap_php > 0:
        return build_budget_shortfall_rationale(
            panel_category, budget_php, budget_gap_php
        )
    base = (
        f"Adjusted to {requested_panel_count} panels "
        f"({system_capacity_kwp} kWp) by request; the usable roof area "
        f"allows up to {max_by_roof} panels and estimated consumption "
        f"allows up to {max_by_demand} panels."
    )
    if max_by_budget is not None:
        base += f" The budget allows up to {max_by_budget} panels."
    if requested_panel_count > max_by_demand:
        base += (
            f" Savings are capped at your estimated electricity use "
            f"({max_by_demand} panels)."
        )
    return base
