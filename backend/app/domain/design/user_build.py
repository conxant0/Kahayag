# Defines manual user builds assembled component-by-component on the canvas.

import uuid

from app.domain.design.bom import (
    _component_from_battery,
    _component_from_inverter,
    _component_from_panel,
    _expand_balance_of_system_lines,
    _is_microinverter,
    sum_component_lines,
    sum_component_lines_at_tier,
)
from app.domain.design.catalog import (
    SolarCatalog,
    get_battery,
    get_inverter,
    get_panel,
    load_catalog,
)
from app.domain.design.entities import DesignBuild, DesignComponent, SolverConstraints
from app.domain.design.financials import (
    build_insight,
    calculate_total_php,
    calculate_vat_php,
    compute_co2_tonnes,
    compute_payback_years,
    compute_savings,
)
from app.domain.design.solver import _evaluate_combo


def _component_catalog_id(
    components: tuple[DesignComponent, ...],
    slot: str,
) -> str | None:
    for component in components:
        if component.slot == slot and component.catalog_id:
            return component.catalog_id
    return None


def _default_panel_count(
    *,
    panel_id: str,
    constraints: SolverConstraints,
    catalog: SolarCatalog,
) -> int:
    panel = get_panel(panel_id, catalog)
    if constraints.seed_panel_count and constraints.seed_panel_count > 0:
        return constraints.seed_panel_count
    if constraints.target_kwp > 0 and panel.wattage_w > 0:
        return max(1, round(constraints.target_kwp * 1000 / panel.wattage_w))
    return 1


def next_user_build_label(existing: tuple[DesignBuild, ...]) -> str:
    count = sum(1 for build in existing if build.source == "user") + 1
    letter = chr(ord("A") + count - 1)
    return f"Your build {letter}"


def next_custom_build_label(existing: tuple[DesignBuild, ...]) -> str:
    count = sum(1 for build in existing if build.source == "custom") + 1
    letter = chr(ord("A") + count - 1)
    return f"Custom build {letter}"


def create_empty_user_build(
    *,
    solve_id: str,
    label: str,
) -> DesignBuild:
    build_id = str(uuid.uuid4())
    return DesignBuild(
        id=build_id,
        label=label,
        tags=("YOUR BUILD",),
        combo_id=f"user:{build_id[:8]}",
        solve_id=solve_id,
        system_kwp=0.0,
        panel_count=0,
        inverter_kw=0.0,
        battery_kwh=None,
        monthly_savings_php=0.0,
        annual_savings_php=0.0,
        payback_years=None,
        total_investment_php=0.0,
        total_investment_low_php=0.0,
        total_investment_high_php=0.0,
        subtotal_php=0.0,
        vat_php=0.0,
        inverter_utilisation_pct=0.0,
        fit_score=0.0,
        co2_tonnes_avoided_yearly=0.0,
        insight="Add components on the diagram to size this build.",
        components=(),
        source="user",
    )


