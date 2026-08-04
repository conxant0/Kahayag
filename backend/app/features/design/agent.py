# Defines the thin design agent tool dispatch loop and audit logging.

import re
import uuid

from app.domain.design.catalog import (
    filter_inverters,
    filter_panels,
    get_battery,
    get_inverter,
    get_panel,
    load_catalog,
)
from app.features.design.schemas import (
    AgentAuditEntrySchema,
    AgentDesignRequest,
    AgentDesignResponse,
    DesignSessionSchema,
    ExplainDesignRequest,
    ExplainDesignResponse,
    GenerateQuotationRequest,
    MutateDesignRequest,
    OptimiseDesignRequest,
)
from app.features.design.service import (
    generate_quotation,
    mutate_design_session,
    optimise_design_session,
)
from app.integrations.ai.design_agent import DesignAgentClient, PlannedToolCall


def _parse_change_request(change_request: str) -> dict[str, object]:
    lowered = change_request.lower()
    patch: dict[str, object] = {}
    if any(token in lowered for token in ("battery", "storage", "backup")):
        patch["require_battery"] = True
        patch["min_battery_kwh"] = 5.0
    if any(token in lowered for token in ("more panel", "add panel", "extra panel")):
        patch["panel_count_delta"] = 1
    if any(token in lowered for token in ("fewer panel", "less panel", "remove panel")):
        patch["panel_count_delta"] = -1
    if any(token in lowered for token in ("budget", "cheaper", "afford")):
        patch["goal"] = "budget"
    if any(token in lowered for token in ("independence", "self-sufficient")):
        patch["goal"] = "independence"
    panel_match = re.search(r"panel[_\s-]?(\d{3})", lowered)
    if panel_match:
        patch["locked_panel_id"] = f"panel_{panel_match.group(1)}"
    inverter_match = re.search(r"inv[_\s-]?(\d{3})", lowered)
    if inverter_match:
        patch["locked_inverter_id"] = f"inv_{inverter_match.group(1)}"
    return patch


def _session_summary(session: DesignSessionSchema) -> dict[str, object]:
    active = next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0] if session.builds else None,
    )
    return {
        "property_ref": session.property_ref,
        "active_build_id": session.active_build_id,
        "active_build": active.model_dump() if active else None,
        "build_count": len(session.builds),
        "last_solve_id": session.last_solve.solve_id if session.last_solve else None,
        "valid_combo_count": len(session.last_solve.valid) if session.last_solve else 0,
        "rejection_count": len(session.last_solve.rejections)
        if session.last_solve
        else 0,
    }


def _execute_tool(
    call: PlannedToolCall,
    *,
    session: DesignSessionSchema,
) -> tuple[dict[str, object], DesignSessionSchema | None]:
    if call.name == "query_catalog":
        category = str(call.arguments.get("category", "panels"))
        catalog = load_catalog()
        if category == "inverters":
            items = filter_inverters(
                catalog=catalog,
                battery_compatible=call.arguments.get("battery_compatible"),
            )
            payload = [
                {
                    "id": item.id,
                    "brand": item.brand,
                    "model": item.model,
                    "rated_ac_w": item.rated_ac_output_w,
                }
                for item in items[:10]
            ]
        elif category == "batteries":
            payload = [
                {
                    "id": item.id,
                    "brand": item.brand,
                    "model": item.model,
                    "usable_kwh": item.usable_capacity_kwh,
                }
                for item in list(catalog.batteries.values())[:10]
            ]
        else:
            items = filter_panels(
                catalog=catalog,
                min_wattage_w=call.arguments.get("min_wattage_w"),
                brand=call.arguments.get("brand"),
            )
            payload = [
                {
                    "id": item.id,
                    "brand": item.brand,
                    "model": item.model,
                    "wattage_w": item.wattage_w,
                }
                for item in items[:10]
            ]
        return {"items": payload}, None

    if call.name == "run_solver":
        goal = str(call.arguments.get("goal", "auto"))
        updated = optimise_design_session(
            OptimiseDesignRequest(session=session, goal=goal),  # type: ignore[arg-type]
        )
        return {
            "solve_id": updated.last_solve.solve_id if updated.last_solve else None,
            "valid_count": len(updated.last_solve.valid) if updated.last_solve else 0,
            "active_build_id": updated.active_build_id,
        }, updated

    if call.name == "get_rejection_reasons":
        solve_id = str(call.arguments.get("solve_id", ""))
        if session.last_solve is None or session.last_solve.solve_id != solve_id:
            return {"rejections": []}, None
        rejections = session.last_solve.rejections
        combo_key = call.arguments.get("combo_key")
        if combo_key:
            rejections = tuple(
                row for row in rejections if row.combo_key == combo_key
            )
        return {
            "rejections": [row.model_dump() for row in rejections[:20]],
        }, None

    if call.name == "update_build":
        patch = _parse_change_request(str(call.arguments.get("change_request", "")))
        mutate_request = MutateDesignRequest(session=session, **patch)  # type: ignore[arg-type]
        updated = mutate_design_session(mutate_request)
        active = next(
            (build for build in updated.builds if build.id == updated.active_build_id),
            None,
        )
        return {
            "active_build_id": updated.active_build_id,
            "system_kwp": active.system_kwp if active else None,
            "total_investment_php": active.total_investment_php if active else None,
        }, updated

    if call.name == "generate_quotation":
        build_id = str(call.arguments.get("build_id", session.active_build_id))
        quote = generate_quotation(
            GenerateQuotationRequest(build_id=build_id, session=session),
        )
        return {
            "quote_number": quote.quote_number,
            "subtotal_php": quote.subtotal_php,
            "vat_php": quote.vat_php,
            "total_php": quote.total_php,
            "line_count": len(quote.lines),
        }, None

    if call.name == "compare_vendors":
        component_id = str(call.arguments.get("component_id", ""))
        catalog = load_catalog()
        for lookup in (get_panel, get_inverter, get_battery):
            try:
                item = lookup(component_id, catalog)
                price = item.price_php
                return {
                    "component_id": component_id,
                    "price_min_php": price.min,
                    "price_max_php": price.max,
                    "as_of": price.as_of,
                    "note": "Catalog min/max tiers; not live distributor pricing.",
                }, None
            except KeyError:
                continue
        return {"component_id": component_id, "error": "unknown component"}, None

    return {"error": f"Unknown tool: {call.name}"}, None


