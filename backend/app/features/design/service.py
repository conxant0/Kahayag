# Defines design feature orchestration and domain-to-API mapping.

import hashlib
import uuid
from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal

from app.domain.design.bom import _is_microinverter, expand_combo_to_components
from app.domain.design.catalog import get_inverter, load_catalog
from app.domain.design.constants import PAYMENT_TERMS, QUOTE_VALIDITY_DAYS
from app.domain.design.entities import (
    DesignBuild,
    DesignComponent,
    DesignSession,
    QuotationDocument,
    QuotationLine,
    RejectionReason,
    SolverConstraints,
    SolveResult,
    ValidCombo,
)
from app.domain.design.financials import (
    annual_consumption_from_assessment,
    build_design_build,
)
from app.domain.design.mutations import apply_constraint_patch, goal_constraints
from app.domain.design.plans import (
    adjust_annual_consumption_for_future_loads,
    adjust_target_kwp_for_plans,
    apply_plans_to_constraints,
    mounting_kit_id_for_roof_material,
    parse_homeowner_plans,
    solver_goal_from_plans,
)
from app.domain.design.scoring import pick_swap_combo
from app.domain.design.solver import constraints_from_sizing, run_solver
from app.domain.design.user_build import (
    apply_user_build_component,
    create_empty_user_build,
    next_custom_build_label,
    next_user_build_label,
)
from app.features.design.schemas import (
    AgentAuditEntrySchema,
    BootstrapDesignRequest,
    CreateUserBuildRequest,
    DesignBuildSchema,
    DesignComponentSchema,
    DesignSessionSchema,
    GenerateQuotationRequest,
    ManageBuildRequest,
    MutateDesignRequest,
    OptimiseDesignRequest,
    QuotationDocumentSchema,
    QuotationLineSchema,
    RejectionReasonSchema,
    SolverConstraintsSchema,
    SolveResultSchema,
    UpdateUserBuildComponentRequest,
    ValidComboSchema,
)

MAX_SESSION_REJECTIONS = 200
MANAGEABLE_BUILD_SOURCES = frozenset({"custom", "user"})


class NoValidDesignError(Exception):
    pass


