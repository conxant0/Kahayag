# Defines constraint solver unit tests.

import pytest

from app.domain.design.entities import SolverConstraints
from app.domain.design.rejection import combo_key
from app.domain.design.solver import run_solver


@pytest.fixture
def base_constraints() -> SolverConstraints:
    return SolverConstraints(
        target_kwp=3.6,
        max_panel_count=12,
        usable_roof_area_m2=32.0,
        budget_php=400_000.0,
        require_battery=False,
        min_battery_kwh=None,
        goal="auto",
        annual_consumption_kwh=6000.0,
        resolved_tariff_php_per_kwh=12.0,
        annual_yield_per_kwp_kwh=1314.0,
    )


def test_solver_returns_ranked_valid_combos(base_constraints: SolverConstraints) -> None:
    result = run_solver(base_constraints)
    assert len(result.valid) >= 1
    scores = [combo.fit_score for combo in result.valid]
    assert scores == sorted(scores, reverse=True)


def test_solver_rejects_dc_ac_oversizing(base_constraints: SolverConstraints) -> None:
    tight = SolverConstraints(
        target_kwp=base_constraints.target_kwp,
        max_panel_count=20,
        usable_roof_area_m2=200.0,
        budget_php=2_000_000.0,
        require_battery=False,
        min_battery_kwh=None,
        goal="auto",
        locked_panel_id="panel_002",
        locked_inverter_id="inv_001",
        annual_consumption_kwh=6000.0,
        resolved_tariff_php_per_kwh=12.0,
        annual_yield_per_kwp_kwh=1314.0,
    )
    result = run_solver(tight)
    codes = {rejection.code for rejection in result.rejections}
    assert "dc_ac_oversizing" in codes


def test_solver_rejects_roof_area(base_constraints: SolverConstraints) -> None:
    tiny_roof = SolverConstraints(
        target_kwp=base_constraints.target_kwp,
        max_panel_count=20,
        usable_roof_area_m2=1.0,
        budget_php=2_000_000.0,
        require_battery=False,
        min_battery_kwh=None,
        goal="auto",
        annual_consumption_kwh=6000.0,
        resolved_tariff_php_per_kwh=12.0,
        annual_yield_per_kwp_kwh=1314.0,
    )
    result = run_solver(tiny_roof)
    assert any(rejection.code == "roof_area" for rejection in result.rejections)


def test_combo_key_is_stable() -> None:
    assert combo_key("panel_001", "inv_001", None, 8) == "panel_001:inv_001:none:8"


def test_solver_honors_seed_panel_count(base_constraints: SolverConstraints) -> None:
    seeded = SolverConstraints(
        target_kwp=base_constraints.target_kwp,
        max_panel_count=base_constraints.max_panel_count,
        usable_roof_area_m2=base_constraints.usable_roof_area_m2,
        budget_php=base_constraints.budget_php,
        require_battery=False,
        min_battery_kwh=None,
        goal="auto",
        seed_panel_count=8,
        annual_consumption_kwh=base_constraints.annual_consumption_kwh,
        resolved_tariff_php_per_kwh=base_constraints.resolved_tariff_php_per_kwh,
        annual_yield_per_kwp_kwh=base_constraints.annual_yield_per_kwp_kwh,
    )

    result = run_solver(seeded)

    assert result.valid
    assert all(combo.panel_count == 8 for combo in result.valid)