def _append_audit(
    session: DesignSessionSchema,
    *,
    user_text: str,
    tool_audit: list[dict[str, object]],
    solve_ids: list[str],
) -> DesignSessionSchema:
    entry = AgentAuditEntrySchema(
        turn_id=str(uuid.uuid4()),
        user_text=user_text,
        tool_calls=tuple(tool_audit),
        solve_ids=tuple(solve_ids),
        final_build_id=session.active_build_id,
    )
    return session.model_copy(update={"agent_audit": session.agent_audit + (entry,)})


def run_design_agent_turn(
    request: AgentDesignRequest,
    *,
    client: DesignAgentClient,
) -> AgentDesignResponse:
    session = request.session
    planned = client.plan_tool_calls(
        user_text=request.user_text,
        session_summary=_session_summary(session),
    )

    tool_audit: list[dict[str, object]] = []
    solve_ids: list[str] = []
    updated_session = session

    for call in planned:
        result, maybe_session = _execute_tool(call, session=updated_session)
        tool_audit.append(
            {
                "name": call.name,
                "arguments": call.arguments,
                "result": result,
            },
        )
        if maybe_session is not None:
            updated_session = maybe_session
            if maybe_session.last_solve is not None:
                solve_ids.append(maybe_session.last_solve.solve_id)

    active_build = next(
        (
            build
            for build in updated_session.builds
            if build.id == updated_session.active_build_id
        ),
        None,
    )
    reply = (
        f"Updated design to {active_build.system_kwp} kWp "
        f"({active_build.panel_count} panels). "
        f"Investment ₱{active_build.total_investment_php:,.0f}; "
        f"payback {active_build.payback_years} years."
        if active_build
        else "Design session updated."
    )

    audited = _append_audit(
        updated_session,
        user_text=request.user_text,
        tool_audit=tool_audit,
        solve_ids=solve_ids,
    )
    return AgentDesignResponse(session=audited, reply=reply)


def explain_design_session(
    request: ExplainDesignRequest,
    *,
    client: DesignAgentClient,
) -> ExplainDesignResponse:
    active = next(
        (
            build
            for build in request.session.builds
            if build.id == request.session.active_build_id
        ),
        None,
    )
    snapshot = {
        "active_build": active.model_dump() if active else None,
        "last_solve": request.session.last_solve.model_dump()
        if request.session.last_solve
        else None,
        "rejections": [
            row.model_dump()
            for row in (
                request.session.last_solve.rejections[:5]
                if request.session.last_solve
                else ()
            )
        ],
    }
    explanation = client.explain_snapshot(question=request.question, snapshot=snapshot)
    return ExplainDesignResponse(explanation=explanation)