def _fingerprint_assessment(assessment: dict[str, object]) -> str:
    payload = str(sorted(assessment.items()))
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _extract_sizing_inputs(
    assessment: dict[str, object],
) -> tuple[float, int, float, float | None, float, float, float, int]:
    from app.domain.design.catalog import load_catalog
    from app.domain.design.solver import _panel_footprint_m2

    roof = assessment["roof"]
    assert isinstance(roof, dict)
    recommendation = assessment["recommendation"]
    assert isinstance(recommendation, dict)
    inputs = assessment.get("inputs", {})
    assert isinstance(inputs, dict)

    target_kwp = float(Decimal(str(recommendation["system_capacity_kwp"])))
    usable_roof_area_m2 = float(Decimal(str(roof["usable_area_m2"])))
    catalog = load_catalog()
    min_footprint = min(_panel_footprint_m2(panel) for panel in catalog.panels.values())
    max_by_roof = max(1, int(usable_roof_area_m2 // min_footprint))
    recommended_ceiling = int(recommendation["panel_count"]) + 4
    max_panel_count = max(1, min(max_by_roof, recommended_ceiling))
    budget_raw = inputs.get("budget_php")
    budget_php = float(budget_raw) if budget_raw is not None else None

    annual_consumption = annual_consumption_from_assessment(assessment)
    tariff = float(Decimal(str(assessment.get("resolved_tariff_php_per_kwh", "12"))))
    annual_generation = float(Decimal(str(recommendation["annual_generation_kwh"])))
    annual_yield_per_kwp = annual_generation / target_kwp if target_kwp > 0 else 1400.0
    seed_panel_count = int(recommendation["panel_count"])

    return (
        target_kwp,
        max_panel_count,
        usable_roof_area_m2,
        budget_php,
        annual_consumption,
        tariff,
        annual_yield_per_kwp,
        seed_panel_count,
    )


def _to_constraints_schema(constraints: SolverConstraints) -> SolverConstraintsSchema:
    return SolverConstraintsSchema(
        target_kwp=constraints.target_kwp,
        max_panel_count=constraints.max_panel_count,
        usable_roof_area_m2=constraints.usable_roof_area_m2,
        budget_php=constraints.budget_php,
        require_battery=constraints.require_battery,
        min_battery_kwh=constraints.min_battery_kwh,
        goal=constraints.goal,
    )


def _to_rejection_schema(rejection: RejectionReason) -> RejectionReasonSchema:
    return RejectionReasonSchema(
        combo_key=rejection.combo_key,
        code=rejection.code,
        message=rejection.message,
        details=rejection.details,
    )


def _to_valid_combo_schema(combo: ValidCombo) -> ValidComboSchema:
    return ValidComboSchema(
        combo_id=combo.combo_id,
        panel_id=combo.panel_id,
        inverter_id=combo.inverter_id,
        battery_id=combo.battery_id,
        panel_count=combo.panel_count,
        system_kwp=combo.system_kwp,
        dc_ac_ratio=combo.dc_ac_ratio,
        inverter_utilisation_pct=combo.inverter_utilisation_pct,
        fit_score=combo.fit_score,
        rejection_log_ref=combo.rejection_log_ref,
        estimated_cost_php=combo.estimated_cost_php,
    )


def _to_solve_result_schema(result: SolveResult) -> SolveResultSchema:
    return SolveResultSchema(
        solve_id=result.solve_id,
        constraints=_to_constraints_schema(result.constraints),
        valid=tuple(_to_valid_combo_schema(combo) for combo in result.valid),
        rejections=tuple(
            _to_rejection_schema(r)
            for r in result.rejections[:MAX_SESSION_REJECTIONS]
        ),
    )


def _to_component_schema(component: DesignComponent) -> DesignComponentSchema:
    return DesignComponentSchema(
        slot=component.slot,
        catalog_id=component.catalog_id,
        brand=component.brand,
        model=component.model,
        summary=component.summary,
        qty=component.qty,
        unit=component.unit,
        unit_price_php=component.unit_price_php,
        price_as_of=component.price_as_of,
        line_total_php=component.line_total_php,
        warranty_note=component.warranty_note,
        badges=component.badges,
        specs=component.specs,
        product_image=component.product_image,
    )


def _to_build_schema(build: DesignBuild) -> DesignBuildSchema:
    return DesignBuildSchema(
        id=build.id,
        label=build.label,
        tags=build.tags,
        combo_id=build.combo_id,
        solve_id=build.solve_id,
        system_kwp=build.system_kwp,
        panel_count=build.panel_count,
        inverter_kw=build.inverter_kw,
        battery_kwh=build.battery_kwh,
        monthly_savings_php=build.monthly_savings_php,
        annual_savings_php=build.annual_savings_php,
        payback_years=build.payback_years,
        total_investment_php=build.total_investment_php,
        total_investment_low_php=build.total_investment_low_php,
        total_investment_high_php=build.total_investment_high_php,
        subtotal_php=build.subtotal_php,
        vat_php=build.vat_php,
        inverter_utilisation_pct=build.inverter_utilisation_pct,
        fit_score=build.fit_score,
        co2_tonnes_avoided_yearly=build.co2_tonnes_avoided_yearly,
        insight=build.insight,
        components=tuple(_to_component_schema(c) for c in build.components),
        source=build.source,
    )


def _to_session_schema(session: DesignSession) -> DesignSessionSchema:
    return DesignSessionSchema(
        property_ref=session.property_ref,
        assessment_fingerprint=session.assessment_fingerprint,
        active_build_id=session.active_build_id,
        builds=tuple(_to_build_schema(b) for b in session.builds),
        last_solve=_to_solve_result_schema(session.last_solve)
        if session.last_solve
        else None,
        applied=session.applied,
        agent_audit=tuple(
            AgentAuditEntrySchema(
                turn_id=entry.turn_id,
                user_text=entry.user_text,
                tool_calls=entry.tool_calls,
                solve_ids=entry.solve_ids,
                final_build_id=entry.final_build_id,
            )
            for entry in session.agent_audit
        ),
        homeowner_plans=session.homeowner_plans,
    )


def _build_from_combo(
    combo: ValidCombo,
    *,
    solve_id: str,
    label: str,
    tags: tuple[str, ...],
    source: str,
    annual_consumption_kwh: float,
    annual_yield_per_kwp_kwh: float,
    resolved_tariff_php_per_kwh: float,
    ai_suggested: bool = False,
    mounting_kit_id: str | None = None,
) -> DesignBuild:
    components = expand_combo_to_components(
        combo,
        ai_suggested=ai_suggested,
        mounting_kit_id=mounting_kit_id,
    )
    return build_design_build(
        build_id=str(uuid.uuid4()),
        label=label,
        tags=tags,
        combo=combo,
        solve_id=solve_id,
        components=components,
        source=source,
        annual_consumption_kwh=annual_consumption_kwh,
        annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
    )


def _session_from_solve(
    *,
    solve_result: SolveResult,
    property_ref: str,
    assessment_fingerprint: str,
    annual_consumption_kwh: float,
    annual_yield_per_kwp_kwh: float,
    resolved_tariff_php_per_kwh: float,
    homeowner_plans: dict[str, object] | None = None,
    mounting_kit_id: str | None = None,
) -> DesignSession:
    if len(solve_result.valid) < 1:
        raise NoValidDesignError("Solver found no valid equipment combinations.")

    top = solve_result.valid[0]
    ai_build = _build_from_combo(
        top,
        solve_id=solve_result.solve_id,
        label="AI suggested",
        tags=("BEST ALL-ROUND",),
        source="ai_suggested",
        annual_consumption_kwh=annual_consumption_kwh,
        annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
        ai_suggested=True,
        mounting_kit_id=mounting_kit_id,
    )

    return DesignSession(
        property_ref=property_ref,
        assessment_fingerprint=assessment_fingerprint,
        active_build_id=ai_build.id,
        builds=(ai_build,),
        last_solve=solve_result,
        applied=False,
        homeowner_plans=homeowner_plans,
    )


def _mounting_kit_from_session(session: DesignSessionSchema) -> str | None:
    if session.homeowner_plans:
        roof_material = session.homeowner_plans.get("roof_material")
        if isinstance(roof_material, str):
            return mounting_kit_id_for_roof_material(roof_material)  # type: ignore[arg-type]

    active = next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0],
    )
    for component in active.components:
        if component.slot == "structure" and component.catalog_id:
            return component.catalog_id
    return None


