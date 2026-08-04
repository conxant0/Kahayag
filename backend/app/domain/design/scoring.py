# Defines fit-score ranking for valid design combos.

from app.domain.design.constants import DC_AC_RATIO_MAX, DC_AC_RATIO_MIN
from app.domain.design.entities import SolverConstraints, ValidCombo


def _dc_ac_closeness(dc_ac_ratio: float) -> float:
    midpoint = (DC_AC_RATIO_MIN + DC_AC_RATIO_MAX) / 2
    half_span = (DC_AC_RATIO_MAX - DC_AC_RATIO_MIN) / 2
    distance = abs(dc_ac_ratio - midpoint) / half_span
    return max(0.0, 1.0 - distance)


def compute_fit_score(
    *,
    constraints: SolverConstraints,
    system_kwp: float,
    dc_ac_ratio: float,
    inverter_utilisation_pct: float,
    estimated_cost_php: float,
    annual_offset_ratio: float,
    payback_years: float | None,
) -> float:
    utilisation_score = min(inverter_utilisation_pct, 100.0) / 100.0
    dc_ac_score = _dc_ac_closeness(dc_ac_ratio)
    offset_score = min(annual_offset_ratio, 1.0)

    payback_score = 0.5
    if payback_years is not None and payback_years > 0:
        payback_score = max(0.0, min(1.0, 12.0 / payback_years))

    budget_score = 0.5
    if constraints.budget_php is not None and constraints.budget_php > 0:
        headroom = constraints.budget_php - estimated_cost_php
        budget_score = max(0.0, min(1.0, headroom / constraints.budget_php + 0.5))

    goal = constraints.goal
    if goal == "budget":
        composite = 0.45 * budget_score + 0.25 * payback_score + 0.20 * offset_score
    elif goal == "backup":
        composite = 0.35 * offset_score + 0.30 * utilisation_score + 0.20 * payback_score
    elif goal == "independence":
        composite = 0.40 * offset_score + 0.30 * utilisation_score + 0.20 * dc_ac_score
    else:
        composite = (
            0.25 * payback_score
            + 0.25 * offset_score
            + 0.20 * utilisation_score
            + 0.15 * dc_ac_score
            + 0.15 * budget_score
        )

    return round(composite * 100, 2)


def sort_valid_combos(combos: list[ValidCombo]) -> tuple[ValidCombo, ...]:
    return tuple(
        sorted(
            combos,
            key=lambda combo: (
                -combo.fit_score,
                combo.estimated_cost_php,
                combo.combo_id,
            ),
        )
    )


def _same_equipment_stack(left: ValidCombo, right: ValidCombo) -> bool:
    return (
        left.panel_id == right.panel_id
        and left.inverter_id == right.inverter_id
        and left.battery_id == right.battery_id
    )


def pick_alternate_combo(
    top: ValidCombo,
    valid: tuple[ValidCombo, ...] | list[ValidCombo],
) -> ValidCombo | None:
    for combo in valid:
        if combo.combo_id == top.combo_id:
            continue
        if _same_equipment_stack(combo, top):
            continue
        return combo
    return None
