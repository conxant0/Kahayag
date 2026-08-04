# Defines unit tests for homeowner plan → solver mapping.

from app.domain.design.entities import SolverConstraints
from app.domain.design.plans import (
    adjust_annual_consumption_for_future_loads,
    adjust_target_kwp_for_plans,
    apply_plans_to_constraints,
    mounting_kit_id_for_roof_material,
    parse_homeowner_plans,
    solver_goal_from_plans,
    HomeownerPlans,
)


def _base_constraints(**overrides: object) -> SolverConstraints:
    base = SolverConstraints(
        target_kwp=5.0,
        max_panel_count=12,
        usable_roof_area_m2=40.0,
        budget_php=300_000.0,
        require_battery=False,
        min_battery_kwh=None,
        goal="auto",
        seed_panel_count=10,
        annual_consumption_kwh=6000.0,
        resolved_tariff_php_per_kwh=12.0,
        annual_yield_per_kwp_kwh=1400.0,
    )
    return SolverConstraints(**{**base.__dict__, **overrides})


def test_parse_homeowner_plans_accepts_camel_case() -> None:
    parsed = parse_homeowner_plans(
        {
            "primaryGoal": "backup-outages",
            "usagePattern": "nighttime",
            "futureLoads": ["aircon", "ev"],
            "roofMaterial": "metal",
        },
    )
    assert parsed is not None
    assert parsed.primary_goal == "backup-outages"
    assert parsed.usage_pattern == "nighttime"
    assert parsed.future_loads == ("aircon", "ev")
    assert parsed.roof_material == "metal"


def test_solver_goal_from_plans_maps_primary_goal() -> None:
    plans = HomeownerPlans(primary_goal="backup-outages")
    assert solver_goal_from_plans(plans) == "backup"

    budget_plans = HomeownerPlans(primary_goal="stay-in-budget")
    assert solver_goal_from_plans(budget_plans) == "budget"


def test_future_loads_increase_annual_consumption() -> None:
    adjusted = adjust_annual_consumption_for_future_loads(
        6000.0,
        ("aircon", "ev"),
    )
    assert adjusted == 6000.0 + (150 + 300) * 12


def test_maximize_production_uses_roof_ceiling() -> None:
    plans = HomeownerPlans(primary_goal="maximize-production")
    adjusted = adjust_target_kwp_for_plans(
        4.5,
        max_panel_count=12,
        seed_panel_count=10,
        plans=plans,
    )
    assert adjusted == 5.4


def test_apply_plans_to_constraints_requires_battery_for_backup() -> None:
    plans = HomeownerPlans(primary_goal="backup-outages", usage_pattern="nighttime")
    updated = apply_plans_to_constraints(_base_constraints(), plans)
    assert updated.goal == "backup"
    assert updated.require_battery is True
    assert updated.min_battery_kwh is not None


def test_mounting_kit_id_for_roof_material() -> None:
    assert mounting_kit_id_for_roof_material("metal") == "mount_002"
    assert mounting_kit_id_for_roof_material("concrete") == "mount_003"
    assert mounting_kit_id_for_roof_material(None) == "mount_001"