def _component_catalog_id(build: DesignBuildSchema, slot: str) -> str | None:
    for component in build.components:
        if component.slot == slot and component.catalog_id:
            return component.catalog_id
    return None


def _swap_failure_message(swap_slot: str, *, prefer_cheaper: bool) -> str:
    slot_label = {
        "panel": "panel",
        "inverter": "inverter",
        "battery": "battery",
    }[swap_slot]
    if prefer_cheaper:
        return f"No cheaper compatible {slot_label} is available for the rest of this build."
    return f"No compatible alternate {slot_label} is available for the rest of this build."


def _inverter_line_cost_mid(inverter, panel_count: int) -> float:
    qty = panel_count if _is_microinverter(inverter) else 1
    return inverter.price_php.mid * qty


def _active_inverter_line_cost(active: DesignBuildSchema) -> float | None:
    for component in active.components:
        if component.slot == "inverter":
            return component.line_total_php
    return None


def _pick_cheaper_inverter_combo(
    valid: tuple[ValidCombo, ...],
    *,
    active: DesignBuildSchema,
    current_inverter_id: str,
) -> ValidCombo | None:
    catalog = load_catalog()
    current_inverter = get_inverter(current_inverter_id, catalog)
    current_panel_id = _component_catalog_id(active, "panel")
    current_battery_id = _component_catalog_id(active, "battery")
    current_inverter_line = _active_inverter_line_cost(active)
    if current_inverter_line is None:
        current_inverter_line = _inverter_line_cost_mid(
            current_inverter,
            active.panel_count,
        )

    candidates: list[ValidCombo] = []
    for combo in valid:
        if combo.inverter_id == current_inverter_id:
            continue
        if current_panel_id and combo.panel_id != current_panel_id:
            continue
        if combo.panel_count != active.panel_count:
            continue
        if current_battery_id and combo.battery_id != current_battery_id:
            continue
        if current_battery_id is None and combo.battery_id is not None:
            continue
        if combo.estimated_cost_php >= active.total_investment_php:
            continue
        inverter = get_inverter(combo.inverter_id, catalog)
        candidate_line = _inverter_line_cost_mid(inverter, combo.panel_count)
        if candidate_line >= current_inverter_line:
            continue
        candidates.append(combo)

    if not candidates:
        return None
    return min(
        candidates,
        key=lambda combo: (
            combo.estimated_cost_php,
            _inverter_line_cost_mid(
                get_inverter(combo.inverter_id, catalog),
                combo.panel_count,
            ),
            -combo.fit_score,
        ),
    )


