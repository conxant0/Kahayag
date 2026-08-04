# Defines deterministic mapping from homeowner plan answers to solver inputs.

from dataclasses import dataclass, replace
from typing import Literal

from app.domain.design.constants import DEFAULT_MOUNTING_KIT_ID
from app.domain.design.entities import SolverConstraints, SolverGoal
from app.domain.design.mutations import _achievable_battery_kwh, goal_constraints

PrimaryGoal = Literal[
    "reduce-bill",
    "stay-in-budget",
    "backup-outages",
    "maximize-production",
]
UsagePattern = Literal["daytime", "nighttime", "balanced"]
FutureLoad = Literal["aircon", "ev", "water-pump", "appliances"]
RoofMaterial = Literal["metal", "concrete", "tile", "shingle", "unsure"]

# Monthly kWh planning uplifts for loads the homeowner expects in 3–5 years.
# Applied to annual consumption before sizing; not a measured load profile.
_FUTURE_LOAD_MONTHLY_KWH: dict[FutureLoad, float] = {
    "aircon": 150.0,
    "ev": 300.0,
    "water-pump": 80.0,
    "appliances": 100.0,
}

_ROOF_MOUNTING_KIT: dict[RoofMaterial, str] = {
    "metal": "mount_002",
    "concrete": "mount_003",
    "tile": "mount_001",
    "shingle": "mount_005",
    "unsure": DEFAULT_MOUNTING_KIT_ID,
}

_PRIMARY_GOAL_LABELS: dict[PrimaryGoal, str] = {
    "reduce-bill": "Reduce my bill",
    "stay-in-budget": "Stay within a budget",
    "backup-outages": "Backup for outages",
    "maximize-production": "Maximize production",
}

_USAGE_PATTERN_LABELS: dict[UsagePattern, str] = {
    "daytime": "Mostly daytime",
    "nighttime": "Mostly nighttime",
    "balanced": "About the same",
}

_FUTURE_LOAD_LABELS: dict[FutureLoad, str] = {
    "aircon": "Air conditioner(s)",
    "ev": "Electric vehicle",
    "water-pump": "Water pump",
    "appliances": "More appliances",
}


@dataclass(frozen=True)
class HomeownerPlans:
    primary_goal: PrimaryGoal | None = None
    usage_pattern: UsagePattern | None = None
    future_loads: tuple[FutureLoad, ...] = ()
    roof_material: RoofMaterial | None = None
    property_kind: str | None = None
    owns_property: bool | None = None
    timeline: str | None = None

    def to_context_dict(self) -> dict[str, object]:
        future_labels = [_FUTURE_LOAD_LABELS[load] for load in self.future_loads]
        return {
            "primary_goal": (
                _PRIMARY_GOAL_LABELS[self.primary_goal]
                if self.primary_goal
                else None
            ),
            "usage_pattern": (
                _USAGE_PATTERN_LABELS[self.usage_pattern]
                if self.usage_pattern
                else None
            ),
            "future_loads": future_labels,
            "roof_material": self.roof_material,
            "property_kind": self.property_kind,
            "owns_property": self.owns_property,
            "timeline": self.timeline,
        }


def _member(value: object, allowed: frozenset[str]) -> str | None:
    if isinstance(value, str) and value in allowed:
        return value
    return None


def parse_homeowner_plans(raw: dict[str, object] | None) -> HomeownerPlans | None:
    if not raw:
        return None

    primary_goal = _member(
        raw.get("primary_goal") or raw.get("primaryGoal"),
        frozenset(_PRIMARY_GOAL_LABELS),
    )
    usage_pattern = _member(
        raw.get("usage_pattern") or raw.get("usagePattern"),
        frozenset(_USAGE_PATTERN_LABELS),
    )
    roof_material = _member(
        raw.get("roof_material") or raw.get("roofMaterial"),
        frozenset(_ROOF_MOUNTING_KIT),
    )

    future_raw = raw.get("future_loads") if "future_loads" in raw else raw.get("futureLoads")
    future_loads: tuple[FutureLoad, ...] = ()
    if isinstance(future_raw, list):
        future_loads = tuple(
            load
            for item in future_raw
            if isinstance(item, str)
            and (load := _member(item, frozenset(_FUTURE_LOAD_MONTHLY_KWH))) is not None
        )

    property_kind = raw.get("property_kind") or raw.get("propertyKind")
    owns_property = raw.get("owns_property") if "owns_property" in raw else raw.get("ownsProperty")
    timeline = raw.get("timeline")

    if (
        primary_goal is None
        and usage_pattern is None
        and not future_loads
        and roof_material is None
        and property_kind is None
        and owns_property is None
        and timeline is None
    ):
        return None

    return HomeownerPlans(
        primary_goal=primary_goal,  # type: ignore[arg-type]
        usage_pattern=usage_pattern,  # type: ignore[arg-type]
        future_loads=future_loads,
        roof_material=roof_material,  # type: ignore[arg-type]
        property_kind=str(property_kind) if isinstance(property_kind, str) else None,
        owns_property=owns_property if isinstance(owns_property, bool) else None,
        timeline=str(timeline) if isinstance(timeline, str) else None,
    )


def solver_goal_from_plans(plans: HomeownerPlans | None) -> SolverGoal:
    if plans is None or plans.primary_goal is None:
        return "auto"
    mapping: dict[PrimaryGoal, SolverGoal] = {
        "reduce-bill": "auto",
        "stay-in-budget": "budget",
        "backup-outages": "backup",
        "maximize-production": "auto",
    }
    return mapping[plans.primary_goal]


def adjust_annual_consumption_for_future_loads(
    annual_consumption_kwh: float,
    future_loads: tuple[FutureLoad, ...],
) -> float:
    if not future_loads:
        return annual_consumption_kwh
    uplift = sum(_FUTURE_LOAD_MONTHLY_KWH[load] for load in future_loads) * 12
    return round(annual_consumption_kwh + uplift, 2)


def adjust_target_kwp_for_plans(
    target_kwp: float,
    *,
    max_panel_count: int,
    seed_panel_count: int,
    plans: HomeownerPlans | None,
) -> float:
    if (
        plans is None
        or plans.primary_goal != "maximize-production"
        or seed_panel_count <= 0
    ):
        return target_kwp
    kwp_per_panel = target_kwp / seed_panel_count
    return round(max_panel_count * kwp_per_panel, 3)


def mounting_kit_id_for_roof_material(
    roof_material: RoofMaterial | None,
) -> str:
    if roof_material is None:
        return DEFAULT_MOUNTING_KIT_ID
    return _ROOF_MOUNTING_KIT.get(roof_material, DEFAULT_MOUNTING_KIT_ID)


def _usage_nightly_fraction(usage_pattern: UsagePattern | None) -> float:
    if usage_pattern == "nighttime":
        return 0.5
    if usage_pattern == "balanced":
        return 0.4
    return 0.3


def apply_plans_to_constraints(
    constraints: SolverConstraints,
    plans: HomeownerPlans | None,
) -> SolverConstraints:
    if plans is None:
        return constraints

    goal = solver_goal_from_plans(plans)
    updated = goal_constraints(goal, constraints)

    if not updated.require_battery:
        return updated

    nightly_kwh = (
        updated.annual_consumption_kwh / 365 * _usage_nightly_fraction(plans.usage_pattern)
        if updated.annual_consumption_kwh > 0
        else 0.0
    )
    desired = _achievable_battery_kwh(max(3.0, nightly_kwh or 3.0))
    current = updated.min_battery_kwh or 0.0
    if desired > current:
        updated = replace(updated, min_battery_kwh=desired)
    return updated
