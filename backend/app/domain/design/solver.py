# Defines the design constraint solver — the only equipment picker.

import uuid

from app.domain.design.catalog import (
    CatalogBattery,
    CatalogInverter,
    CatalogPanel,
    SolarCatalog,
    load_catalog,
)
from app.domain.design.constants import (
    DC_AC_RATIO_MAX,
    DC_AC_RATIO_MIN,
    ROOF_SPACING_MARGIN,
)
from app.domain.design.entities import (
    RejectionReason,
    SolverConstraints,
    SolveResult,
    ValidCombo,
)
from app.domain.design.rejection import combo_key, make_rejection
from app.domain.design.scoring import compute_fit_score, sort_valid_combos


def _is_microinverter(inverter: CatalogInverter) -> bool:
    return inverter.rated_ac_output_w < 1000


def _panel_footprint_m2(panel: CatalogPanel) -> float:
    length_m = panel.dimensions_mm["length"] / 1000
    width_m = panel.dimensions_mm["width"] / 1000
    return length_m * width_m * ROOF_SPACING_MARGIN


def _estimate_combo_cost_php(
    panel: CatalogPanel,
    inverter: CatalogInverter,
    battery: CatalogBattery | None,
    panel_count: int,
    system_kwp: float,
    catalog: SolarCatalog,
) -> float:
    inverter_units = panel_count if _is_microinverter(inverter) else 1
    panel_cost = panel.price_php.mid * panel_count
    inverter_cost = inverter.price_php.mid * inverter_units
    battery_cost = battery.price_php.mid if battery else 0.0

    mount = catalog.mounting_kits["mount_001"]
    cable = catalog.cabling["cable_001"]
    install = catalog.misc_bom_items["misc_001"]
    permits = catalog.misc_bom_items["misc_002"]
    protection_id = "prot_002" if inverter.battery_compatible else "prot_001"
    protection = catalog.protections[protection_id]

    mount_cost = (mount.price_php_per_kwp.mid if mount.price_php_per_kwp else 0) * system_kwp
    cable_cost = (cable.price_php_per_kwp.mid if cable.price_php_per_kwp else 0) * system_kwp
    install_cost = (
        install.price_php_per_kwp.mid if install.price_php_per_kwp else 0
    ) * system_kwp
    permits_cost = permits.price_php.mid if permits.price_php else 0
    protection_cost = protection.price_php.mid if protection.price_php else 0

    return (
        panel_cost
        + inverter_cost
        + battery_cost
        + mount_cost
        + cable_cost
        + install_cost
        + permits_cost
        + protection_cost
    )


def _annual_offset_ratio(system_kwp: float, constraints: SolverConstraints) -> float:
    if constraints.annual_consumption_kwh <= 0:
        return 0.0
    annual_generation = system_kwp * constraints.annual_yield_per_kwp_kwh
    return min(1.0, annual_generation / constraints.annual_consumption_kwh)


def _estimate_payback_years(cost_php: float, constraints: SolverConstraints, system_kwp: float) -> float | None:
    if constraints.resolved_tariff_php_per_kwh <= 0:
        return None
    annual_generation = system_kwp * constraints.annual_yield_per_kwp_kwh
    billable = min(annual_generation, constraints.annual_consumption_kwh)
    annual_savings = billable * constraints.resolved_tariff_php_per_kwh
    if annual_savings <= 0:
        return None
    return round(cost_php / annual_savings, 1)