def _session_with_custom_build(
    *,
    existing: DesignSessionSchema,
    solve_result: SolveResult,
    annual_consumption_kwh: float,
    annual_yield_per_kwp_kwh: float,
    resolved_tariff_php_per_kwh: float,
    selected_combo: ValidCombo | None = None,
) -> DesignSessionSchema:
    if len(solve_result.valid) < 1:
        raise NoValidDesignError("Solver found no valid equipment combinations.")

    preserved = tuple(build for build in existing.builds if build.source != "custom")
    if not preserved:
        raise NoValidDesignError("Session has no builds to preserve.")

    top = selected_combo or solve_result.valid[0]
    custom_build = _build_from_combo(
        top,
        solve_id=solve_result.solve_id,
        label="Custom build A",
        tags=("ALTERNATE",),
        source="custom",
        annual_consumption_kwh=annual_consumption_kwh,
        annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
        mounting_kit_id=_mounting_kit_from_session(existing),
    )

    return existing.model_copy(
        update={
            "builds": preserved + (_to_build_schema(custom_build),),
            "active_build_id": custom_build.id,
            "last_solve": _to_solve_result_schema(solve_result),
            "applied": False,
        }
    )


def bootstrap_design_session(request: BootstrapDesignRequest) -> DesignSessionSchema:
    homeowner_plans = parse_homeowner_plans(request.plans)
    (
        target_kwp,
        max_panel_count,
        usable_roof_area_m2,
        budget_php,
        annual_consumption,
        tariff,
        annual_yield,
        seed_panel_count,
    ) = _extract_sizing_inputs(request.assessment)

    if homeowner_plans is not None:
        annual_consumption = adjust_annual_consumption_for_future_loads(
            annual_consumption,
            homeowner_plans.future_loads,
        )

    target_kwp = adjust_target_kwp_for_plans(
        target_kwp,
        max_panel_count=max_panel_count,
        seed_panel_count=seed_panel_count,
        plans=homeowner_plans,
    )

    initial_goal = solver_goal_from_plans(homeowner_plans)

    constraints = constraints_from_sizing(
        target_kwp=target_kwp,
        max_panel_count=max_panel_count,
        usable_roof_area_m2=usable_roof_area_m2,
        budget_php=budget_php,
        annual_consumption_kwh=annual_consumption,
        resolved_tariff_php_per_kwh=tariff,
        annual_yield_per_kwp_kwh=annual_yield,
        goal=initial_goal,
        seed_panel_count=seed_panel_count,
    )
    constraints = apply_plans_to_constraints(constraints, homeowner_plans)
    mounting_kit_id = mounting_kit_id_for_roof_material(
        homeowner_plans.roof_material if homeowner_plans else None,
    )

    solve_result = run_solver(constraints)
    if not solve_result.valid:
        solve_result = run_solver(replace(constraints, seed_panel_count=None))
    if not solve_result.valid and budget_php is not None:
        relaxed = replace(constraints, budget_php=None)
        solve_result = run_solver(relaxed)
        if not solve_result.valid:
            solve_result = run_solver(replace(relaxed, seed_panel_count=None))

    plans_context = (
        homeowner_plans.to_context_dict() if homeowner_plans is not None else None
    )

    session = _session_from_solve(
        solve_result=solve_result,
        property_ref=request.property_ref,
        assessment_fingerprint=_fingerprint_assessment(request.assessment),
        annual_consumption_kwh=annual_consumption,
        annual_yield_per_kwp_kwh=annual_yield,
        resolved_tariff_php_per_kwh=tariff,
        homeowner_plans=plans_context,
        mounting_kit_id=mounting_kit_id,
    )
    return _to_session_schema(session)


