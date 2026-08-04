# Defines constraint patch helpers for design mutations.

from dataclasses import replace

from app.domain.design.entities import SolverConstraints, SolverGoal

# Largest single-unit usable capacity in the residential catalog (see batt_004).
_MAX_RESIDENTIAL_BATTERY_KWH = 4.5


def _achievable_battery_kwh(desired_kwh: float) -> float:
    return min(max(3.0, desired_kwh), _MAX_RESIDENTIAL_BATTERY_KWH)


def apply_constraint_patch(
    constraints: SolverConstraints,
    *,
    goal: SolverGoal | None = None,
    budget_php: float | None = None,
    require_battery: bool | None = None,
    min_battery_kwh: float | None = None,
    locked_panel_id: str | None = None,
    locked_inverter_id: str | None = None,
    locked_battery_id: str | None = None,
    panel_count_delta: int | None = None,
    seed_panel_count: int | None = None,
    clear_locks: bool = False,
) -> SolverConstraints:
    updates: dict[str, object] = {}
    if goal is not None:
        updates["goal"] = goal
    if budget_php is not None:
        updates["budget_php"] = budget_php
    if require_battery is not None:
        updates["require_battery"] = require_battery
    if min_battery_kwh is not None:
        updates["min_battery_kwh"] = min_battery_kwh
    if panel_count_delta is not None:
        updates["panel_count_delta"] = panel_count_delta
    if seed_panel_count is not None:
        updates["seed_panel_count"] = seed_panel_count
    if clear_locks:
        updates["locked_panel_id"] = None
        updates["locked_inverter_id"] = None
        updates["locked_battery_id"] = None
    else:
        if locked_panel_id is not None:
            updates["locked_panel_id"] = locked_panel_id
        if locked_inverter_id is not None:
            updates["locked_inverter_id"] = locked_inverter_id
        if locked_battery_id is not None:
            updates["locked_battery_id"] = locked_battery_id
    return replace(constraints, **updates)


def goal_constraints(goal: SolverGoal, base: SolverConstraints) -> SolverConstraints:
    if goal == "budget":
        return replace(base, goal=goal, require_battery=False, min_battery_kwh=None)
    if goal == "backup":
        nightly_kwh = base.annual_consumption_kwh / 365 * 0.3 if base.annual_consumption_kwh > 0 else 0.0
        return replace(
            base,
            goal=goal,
            require_battery=True,
            min_battery_kwh=_achievable_battery_kwh(nightly_kwh or 3.0),
            budget_php=None,
        )
    if goal == "independence":
        nightly_kwh = base.annual_consumption_kwh / 365 * 0.5 if base.annual_consumption_kwh > 0 else 0.0
        return replace(
            base,
            goal=goal,
            require_battery=True,
            min_battery_kwh=_achievable_battery_kwh(max(4.0, nightly_kwh)),
            budget_php=None,
        )
    return replace(base, goal=goal, require_battery=False, min_battery_kwh=None)
