# Defines design feature orchestration and domain-to-API mapping.

import hashlib
import uuid
from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal

from app.domain.design.bom import expand_combo_to_components
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
from app.domain.design.solver import constraints_from_sizing, run_solver
from app.features.design.schemas import (
    AgentAuditEntrySchema,
    BootstrapDesignRequest,
    DesignBuildSchema,
    DesignComponentSchema,
    DesignSessionSchema,
    GenerateQuotationRequest,
    MutateDesignRequest,
    OptimiseDesignRequest,
    QuotationDocumentSchema,
    QuotationLineSchema,
    RejectionReasonSchema,
    SolverConstraintsSchema,
    SolveResultSchema,
    ValidComboSchema,
)

MAX_SESSION_REJECTIONS = 200


class NoValidDesignError(Exception):
    pass


def _fingerprint_assessment(assessment: dict[str, object]) -> str:
    payload = str(sorted(assessment.items()))
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _extract_sizing_inputs(assessment: dict[str, object]) -> tuple[float, int, float, float | None, float, float, float]:
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

    return (
        target_kwp,
        max_panel_count,
        usable_roof_area_m2,
        budget_php,
        annual_consumption,
        tariff,
        annual_yield_per_kwp,
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
) -> DesignBuild:
    components = expand_combo_to_components(combo, ai_suggested=ai_suggested)
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
    )

    builds: list[DesignBuild] = [ai_build]
    if len(solve_result.valid) >= 2:
        alternate = solve_result.valid[1]
        builds.append(
            _build_from_combo(
                alternate,
                solve_id=solve_result.solve_id,
                label="Custom build A",
                tags=("ALTERNATE",),
                source="custom",
                annual_consumption_kwh=annual_consumption_kwh,
                annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
                resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
            )
        )

    return DesignSession(
        property_ref=property_ref,
        assessment_fingerprint=assessment_fingerprint,
        active_build_id=ai_build.id,
        builds=tuple(builds),
        last_solve=solve_result,
        applied=False,
    )


def bootstrap_design_session(request: BootstrapDesignRequest) -> DesignSessionSchema:
    (
        target_kwp,
        max_panel_count,
        usable_roof_area_m2,
        budget_php,
        annual_consumption,
        tariff,
        annual_yield,
    ) = _extract_sizing_inputs(request.assessment)

    constraints = constraints_from_sizing(
        target_kwp=target_kwp,
        max_panel_count=max_panel_count,
        usable_roof_area_m2=usable_roof_area_m2,
        budget_php=budget_php,
        annual_consumption_kwh=annual_consumption,
        resolved_tariff_php_per_kwh=tariff,
        annual_yield_per_kwp_kwh=annual_yield,
        goal="auto",
    )
    solve_result = run_solver(constraints)
    if not solve_result.valid and budget_php is not None:
        relaxed = constraints_from_sizing(
            target_kwp=target_kwp,
            max_panel_count=max_panel_count,
            usable_roof_area_m2=usable_roof_area_m2,
            budget_php=None,
            annual_consumption_kwh=annual_consumption,
            resolved_tariff_php_per_kwh=tariff,
            annual_yield_per_kwp_kwh=annual_yield,
            goal="auto",
        )
        solve_result = run_solver(relaxed)

    session = _session_from_solve(
        solve_result=solve_result,
        property_ref=request.property_ref,
        assessment_fingerprint=_fingerprint_assessment(request.assessment),
        annual_consumption_kwh=annual_consumption,
        annual_yield_per_kwp_kwh=annual_yield,
        resolved_tariff_php_per_kwh=tariff,
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
        panel_count_delta=request.panel_count_delta,
    )
    solve_result = run_solver(patched)
    if not solve_result.valid and patched.budget_php is not None:
        solve_result = run_solver(replace(patched, budget_php=None))
    session = _session_from_solve(
        solve_result=solve_result,
        property_ref=request.session.property_ref,
        assessment_fingerprint=request.session.assessment_fingerprint,
        annual_consumption_kwh=domain_constraints.annual_consumption_kwh,
        annual_yield_per_kwp_kwh=domain_constraints.annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=domain_constraints.resolved_tariff_php_per_kwh,
    )
    if not session.builds:
        raise NoValidDesignError("Solver found no valid equipment combinations.")
    return _to_session_schema(session)


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
        payment_terms=quote.payment_terms,
        warranty_summary=quote.warranty_summary,
        is_draft=quote.is_draft,
    )