def _domain_constraints_from_session(
    base: SolverConstraintsSchema,
    *,
    session: DesignSessionSchema,
) -> SolverConstraints:
    active = next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0],
    )
    tariff = 12.0
    annual_consumption = 6000.0
    annual_yield = 1400.0
    if active.system_kwp > 0 and active.annual_savings_php > 0:
        annual_consumption = max(
            active.system_kwp * annual_yield * 0.85,
            active.annual_savings_php / tariff,
        )
        annual_yield = max(annual_yield, active.annual_savings_php / tariff / active.system_kwp)

    return SolverConstraints(
        target_kwp=base.target_kwp,
        max_panel_count=base.max_panel_count,
        usable_roof_area_m2=base.usable_roof_area_m2,
        budget_php=base.budget_php,
        require_battery=base.require_battery,
        min_battery_kwh=base.min_battery_kwh,
        goal=base.goal,
        annual_consumption_kwh=annual_consumption,
        resolved_tariff_php_per_kwh=tariff,
        annual_yield_per_kwp_kwh=annual_yield,
    )


def optimise_design_session(request: OptimiseDesignRequest) -> DesignSessionSchema:
    if request.session.last_solve is None:
        raise NoValidDesignError("Session has no prior solve to optimise from.")

    domain_constraints = _domain_constraints_from_session(
        request.session.last_solve.constraints,
        session=request.session,
    )
    updated = goal_constraints(request.goal, domain_constraints)
    solve_result = run_solver(updated)
    if not solve_result.valid and updated.budget_php is not None:
        solve_result = run_solver(replace(updated, budget_php=None))

    annual_consumption = domain_constraints.annual_consumption_kwh
    tariff = domain_constraints.resolved_tariff_php_per_kwh
    annual_yield = domain_constraints.annual_yield_per_kwp_kwh

    session = _session_from_solve(
        solve_result=solve_result,
        property_ref=request.session.property_ref,
        assessment_fingerprint=request.session.assessment_fingerprint,
        annual_consumption_kwh=annual_consumption,
        annual_yield_per_kwp_kwh=annual_yield,
        resolved_tariff_php_per_kwh=tariff,
        homeowner_plans=request.session.homeowner_plans,
        mounting_kit_id=_mounting_kit_from_session(request.session),
    )
    if not session.builds:
        raise NoValidDesignError("Solver found no valid equipment combinations.")
    return _to_session_schema(session)