def rebuild_user_build(
    build: DesignBuild,
    *,
    panel_id: str | None,
    inverter_id: str | None,
    battery_id: str | None,
    panel_count: int,
    constraints: SolverConstraints,
    annual_consumption_kwh: float,
    annual_yield_per_kwp_kwh: float,
    resolved_tariff_php_per_kwh: float,
    catalog: SolarCatalog | None = None,
) -> DesignBuild:
    cat = catalog or load_catalog()
    components: list[DesignComponent] = []
    system_kwp = 0.0
    inverter_kw = 0.0
    battery_kwh = None
    fit_score = 0.0
    inverter_utilisation_pct = 0.0
    combo_id = build.combo_id
    insight = "Add components on the diagram to size this build."

    panel = get_panel(panel_id, cat) if panel_id else None
    inverter = get_inverter(inverter_id, cat) if inverter_id else None
    battery = get_battery(battery_id, cat) if battery_id else None
    count = panel_count if panel is not None else 0

    if panel is not None and count > 0:
        components.append(_component_from_panel(panel, count))
        system_kwp = round(panel.wattage_w * count / 1000, 3)

    if inverter is not None:
        qty = count if panel is not None and _is_microinverter(inverter) else 1
        components.append(_component_from_inverter(inverter, qty=qty))
        inverter_kw = round(inverter.rated_ac_output_w / 1000, 2)

    if battery is not None:
        components.append(_component_from_battery(battery))
        battery_kwh = battery.usable_capacity_kwh

    if panel is not None and inverter is not None and count > 0 and system_kwp > 0:
        hybrid = inverter.battery_compatible and battery is not None
        components.extend(
            _expand_balance_of_system_lines(
                system_kwp=system_kwp,
                hybrid=hybrid,
                catalog=cat,
                badges=("INCLUDED",),
            ),
        )
        combo, _rejection = _evaluate_combo(
            panel,
            inverter,
            battery,
            count,
            constraints,
            cat,
            build.combo_id,
        )
        if combo is not None:
            fit_score = combo.fit_score
            inverter_utilisation_pct = combo.inverter_utilisation_pct
            combo_id = combo.combo_id
            monthly_savings, annual_savings = compute_savings(
                system_kwp=system_kwp,
                annual_consumption_kwh=annual_consumption_kwh,
                annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
                resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
            )
            subtotal = sum_component_lines(tuple(components))
            total = calculate_total_php(subtotal)
            payback = compute_payback_years(total, annual_savings)
            insight = build_insight(combo, payback)
        else:
            monthly_savings, annual_savings = compute_savings(
                system_kwp=system_kwp,
                annual_consumption_kwh=annual_consumption_kwh,
                annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
                resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
            )
    else:
        monthly_savings, annual_savings = (0.0, 0.0)

    component_tuple = tuple(components)
    subtotal = sum_component_lines(component_tuple)
    subtotal_low = sum_component_lines_at_tier(component_tuple, "min", catalog=cat)
    subtotal_high = sum_component_lines_at_tier(component_tuple, "max", catalog=cat)
    vat = calculate_vat_php(subtotal)
    total = calculate_total_php(subtotal)
    total_low = calculate_total_php(subtotal_low)
    total_high = calculate_total_php(subtotal_high)
    payback = compute_payback_years(total, annual_savings)

    return DesignBuild(
        id=build.id,
        label=build.label,
        tags=build.tags,
        combo_id=combo_id,
        solve_id=build.solve_id,
        system_kwp=system_kwp,
        panel_count=count,
        inverter_kw=inverter_kw,
        battery_kwh=battery_kwh,
        monthly_savings_php=monthly_savings,
        annual_savings_php=annual_savings,
        payback_years=payback,
        total_investment_php=total,
        total_investment_low_php=total_low,
        total_investment_high_php=total_high,
        subtotal_php=subtotal,
        vat_php=vat,
        inverter_utilisation_pct=inverter_utilisation_pct,
        fit_score=fit_score,
        co2_tonnes_avoided_yearly=compute_co2_tonnes(system_kwp, annual_yield_per_kwp_kwh),
        insight=insight,
        components=component_tuple,
        source="user",
    )


def apply_user_build_component(
    build: DesignBuild,
    *,
    slot: str,
    catalog_id: str,
    constraints: SolverConstraints,
    annual_consumption_kwh: float,
    annual_yield_per_kwp_kwh: float,
    resolved_tariff_php_per_kwh: float,
) -> DesignBuild:
    cat = load_catalog()
    panel_id = _component_catalog_id(build.components, "panel")
    inverter_id = _component_catalog_id(build.components, "inverter")
    battery_id = _component_catalog_id(build.components, "battery")
    panel_count = build.panel_count

    if slot == "panel":
        panel_id = catalog_id
        panel_count = _default_panel_count(
            panel_id=catalog_id,
            constraints=constraints,
            catalog=cat,
        )
    elif slot == "inverter":
        inverter_id = catalog_id
    elif slot == "battery":
        battery_id = catalog_id
    else:
        raise ValueError(f"Unsupported component slot: {slot}")

    return rebuild_user_build(
        build,
        panel_id=panel_id,
        inverter_id=inverter_id,
        battery_id=battery_id,
        panel_count=panel_count,
        constraints=constraints,
        annual_consumption_kwh=annual_consumption_kwh,
        annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
        catalog=cat,
    )