def _can_partition_strings(
    panel_count: int,
    mppt_count: int,
    panel: CatalogPanel,
    inverter: CatalogInverter,
) -> tuple[bool, str]:
    if panel_count < 1:
        return False, "panel_count must be at least 1"

    max_series = int(inverter.mppt_voltage_max_v // panel.voc_v)
    min_series = max(1, int(-(-inverter.mppt_voltage_min_v // panel.vmp_v)))

    if max_series < 1:
        return False, "panel Voc exceeds inverter MPPT maximum"

    if min_series > max_series:
        return False, "no valid series string length for MPPT window"

    if panel_count < min_series:
        return False, f"need at least {min_series} panels for MPPT minimum voltage"

    remaining = panel_count
    strings_used = 0
    while remaining > 0 and strings_used < mppt_count:
        take = min(remaining, max_series)
        if take < min_series and strings_used == 0 and remaining <= mppt_count * max_series:
            take = remaining
        if take < min_series:
            return False, "cannot form valid string within MPPT voltage window"
        if panel.imp_a > inverter.max_input_current_per_mppt_a:
            return False, "panel Imp exceeds inverter max input current per MPPT"
        remaining -= take
        strings_used += 1

    if remaining > 0:
        return False, f"panel count exceeds {mppt_count} MPPT string capacity"

    return True, "ok"


def _evaluate_combo(
    panel: CatalogPanel,
    inverter: CatalogInverter,
    battery: CatalogBattery | None,
    panel_count: int,
    constraints: SolverConstraints,
    catalog: SolarCatalog,
    solve_id: str,
) -> tuple[ValidCombo | None, RejectionReason | None]:
    key = combo_key(panel.id, inverter.id, battery.id if battery else None, panel_count)
    system_kwp = round(panel_count * panel.wattage_w / 1000, 2)
    dc_w = panel_count * panel.wattage_w
    if _is_microinverter(inverter):
        dc_ac_ratio = round(panel.wattage_w / inverter.rated_ac_output_w, 3)
        inverter_utilisation_pct = round(
            min(100.0, panel.wattage_w / inverter.max_dc_input_w * 100), 1
        )
    else:
        dc_ac_ratio = round(dc_w / inverter.rated_ac_output_w, 3)
        inverter_utilisation_pct = round(
            min(100.0, dc_w / inverter.max_dc_input_w * 100), 1
        )

    if constraints.locked_panel_id and panel.id != constraints.locked_panel_id:
        return None, make_rejection(
            key,
            "locked_panel",
            f"Panel {panel.id} does not match locked panel {constraints.locked_panel_id}",
            panel_id=panel.id,
        )

    if constraints.locked_inverter_id and inverter.id != constraints.locked_inverter_id:
        return None, make_rejection(
            key,
            "locked_inverter",
            f"Inverter {inverter.id} does not match locked inverter",
            inverter_id=inverter.id,
        )

    if panel_count > constraints.max_panel_count:
        return None, make_rejection(
            key,
            "max_panel_count",
            f"{panel_count} panels exceeds ceiling {constraints.max_panel_count}",
            panel_count=panel_count,
            max_panel_count=constraints.max_panel_count,
        )

    footprint = _panel_footprint_m2(panel) * panel_count
    if footprint > constraints.usable_roof_area_m2:
        return None, make_rejection(
            key,
            "roof_area",
            f"Footprint {footprint:.1f} m² exceeds usable roof {constraints.usable_roof_area_m2:.1f} m²",
            footprint_m2=round(footprint, 2),
            usable_m2=constraints.usable_roof_area_m2,
        )

    if dc_ac_ratio < DC_AC_RATIO_MIN or dc_ac_ratio > DC_AC_RATIO_MAX:
        return None, make_rejection(
            key,
            "dc_ac_oversizing",
            f"DC:AC ratio {dc_ac_ratio} outside {DC_AC_RATIO_MIN}–{DC_AC_RATIO_MAX} window",
            dc_ac_ratio=dc_ac_ratio,
            min_ratio=DC_AC_RATIO_MIN,
            max_ratio=DC_AC_RATIO_MAX,
        )

    if _is_microinverter(inverter):
        if panel.voc_v > inverter.mppt_voltage_max_v or panel.vmp_v < inverter.mppt_voltage_min_v:
            return None, make_rejection(
                key,
                "mppt_voltage",
                "Single-panel voltage outside microinverter MPPT window",
                voc_v=panel.voc_v,
            )
        if panel.imp_a > inverter.max_input_current_per_mppt_a:
            return None, make_rejection(
                key,
                "input_current",
                "Panel Imp exceeds microinverter max input current",
                imp_a=panel.imp_a,
            )
    else:
        ok_strings, string_reason = _can_partition_strings(
            panel_count, inverter.mppt_count, panel, inverter
        )
        if not ok_strings:
            code = "mppt_voltage" if "MPPT" in string_reason else "input_current"
            return None, make_rejection(
                key,
                code,
                string_reason,
                panel_count=panel_count,
            )

    if inverter.id not in panel.certified_compatible_inverters:
        return None, make_rejection(
            key,
            "panel_inverter_compat",
            f"Panel {panel.id} not certified for inverter {inverter.id}",
            panel_id=panel.id,
            inverter_id=inverter.id,
        )

    if constraints.require_battery:
        if battery is None:
            return None, make_rejection(
                key,
                "battery_required",
                "Battery required for goal but none selected",
            )
        if not inverter.battery_compatible:
            return None, make_rejection(
                key,
                "battery_compat",
                f"Inverter {inverter.id} is not battery-compatible",
                inverter_id=inverter.id,
            )
        if (
            inverter.certified_batteries
            and battery.id not in inverter.certified_batteries
        ):
            return None, make_rejection(
                key,
                "battery_compat",
                f"Battery {battery.id} not certified for inverter {inverter.id}",
                battery_id=battery.id,
                inverter_id=inverter.id,
            )
        if (
            constraints.min_battery_kwh is not None
            and battery.usable_capacity_kwh < constraints.min_battery_kwh
        ):
            return None, make_rejection(
                key,
                "battery_capacity",
                f"Battery {battery.usable_capacity_kwh} kWh below minimum {constraints.min_battery_kwh} kWh",
                usable_kwh=battery.usable_capacity_kwh,
                min_kwh=constraints.min_battery_kwh,
            )
    elif battery is not None and not inverter.battery_compatible:
        return None, make_rejection(
            key,
            "battery_compat",
            f"Cannot pair battery with non-hybrid inverter {inverter.id}",
            inverter_id=inverter.id,
        )

    estimated_cost = _estimate_combo_cost_php(
        panel, inverter, battery, panel_count, system_kwp, catalog
    )

    if constraints.budget_php is not None and estimated_cost > constraints.budget_php:
        return None, make_rejection(
            key,
            "budget",
            f"Estimated cost ₱{estimated_cost:,.0f} exceeds budget ₱{constraints.budget_php:,.0f}",
            estimated_cost_php=round(estimated_cost),
            budget_php=constraints.budget_php,
        )

    offset_ratio = _annual_offset_ratio(system_kwp, constraints)
    payback = _estimate_payback_years(estimated_cost, constraints, system_kwp)
    fit_score = compute_fit_score(
        constraints=constraints,
        system_kwp=system_kwp,
        dc_ac_ratio=dc_ac_ratio,
        inverter_utilisation_pct=inverter_utilisation_pct,
        estimated_cost_php=estimated_cost,
        annual_offset_ratio=offset_ratio,
        payback_years=payback,
    )

    combo = ValidCombo(
        combo_id=key,
        panel_id=panel.id,
        inverter_id=inverter.id,
        battery_id=battery.id if battery else None,
        panel_count=panel_count,
        system_kwp=system_kwp,
        dc_ac_ratio=dc_ac_ratio,
        inverter_utilisation_pct=inverter_utilisation_pct,
        fit_score=fit_score,
        rejection_log_ref=solve_id,
        estimated_cost_php=round(estimated_cost, 2),
    )
    return combo, None


def _panel_count_candidates(constraints: SolverConstraints) -> range:
    base_max = constraints.max_panel_count
    if constraints.panel_count_delta is not None:
        target = max(1, round(constraints.target_kwp * 1000 / 440))
        center = target + constraints.panel_count_delta
        return range(max(1, center - 2), min(base_max, center + 2) + 1)
    target_count = max(1, round(constraints.target_kwp * 1000 / 440))
    low = max(1, target_count - 2)
    high = base_max
    return range(low, high + 1)


def run_solver(
    constraints: SolverConstraints,
    *,
    catalog: SolarCatalog | None = None,
    solve_id: str | None = None,
) -> SolveResult:
    cat = catalog or load_catalog()
    solve_id = solve_id or str(uuid.uuid4())

    valid: list[ValidCombo] = []
    rejections: list[RejectionReason] = []

    panels = list(cat.panels.values())
    inverters = list(cat.inverters.values())
    batteries: list[CatalogBattery | None] = [None, *cat.batteries.values()]

    if constraints.require_battery:
        batteries = list(cat.batteries.values())

    for panel in panels:
        for inverter in inverters:
            for battery in batteries:
                if battery is None and constraints.require_battery:
                    continue
                for panel_count in _panel_count_candidates(constraints):
                    combo, rejection = _evaluate_combo(
                        panel,
                        inverter,
                        battery,
                        panel_count,
                        constraints,
                        cat,
                        solve_id,
                    )
                    if combo is not None:
                        valid.append(combo)
                    elif rejection is not None:
                        rejections.append(rejection)

    return SolveResult(
        solve_id=solve_id,
        constraints=constraints,
        valid=sort_valid_combos(valid),
        rejections=tuple(rejections),
    )


def constraints_from_sizing(
    *,
    target_kwp: float,
    max_panel_count: int,
    usable_roof_area_m2: float,
    budget_php: float | None,
    annual_consumption_kwh: float,
    resolved_tariff_php_per_kwh: float,
    annual_yield_per_kwp_kwh: float,
    goal: str = "auto",
) -> SolverConstraints:
    from app.domain.design.entities import SolverGoal

    typed_goal: SolverGoal = goal if goal in ("auto", "budget", "backup", "independence") else "auto"
    return SolverConstraints(
        target_kwp=target_kwp,
        max_panel_count=max_panel_count,
        usable_roof_area_m2=usable_roof_area_m2,
        budget_php=budget_php,
        require_battery=False,
        min_battery_kwh=None,
        goal=typed_goal,
        annual_consumption_kwh=annual_consumption_kwh,
        resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
        annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
    )