def mutate_design_session(request: MutateDesignRequest) -> DesignSessionSchema:
    if request.session.last_solve is None:
        raise NoValidDesignError("Session has no prior solve to mutate.")

    base = request.session.last_solve.constraints
    domain_constraints = _domain_constraints_from_session(
        base,
        session=request.session,
    )
    patched = apply_constraint_patch(
        domain_constraints,
        goal=request.goal,
        budget_php=request.budget_php,
        require_battery=request.require_battery,
        min_battery_kwh=request.min_battery_kwh,
        locked_panel_id=request.locked_panel_id,
        locked_inverter_id=request.locked_inverter_id,
        locked_battery_id=request.locked_battery_id,
        panel_count_delta=request.panel_count_delta,
        seed_panel_count=request.seed_panel_count,
    )
    solve_result = run_solver(patched)
    if not solve_result.valid and patched.budget_php is not None:
        solve_result = run_solver(replace(patched, budget_php=None))
    if not solve_result.valid:
        raise NoValidDesignError("Solver found no valid equipment combinations.")

    selected_combo: ValidCombo | None = None
    if request.swap_slot:
        active = next(
            (build for build in request.session.builds if build.id == request.session.active_build_id),
            None,
        )
        if active is None:
            raise NoValidDesignError("Session has no active build to swap from.")
        prefer_cheaper = (
            request.prefer_cheaper
            if request.prefer_cheaper is not None
            else request.goal == "budget"
        )
        current_inverter_id = _component_catalog_id(active, "inverter")
        if (
            request.swap_slot == "inverter"
            and prefer_cheaper
            and current_inverter_id is not None
        ):
            selected_combo = _pick_cheaper_inverter_combo(
                solve_result.valid,
                active=active,
                current_inverter_id=current_inverter_id,
            )
        else:
            valid_combos = solve_result.valid
            if prefer_cheaper:
                valid_combos = tuple(
                    combo
                    for combo in solve_result.valid
                    if combo.estimated_cost_php < active.total_investment_php
                )
            selected_combo = pick_swap_combo(
                valid_combos,
                swap_slot=request.swap_slot,
                current_panel_id=_component_catalog_id(active, "panel"),
                current_inverter_id=current_inverter_id,
                current_battery_id=_component_catalog_id(active, "battery"),
                current_panel_count=active.panel_count,
                prefer_cheaper=prefer_cheaper,
            )
        if selected_combo is None:
            raise NoValidDesignError(
                _swap_failure_message(request.swap_slot, prefer_cheaper=prefer_cheaper),
            )
        if request.swap_slot == "inverter":
            if (
                current_inverter_id is not None
                and selected_combo.inverter_id == current_inverter_id
            ):
                raise NoValidDesignError(
                    _swap_failure_message("inverter", prefer_cheaper=prefer_cheaper),
                )
            active_panel_id = _component_catalog_id(active, "panel")
            if (
                active_panel_id is not None
                and selected_combo.panel_id != active_panel_id
            ):
                raise NoValidDesignError(
                    "No cheaper inverter is available without changing your panels.",
                )

    return _session_with_custom_build(
        existing=request.session,
        solve_result=solve_result,
        annual_consumption_kwh=domain_constraints.annual_consumption_kwh,
        annual_yield_per_kwp_kwh=domain_constraints.annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=domain_constraints.resolved_tariff_php_per_kwh,
        selected_combo=selected_combo,
    )


def create_user_build_session(request: CreateUserBuildRequest) -> DesignSessionSchema:
    if request.session.last_solve is None:
        raise NoValidDesignError("Session has no prior solve to branch from.")

    user_count = sum(1 for build in request.session.builds if build.source == "user")
    label = f"Your build {chr(ord('A') + user_count)}"
    user_build = create_empty_user_build(
        solve_id=request.session.last_solve.solve_id,
        label=label,
    )
    user_build_schema = _to_build_schema(user_build)
    return request.session.model_copy(
        update={
            "builds": request.session.builds + (user_build_schema,),
            "active_build_id": user_build_schema.id,
            "applied": False,
        },
    )


def update_user_build_component_session(
    request: UpdateUserBuildComponentRequest,
) -> DesignSessionSchema:
    if request.session.last_solve is None:
        raise NoValidDesignError("Session has no prior solve to update from.")

    target = next(
        (build for build in request.session.builds if build.id == request.build_id),
        None,
    )
    if target is None:
        raise NoValidDesignError(f"Build {request.build_id} not found in session.")
    if target.source != "user":
        raise NoValidDesignError("Only user builds can be edited component-by-component.")

    domain_target = DesignBuild(
        id=target.id,
        label=target.label,
        tags=target.tags,
        combo_id=target.combo_id,
        solve_id=target.solve_id,
        system_kwp=target.system_kwp,
        panel_count=target.panel_count,
        inverter_kw=target.inverter_kw,
        battery_kwh=target.battery_kwh,
        monthly_savings_php=target.monthly_savings_php,
        annual_savings_php=target.annual_savings_php,
        payback_years=target.payback_years,
        total_investment_php=target.total_investment_php,
        total_investment_low_php=target.total_investment_low_php,
        total_investment_high_php=target.total_investment_high_php,
        subtotal_php=target.subtotal_php,
        vat_php=target.vat_php,
        inverter_utilisation_pct=target.inverter_utilisation_pct,
        fit_score=target.fit_score,
        co2_tonnes_avoided_yearly=target.co2_tonnes_avoided_yearly,
        insight=target.insight,
        components=tuple(
            DesignComponent(
                slot=component.slot,
                catalog_id=component.catalog_id,
                brand=component.brand,
                model=component.model,
                summary=component.summary,
                qty=component.qty,
                unit=component.unit,
                unit_price_php=component.unit_price_php,
                price_as_of=component.price_as_of,
                line_total_php=component.line_total_php,
                warranty_note=component.warranty_note,
                badges=component.badges,
                specs=component.specs,
                product_image=component.product_image,
            )
            for component in target.components
        ),
        source=target.source,
    )
    domain_constraints = replace(
        _domain_constraints_from_session(
            request.session.last_solve.constraints,
            session=request.session,
        ),
        seed_panel_count=next(
            (
                build.panel_count
                for build in request.session.builds
                if build.source == "ai_suggested" and build.panel_count > 0
            ),
            next(
                (build.panel_count for build in request.session.builds if build.panel_count > 0),
                None,
            ),
        ),
    )
    updated_build = apply_user_build_component(
        domain_target,
        slot=request.slot,
        catalog_id=request.catalog_id,
        constraints=domain_constraints,
        annual_consumption_kwh=domain_constraints.annual_consumption_kwh,
        annual_yield_per_kwp_kwh=domain_constraints.annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=domain_constraints.resolved_tariff_php_per_kwh,
    )
    updated_schema = _to_build_schema(updated_build)
    builds = tuple(
        updated_schema if build.id == updated_schema.id else build
        for build in request.session.builds
    )
    return request.session.model_copy(
        update={
            "builds": builds,
            "active_build_id": updated_schema.id,
            "applied": False,
        },
    )


