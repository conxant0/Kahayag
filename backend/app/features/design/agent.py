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
from app.domain.design.mutations import _achievable_battery_kwh
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
    PlannedActionSchema,
    SolverGoal,
)
from app.features.design.service import (
    NoValidDesignError,
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
        patch["min_battery_kwh"] = _achievable_battery_kwh(5.0)
    panel_delta_match = re.search(
        r"(?:add|remove|fewer|less|extra)\s+(?:(\d+|one|two|three|four|five)\s+)?(?:more\s+)?panels?",
        lowered,
    )
    if panel_delta_match:
        raw_count = panel_delta_match.group(1)
        word_counts = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
        count = int(raw_count) if raw_count and raw_count.isdigit() else word_counts.get(raw_count or "one", 1)
        patch["panel_count_delta"] = count if "remove" not in panel_delta_match.group(0) and "fewer" not in panel_delta_match.group(0) and "less" not in panel_delta_match.group(0) else -count
    elif any(token in lowered for token in ("more panel", "add panel", "extra panel")):
        patch["panel_count_delta"] = 1
    elif any(token in lowered for token in ("fewer panel", "less panel", "remove panel")):
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


def _coerce_goal(value: object) -> SolverGoal:
    """Tool arguments come from the planner model, not a validated request —
    an off-enum goal ("cheapest") must fall back to "auto", not 500."""
    text = str(value if value is not None else "auto").strip().lower()
    if text in ("auto", "budget", "backup", "independence"):
        return text  # narrowed to the literal set by the membership check
    return "auto"


def _coerce_int(value: object) -> int | None:
    """Model-supplied numbers arrive as strings often enough that a raw
    pass-through crashes the comparison in the catalog filters."""
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        return None


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


def _normalize_tool_call(
    call: PlannedToolCall,
    *,
    session: DesignSessionSchema,
    user_text: str,
) -> PlannedToolCall:
    if call.name == "update_build":
        args = dict(call.arguments)
        args["build_id"] = session.active_build_id
        if not str(args.get("change_request", "")).strip():
            args["change_request"] = user_text
        return PlannedToolCall(name=call.name, arguments=args)
    if call.name == "generate_quotation":
        return PlannedToolCall(
            name=call.name,
            arguments={"build_id": session.active_build_id},
        )
    if call.name == "get_rejection_reasons" and session.last_solve is not None:
        args = dict(call.arguments)
        if not args.get("solve_id"):
            args["solve_id"] = session.last_solve.solve_id
        return PlannedToolCall(name=call.name, arguments=args)
    return call


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
            brand = call.arguments.get("brand")
            items = filter_panels(
                catalog=catalog,
                min_wattage_w=_coerce_int(call.arguments.get("min_wattage_w")),
                brand=brand if isinstance(brand, str) and brand.strip() else None,
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
        goal = _coerce_goal(call.arguments.get("goal", "auto"))
        updated = optimise_design_session(
            OptimiseDesignRequest(session=session, goal=goal),
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


def _describe_planned_tools(
    planned: tuple[PlannedToolCall, ...],
    *,
    user_text: str,
    session: DesignSessionSchema,
) -> tuple[str, tuple[PlannedActionSchema, ...]]:
    if not planned:
        return (
            (
                "I'm not sure which design change you want yet. You could try:\n"
                "• Add or remove panels\n"
                "• Optimise for budget, backup, or independence\n"
                "• Add battery storage or swap components"
            ),
            (),
        )

    actions: list[PlannedActionSchema] = []
    lines: list[str] = []
    for call in planned:
        normalized = _normalize_tool_call(
            call,
            session=session,
            user_text=user_text,
        )
        actions.append(
            PlannedActionSchema(
                name=normalized.name,
                arguments=normalized.arguments,
            ),
        )
        if normalized.name == "run_solver":
            goal = normalized.arguments.get("goal", "auto")
            lines.append(f'Re-run the solver with the "{goal}" goal')
        elif normalized.name == "update_build":
            change = normalized.arguments.get("change_request", user_text)
            lines.append(f"Apply design update: {change}")
        elif normalized.name == "generate_quotation":
            lines.append("Generate a quotation for the active build")
        elif normalized.name == "query_catalog":
            category = normalized.arguments.get("category", "components")
            lines.append(f"Look up {category} in the catalog")
        else:
            lines.append(f"Run {normalized.name.replace('_', ' ')}")

    if len(lines) == 1:
        reply = f"I can {lines[0][0].lower() + lines[0][1:] if lines[0].startswith('Re-run') else lines[0]}."
    else:
        reply = "I can apply these changes:\n" + "\n".join(f"• {line}" for line in lines)
    return f"{reply} Apply when you're ready.", tuple(actions)


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

    if request.dry_run:
        reply, planned_actions = _describe_planned_tools(
            planned,
            user_text=request.user_text,
            session=session,
        )
        return AgentDesignResponse(
            session=session,
            reply=reply,
            requires_confirmation=bool(planned),
            planned_actions=planned_actions,
        )

    tool_audit: list[dict[str, object]] = []
    solve_ids: list[str] = []
    updated_session = session

    for call in planned:
        normalized = _normalize_tool_call(
            call,
            session=updated_session,
            user_text=request.user_text,
        )
        try:
            result, maybe_session = _execute_tool(normalized, session=updated_session)
        except NoValidDesignError as error:
            result = {"error": str(error)}
            maybe_session = None
        tool_audit.append(
            {
                "name": normalized.name,
                "arguments": normalized.arguments,
                "result": result,
            },
        )
        if maybe_session is not None:
            updated_session = maybe_session
            if maybe_session.last_solve is not None:
                solve_ids.append(maybe_session.last_solve.solve_id)

    tool_errors = [
        str(entry["result"]["error"])
        for entry in tool_audit
        if isinstance(entry.get("result"), dict) and entry["result"].get("error")
    ]

    active_build = next(
        (
            build
            for build in updated_session.builds
            if build.id == updated_session.active_build_id
        ),
        None,
    )
    reply = client.generate_turn_reply(
        user_text=request.user_text,
        tool_audit=tool_audit,
        active_build=active_build.model_dump() if active_build else None,
    )
    if tool_errors:
        reply = f"{reply} {' '.join(tool_errors)}"

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