def _schema_builds_as_domain(builds: tuple[DesignBuildSchema, ...]) -> tuple[DesignBuild, ...]:
    return tuple(
        DesignBuild(
            id=build.id,
            label=build.label,
            tags=build.tags,
            combo_id=build.combo_id,
            solve_id=build.solve_id,
            system_kwp=build.system_kwp,
            panel_count=build.panel_count,
            inverter_kw=build.inverter_kw,
            battery_kwh=build.battery_kwh,
            monthly_savings_php=build.monthly_savings_php,
            annual_savings_php=build.annual_savings_php,
            payback_years=build.payback_years,
            total_investment_php=build.total_investment_php,
            total_investment_low_php=build.total_investment_low_php,
            total_investment_high_php=build.total_investment_high_php,
            subtotal_php=build.subtotal_php,
            vat_php=build.vat_php,
            inverter_utilisation_pct=build.inverter_utilisation_pct,
            fit_score=build.fit_score,
            co2_tonnes_avoided_yearly=build.co2_tonnes_avoided_yearly,
            insight=build.insight,
            components=tuple(
                DesignComponent(
                    slot=component.slot,
                    catalog_id=component.catalog_id,
                    brand=component.brand,
                    model=component.model,
                    summary=component.summary,
                    qty=component.qty,
                    unit=component.unit,
                    unit_price_php=component.unit_price_php,
                    price_as_of=component.price_as_of,
                    line_total_php=component.line_total_php,
                    warranty_note=component.warranty_note,
                    badges=component.badges,
                    specs=component.specs,
                    product_image=component.product_image,
                )
                for component in build.components
            ),
            source=build.source,
        )
        for build in builds
    )


def _duplicate_build_schema(
    build: DesignBuildSchema,
    *,
    label: str,
) -> DesignBuildSchema:
    new_id = str(uuid.uuid4())
    return build.model_copy(
        update={
            "id": new_id,
            "label": label,
            "combo_id": f"{build.source}:{new_id[:8]}",
        },
    )


def _fallback_active_build_id(
    builds: tuple[DesignBuildSchema, ...],
    *,
    excluded_id: str,
) -> str:
    remaining = tuple(build for build in builds if build.id != excluded_id)
    if not remaining:
        raise NoValidDesignError("Session must keep at least one build.")
    preferred = next(
        (build for build in remaining if build.source == "ai_suggested"),
        None,
    )
    return (preferred or remaining[0]).id


def duplicate_build_session(request: ManageBuildRequest) -> DesignSessionSchema:
    target = next(
        (build for build in request.session.builds if build.id == request.build_id),
        None,
    )
    if target is None:
        raise NoValidDesignError(f"Build {request.build_id} not found in session.")
    if target.source not in MANAGEABLE_BUILD_SOURCES:
        raise NoValidDesignError("Only custom and user builds can be duplicated.")

    domain_builds = _schema_builds_as_domain(request.session.builds)
    if target.source == "user":
        label = next_user_build_label(domain_builds)
    else:
        label = next_custom_build_label(domain_builds)

    duplicate = _duplicate_build_schema(target, label=label)
    return request.session.model_copy(
        update={
            "builds": request.session.builds + (duplicate,),
            "active_build_id": duplicate.id,
            "applied": False,
        },
    )


def delete_build_session(request: ManageBuildRequest) -> DesignSessionSchema:
    target = next(
        (build for build in request.session.builds if build.id == request.build_id),
        None,
    )
    if target is None:
        raise NoValidDesignError(f"Build {request.build_id} not found in session.")
    if target.source not in MANAGEABLE_BUILD_SOURCES:
        raise NoValidDesignError("Only custom and user builds can be deleted.")
    if len(request.session.builds) <= 1:
        raise NoValidDesignError("Cannot delete the last build in the session.")

    remaining = tuple(
        build for build in request.session.builds if build.id != request.build_id
    )
    active_build_id = request.session.active_build_id
    if active_build_id == request.build_id:
        active_build_id = _fallback_active_build_id(
            request.session.builds,
            excluded_id=request.build_id,
        )

    return request.session.model_copy(
        update={
            "builds": remaining,
            "active_build_id": active_build_id,
            "applied": False,
        },
    )


def get_rejections_for_solve(
    solve_id: str,
    *,
    session: DesignSessionSchema | None = None,
) -> tuple[RejectionReasonSchema, ...]:
    if session is None or session.last_solve is None:
        return ()
    if session.last_solve.solve_id != solve_id:
        return ()
    return session.last_solve.rejections


def generate_quotation(request: GenerateQuotationRequest) -> QuotationDocumentSchema:
    build = next(
        (candidate for candidate in request.session.builds if candidate.id == request.build_id),
        None,
    )
    if build is None:
        raise NoValidDesignError(f"Build {request.build_id} not found in session.")

    return compose_quotation(build)


def compose_quotation(build: DesignBuildSchema) -> QuotationDocumentSchema:
    """Composes the quotation document for a build. The PDF report reuses
    this so a quote rendered into the report is authored by the same domain
    path as the one served on /quotation, never re-stated by the client."""
    lines = tuple(
        QuotationLine(
            item=component.summary,
            description=f"{component.brand} {component.model}",
            brand=component.brand,
            uom=component.unit,
            qty=component.qty,
            unit_price_php=component.unit_price_php,
            amount_php=component.line_total_php,
            price_as_of=component.price_as_of,
        )
        for component in build.components
    )

    quote = QuotationDocument(
        build_id=build.id,
        quote_number=f"KH-{build.id[:8].upper()}",
        quote_date=datetime.now(tz=UTC).date().isoformat(),
        validity_days=QUOTE_VALIDITY_DAYS,
        lines=lines,
        subtotal_php=build.subtotal_php,
        vat_php=build.vat_php,
        total_php=build.total_investment_php,
        total_low_php=build.total_investment_low_php,
        total_high_php=build.total_investment_high_php,
        payment_terms=PAYMENT_TERMS,
        warranty_summary="Component warranties per manufacturer; installation workmanship 1 year.",
        is_draft=True,
    )

    return QuotationDocumentSchema(
        build_id=quote.build_id,
        quote_number=quote.quote_number,
        quote_date=quote.quote_date,
        validity_days=quote.validity_days,
        lines=tuple(
            QuotationLineSchema(
                item=line.item,
                description=line.description,
                brand=line.brand,
                uom=line.uom,
                qty=line.qty,
                unit_price_php=line.unit_price_php,
                amount_php=line.amount_php,
                price_as_of=line.price_as_of,
            )
            for line in quote.lines
        ),
        subtotal_php=quote.subtotal_php,
        vat_php=quote.vat_php,
        total_php=quote.total_php,
        total_low_php=quote.total_low_php,
        total_high_php=quote.total_high_php,
        payment_terms=quote.payment_terms,
        warranty_summary=quote.warranty_summary,
        is_draft=quote.is_draft,
    )
