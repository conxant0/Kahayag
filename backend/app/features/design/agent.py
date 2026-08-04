# Defines the thin design agent tool dispatch loop and audit logging.

import json
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
    DesignBuildSchema,
    DesignSessionSchema,
    ExplainDesignRequest,
    ExplainDesignResponse,
    GenerateQuotationRequest,
    MutateDesignRequest,
    OptimiseDesignRequest,
    PlannedActionSchema,
    ReasoningStepSchema,
    SolverGoal,
)
from app.features.design.service import (
    NoValidDesignError,
    generate_quotation,
    mutate_design_session,
    optimise_design_session,
)
from app.integrations.ai.design_agent import (
    DesignAgentClient,
    DisabledDesignAgentClient,
    PlannedToolCall,
)
from app.integrations.ai.design_tools import MAX_TOOL_ITERATIONS

_REMOVE_VERBS = ("remove", "drop", "delete", "take out", "get rid of", "without", "no ")


def _validate_change_request(text: str) -> str | None:
    lowered = text.lower()
    if "inverter" in lowered and any(verb in lowered for verb in _REMOVE_VERBS):
        return (
            "I can't remove the inverter — every grid-tied system needs one to convert "
            "solar DC into usable AC power. I can swap it for another model or help you "
            "find a cheaper compatible option."
        )
    if (
        "panel" in lowered
        and any(verb in lowered for verb in _REMOVE_VERBS)
        and any(token in lowered for token in ("all", "every", "completely", "entire"))
    ):
        return (
            "I can't remove all of your panels — the system needs at least one to "
            "generate power. I can reduce the panel count if you'd like a smaller array."
        )
    return None


def _patch_applies_change(patch: dict[str, object]) -> bool:
    meaningful_keys = {
        "goal",
        "budget_php",
        "require_battery",
        "min_battery_kwh",
        "locked_panel_id",
        "locked_inverter_id",
        "locked_battery_id",
        "panel_count_delta",
        "seed_panel_count",
        "swap_slot",
        "prefer_cheaper",
    }
    return any(key in patch for key in meaningful_keys)


def _equipment_signature(build: DesignBuildSchema) -> tuple[tuple[str, str | None], ...]:
    slots: list[tuple[str, str | None]] = []
    for slot in ("panel", "inverter", "battery"):
        slots.append((slot, _component_catalog_id_from_build(build, slot)))
    slots.append(("panel_count", str(build.panel_count)))
    slots.append(("battery_kwh", str(build.battery_kwh)))
    return tuple(slots)


def _parse_change_request(change_request: str) -> dict[str, object]:
    lowered = change_request.lower()
    patch: dict[str, object] = {}
    if any(token in lowered for token in ("battery", "storage", "backup", "blackout", "brownout", "energy store")):
        if any(token in lowered for token in _REMOVE_VERBS + ("without", "no battery", "no storage")):
            patch["require_battery"] = False
            patch["min_battery_kwh"] = None
        else:
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
        is_remove = any(
            token in panel_delta_match.group(0)
            for token in ("remove", "fewer", "less")
        )
        patch["panel_count_delta"] = -count if is_remove else count
    elif any(token in lowered for token in ("more panel", "add panel", "extra panel", "increase panel")):
        patch["panel_count_delta"] = 1
    elif any(token in lowered for token in ("fewer panel", "less panel", "remove panel", "decrease panel")):
        patch["panel_count_delta"] = -1
    elif re.search(
        r"\b(?:lessen|reduce|lower|cut|decrease|minimi[sz]e|shrink)\b.*\bpanel",
        lowered,
    ):
        count_match = re.search(r"\b(\d+|one|two|three|four|five)\b", lowered)
        word_counts = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
        if count_match and count_match.group(1).isdigit():
            count = int(count_match.group(1))
        elif count_match:
            count = word_counts.get(count_match.group(1), 1)
        else:
            count = 1
        patch["panel_count_delta"] = -count
    elif re.search(
        r"\b(?:increase|raise|boost|expand)\b.*\bpanel",
        lowered,
    ):
        count_match = re.search(r"\b(\d+|one|two|three|four|five)\b", lowered)
        word_counts = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
        if count_match and count_match.group(1).isdigit():
            count = int(count_match.group(1))
        elif count_match:
            count = word_counts.get(count_match.group(1), 1)
        else:
            count = 1
        patch["panel_count_delta"] = count
    if any(token in lowered for token in ("budget", "cheaper", "afford", "cheapest")):
        patch["goal"] = "budget"
    if any(token in lowered for token in ("independence", "self-sufficient", "off-grid", "off grid")):
        patch["goal"] = "independence"
    if any(token in lowered for token in ("backup", "blackout", "brownout", "outage")):
        patch["goal"] = "backup"
        patch["require_battery"] = True
        patch["min_battery_kwh"] = _achievable_battery_kwh(5.0)
    budget_match = re.search(
        r"(?:budget|under|below|\bmax\b|maximum|cap(?:ped)? at|within|set budget to)\s*(?:₱|php|peso[s]?)?\s*([\d,]+(?:\.\d+)?)\s*(?:k|000)?",
        lowered,
    )
    if budget_match:
        raw = budget_match.group(1).replace(",", "")
        if raw:
            amount = float(raw)
            if amount < 1000:
                amount *= 1000
            patch["budget_php"] = amount
    panel_match = re.search(r"panel[_\s-]?(\d{3})", lowered)
    if panel_match:
        patch["locked_panel_id"] = f"panel_{panel_match.group(1)}"
    else:
        model_match = re.search(
            r"\b(?:use|switch to|swap to|try)\s+([a-z]{2,}\d{2,}[a-z0-9./+-]*)\b",
            lowered,
        )
        if model_match:
            from app.domain.design.catalog import load_catalog

            token = model_match.group(1).lower().replace(" ", "")
            for panel in load_catalog().panels.values():
                haystack = f"{panel.brand} {panel.model} {panel.id}".lower().replace(" ", "")
                if token in haystack:
                    patch["locked_panel_id"] = panel.id
                    break
    inverter_match = re.search(r"inv[_\s-]?(\d{3})", lowered)
    if inverter_match:
        patch["locked_inverter_id"] = f"inv_{inverter_match.group(1)}"
    return patch


def _detect_swap_slot(change_request: str) -> str | None:
    lowered = change_request.lower()
    swap_verbs = ("swap", "switch", "change", "replace", "upgrade", "downgrade", "use", "try")
    wants_cheaper = _wants_cheaper_option(change_request)
    wants_alternate = any(
        token in lowered for token in ("different", "another", "other", "else")
    )

    if "inverter" in lowered and (
        any(verb in lowered for verb in swap_verbs) or wants_cheaper or wants_alternate
    ):
        return "inverter"
    if "panel" in lowered and (
        any(verb in lowered for verb in swap_verbs) or wants_cheaper or wants_alternate
    ):
        return "panel"
    if (
        any(token in lowered for token in ("batter", "storage", "energy store"))
        and (
            any(verb in lowered for verb in swap_verbs)
            or wants_cheaper
            or wants_alternate
        )
    ):
        return "battery"
    return None


def _wants_cheaper_option(change_request: str) -> bool:
    lowered = change_request.lower()
    return any(
        token in lowered
        for token in ("cheaper", "cheapest", "afford", "budget", "less expensive", "lower cost")
    )


def _component_catalog_id_from_build(build: DesignBuildSchema, slot: str) -> str | None:
    for component in build.components:
        if component.slot == slot and component.catalog_id:
            return component.catalog_id
    return None


def _enrich_swap_patch(
    patch: dict[str, object],
    *,
    session: DesignSessionSchema,
    change_request: str,
) -> dict[str, object]:
    swap_slot = _detect_swap_slot(change_request)
    if swap_slot is None:
        return patch

    active = next(
        (build for build in session.builds if build.id == session.active_build_id),
        None,
    )
    if active is None:
        return patch

    panel_id = _component_catalog_id_from_build(active, "panel")
    inverter_id = _component_catalog_id_from_build(active, "inverter")
    battery_id = _component_catalog_id_from_build(active, "battery")

    if active.panel_count > 0:
        patch["seed_panel_count"] = active.panel_count

    if swap_slot != "panel" and panel_id:
        patch["locked_panel_id"] = panel_id
    if swap_slot != "inverter" and inverter_id:
        patch["locked_inverter_id"] = inverter_id
    if swap_slot != "battery" and battery_id:
        patch["locked_battery_id"] = battery_id
    elif swap_slot != "battery" and battery_id is None and "require_battery" not in patch:
        patch["require_battery"] = False

    patch["swap_slot"] = swap_slot
    if _wants_cheaper_option(change_request):
        patch["prefer_cheaper"] = True
        patch.setdefault("goal", "budget")
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
        "homeowner_plans": session.homeowner_plans,
        "last_solve_id": session.last_solve.solve_id if session.last_solve else None,
        "valid_combo_count": len(session.last_solve.valid) if session.last_solve else 0,
        "rejection_count": len(session.last_solve.rejections)
        if session.last_solve
        else 0,
    }


def _wants_cheapest_catalog(text: str) -> bool:
    lowered = text.lower()
    return any(
        token in lowered
        for token in ("cheapest", "lowest price", "least expensive", "most affordable")
    )


def _catalog_items_payload(
    *,
    category: str,
    catalog,
    sort_cheapest: bool = False,
    brand: str | None = None,
    min_wattage_w: int | None = None,
    battery_compatible: object = None,
    limit: int = 10,
) -> list[dict[str, object]]:
    if category == "inverters":
        items = filter_inverters(
            catalog=catalog,
            battery_compatible=battery_compatible,
        )
        payload = [
            {
                "id": item.id,
                "brand": item.brand,
                "model": item.model,
                "rated_ac_w": item.rated_ac_output_w,
                "unit_price_php": item.price_php.mid,
            }
            for item in items
        ]
    elif category == "batteries":
        payload = [
            {
                "id": item.id,
                "brand": item.brand,
                "model": item.model,
                "usable_kwh": item.usable_capacity_kwh,
                "unit_price_php": item.price_php.mid,
            }
            for item in catalog.batteries.values()
        ]
    else:
        items = filter_panels(
            catalog=catalog,
            min_wattage_w=min_wattage_w,
            brand=brand if isinstance(brand, str) and brand.strip() else None,
        )
        payload = [
            {
                "id": item.id,
                "brand": item.brand,
                "model": item.model,
                "wattage_w": item.wattage_w,
                "unit_price_php": item.price_php.mid,
            }
            for item in items
        ]
    if sort_cheapest:
        payload = sorted(
            payload,
            key=lambda row: float(row.get("unit_price_php") or 0),
        )
    return payload[:limit]


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
    user_text: str = "",
) -> tuple[dict[str, object], DesignSessionSchema | None]:
    if call.name == "query_catalog":
        category = str(call.arguments.get("category", "panels"))
        catalog = load_catalog()
        sort_cheapest = (
            str(call.arguments.get("sort_by", "")).lower() == "price_asc"
            or _wants_cheapest_catalog(user_text)
        )
        payload = _catalog_items_payload(
            category=category,
            catalog=catalog,
            sort_cheapest=sort_cheapest,
            brand=call.arguments.get("brand") if isinstance(call.arguments.get("brand"), str) else None,
            min_wattage_w=_coerce_int(call.arguments.get("min_wattage_w")),
            battery_compatible=call.arguments.get("battery_compatible"),
        )
        return {"items": payload, "sort_cheapest": sort_cheapest}, None

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
        change_request = str(call.arguments.get("change_request", ""))
        intent_text = user_text or change_request
        blocked = _validate_change_request(intent_text)
        if blocked is not None:
            return {"error": blocked}, None

        patch = _parse_change_request(change_request)
        patch = _enrich_swap_patch(
            patch,
            session=session,
            change_request=intent_text,
        )
        if not _patch_applies_change(patch):
            return {
                "error": (
                    "I'm not sure what you'd like me to change. Try asking to swap the "
                    "inverter or panels, add or remove battery storage, add panels, or "
                    "optimise for budget."
                ),
            }, None

        active_before = next(
            (build for build in session.builds if build.id == session.active_build_id),
            None,
        )
        if patch.get("panel_count_delta") is not None and active_before is not None:
            delta = int(patch.pop("panel_count_delta"))
            patch["seed_panel_count"] = max(1, active_before.panel_count + delta)
            if not patch.get("swap_slot"):
                panel_id = _component_catalog_id_from_build(active_before, "panel")
                if panel_id:
                    patch.setdefault("locked_panel_id", panel_id)
        mutate_request = MutateDesignRequest(session=session, **patch)  # type: ignore[arg-type]
        updated = mutate_design_session(mutate_request)
        active = next(
            (build for build in updated.builds if build.id == updated.active_build_id),
            None,
        )
        if (
            active_before is not None
            and active is not None
            and _equipment_signature(active_before) == _equipment_signature(active)
        ):
            return {
                "error": (
                    "That wouldn't change your current design. If you meant something "
                    "else, try being more specific — e.g. swap the inverter or remove "
                    "battery storage."
                ),
            }, None

        result: dict[str, object] = {
            "active_build_id": updated.active_build_id,
            "system_kwp": active.system_kwp if active else None,
            "total_investment_php": active.total_investment_php if active else None,
            "swap_slot": patch.get("swap_slot"),
            "user_text": intent_text,
        }
        if active_before is not None and active is not None:
            result["previous_panel_count"] = active_before.panel_count
            result["panel_count"] = active.panel_count
            result["previous_battery_kwh"] = active_before.battery_kwh
            result["battery_kwh"] = active.battery_kwh
            if patch.get("swap_slot"):
                slot = str(patch["swap_slot"])
                before_id = _component_catalog_id_from_build(active_before, slot)
                after_component = next(
                    (component for component in active.components if component.slot == slot),
                    None,
                )
                before_component = next(
                    (
                        component
                        for component in active_before.components
                        if component.slot == slot
                    ),
                    None,
                )
                if after_component is not None:
                    result["component_changed"] = after_component.catalog_id != before_id
                    result["previous_model"] = (
                        before_component.model if before_component is not None else None
                    )
                    result["new_model"] = after_component.model
                    result["previous_catalog_id"] = before_id
                    result["new_catalog_id"] = after_component.catalog_id
        return result, updated

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


def _reasoning_label_for_call(call: PlannedToolCall) -> ReasoningStepSchema:
    if call.name == "run_solver":
        goal = call.arguments.get("goal", "auto")
        return ReasoningStepSchema(
            kind="tool_call",
            label=f'Running solver ({goal} goal)',
        )
    if call.name == "update_build":
        change = call.arguments.get("change_request", "design update")
        return ReasoningStepSchema(
            kind="tool_call",
            label="Applying design update",
            detail=str(change),
        )
    if call.name == "generate_quotation":
        return ReasoningStepSchema(kind="tool_call", label="Generating quotation")
    if call.name == "query_catalog":
        category = call.arguments.get("category", "components")
        return ReasoningStepSchema(
            kind="tool_call",
            label=f"Looking up {category} in catalog",
        )
    if call.name == "get_rejection_reasons":
        return ReasoningStepSchema(kind="tool_call", label="Checking rejection reasons")
    if call.name == "compare_vendors":
        return ReasoningStepSchema(kind="tool_call", label="Comparing catalog price tiers")
    return ReasoningStepSchema(
        kind="tool_call",
        label=f"Running {call.name.replace('_', ' ')}",
    )


def _reasoning_label_for_result(
    call: PlannedToolCall,
    result: dict[str, object],
) -> ReasoningStepSchema:
    if "error" in result:
        return ReasoningStepSchema(
            kind="error",
            label="Step failed",
            detail=str(result["error"]),
        )
    if call.name == "run_solver":
        valid_count = result.get("valid_count", 0)
        if valid_count == 0:
            return ReasoningStepSchema(
                kind="tool_result",
                label="No valid combinations found",
                detail="Checking rejection reasons may help",
            )
        return ReasoningStepSchema(
            kind="tool_result",
            label=f"Found {valid_count} valid combination(s)",
        )
    if call.name == "get_rejection_reasons":
        rejections = result.get("rejections")
        count = len(rejections) if isinstance(rejections, list) else 0
        detail = None
        if count and isinstance(rejections, list):
            first = rejections[0]
            if isinstance(first, dict) and first.get("message"):
                detail = str(first["message"])
        return ReasoningStepSchema(
            kind="tool_result",
            label=f"{count} rejection(s) logged",
            detail=detail,
        )
    if call.name == "update_build":
        if "error" in result:
            return ReasoningStepSchema(
                kind="error",
                label="Could not apply that change",
                detail=str(result["error"]),
            )
        kwp = result.get("system_kwp")
        investment = result.get("total_investment_php")
        if kwp is not None and investment is not None:
            return ReasoningStepSchema(
                kind="tool_result",
                label=f"Updated to {kwp} kWp",
                detail=f"₱{float(investment):,.0f} total investment",
            )
        return ReasoningStepSchema(kind="tool_result", label="Design updated")
    if call.name == "generate_quotation":
        total = result.get("total_php")
        if total is not None:
            return ReasoningStepSchema(
                kind="tool_result",
                label=f"Quotation total ₱{float(total):,.0f}",
            )
        return ReasoningStepSchema(kind="tool_result", label="Quotation generated")
    if call.name == "query_catalog":
        items = result.get("items")
        count = len(items) if isinstance(items, list) else 0
        return ReasoningStepSchema(
            kind="tool_result",
            label=f"Found {count} catalog item(s)",
        )
    return ReasoningStepSchema(kind="tool_result", label="Step complete")


def _append_tool_results_to_messages(
    messages: list[dict[str, object]],
    *,
    assistant_message: dict[str, object] | None,
    tool_calls: tuple[PlannedToolCall, ...],
    results: list[dict[str, object]],
) -> None:
    if assistant_message is not None:
        messages.append(assistant_message)
    tool_call_ids = assistant_message.get("tool_calls") if assistant_message else None
    for index, (call, result) in enumerate(zip(tool_calls, results, strict=True)):
        tool_call_id = None
        if isinstance(tool_call_ids, list) and index < len(tool_call_ids):
            tool_call_id = tool_call_ids[index].get("id")
        messages.append(
            {
                "role": "tool",
                "tool_call_id": tool_call_id or f"call-{index}",
                "content": json.dumps({"tool": call.name, "result": result}, default=str),
            },
        )


def run_design_agent_turn(
    request: AgentDesignRequest,
    *,
    client: DesignAgentClient,
) -> AgentDesignResponse:
    session = request.session
    session_summary = _session_summary(session)

    if request.dry_run:
        planned = client.plan_tool_calls(
            user_text=request.user_text,
            session_summary=session_summary,
        )
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

    messages = client.build_agent_messages(
        user_text=request.user_text,
        session_summary=session_summary,
    )
    tool_audit: list[dict[str, object]] = []
    reasoning_steps: list[ReasoningStepSchema] = []
    solve_ids: list[str] = []
    updated_session = session
    final_reply: str | None = None

    reasoning_steps.append(
        ReasoningStepSchema(kind="thinking", label="Understanding your request"),
    )

    for _ in range(MAX_TOOL_ITERATIONS):
        step = client.agent_step(messages)
        if step.final_reply and not step.tool_calls:
            final_reply = step.final_reply
            reasoning_steps.append(
                ReasoningStepSchema(kind="thinking", label="Summarising results"),
            )
            break
        if not step.tool_calls:
            break

        batch_calls: list[PlannedToolCall] = []
        batch_results: list[dict[str, object]] = []

        for call in step.tool_calls:
            normalized = _normalize_tool_call(
                call,
                session=updated_session,
                user_text=request.user_text,
            )
            reasoning_steps.append(_reasoning_label_for_call(normalized))
            try:
                result, maybe_session = _execute_tool(
                    normalized,
                    session=updated_session,
                    user_text=request.user_text,
                )
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
            reasoning_steps.append(_reasoning_label_for_result(normalized, result))
            batch_calls.append(normalized)
            batch_results.append(result)
            if maybe_session is not None:
                updated_session = maybe_session
                if maybe_session.last_solve is not None:
                    solve_ids.append(maybe_session.last_solve.solve_id)

        _append_tool_results_to_messages(
            messages,
            assistant_message=step.assistant_message,
            tool_calls=tuple(batch_calls),
            results=batch_results,
        )

    if not tool_audit and final_reply is None:
        reasoning_steps.append(
            ReasoningStepSchema(kind="thinking", label="Using rule-based planner"),
        )
        for call in DisabledDesignAgentClient().plan_tool_calls(
            user_text=request.user_text,
            session_summary=session_summary,
        ):
            normalized = _normalize_tool_call(
                call,
                session=updated_session,
                user_text=request.user_text,
            )
            reasoning_steps.append(_reasoning_label_for_call(normalized))
            try:
                result, maybe_session = _execute_tool(
                    normalized,
                    session=updated_session,
                    user_text=request.user_text,
                )
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
            reasoning_steps.append(_reasoning_label_for_result(normalized, result))
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

    if final_reply is None:
        final_reply = client.generate_turn_reply(
            user_text=request.user_text,
            tool_audit=tool_audit,
            active_build=active_build.model_dump() if active_build else None,
        )
    if tool_errors and not final_reply.startswith("I couldn't complete that request"):
        final_reply = f"{final_reply} {' '.join(tool_errors)}"

    audited = _append_audit(
        updated_session,
        user_text=request.user_text,
        tool_audit=tool_audit,
        solve_ids=solve_ids,
    )
    return AgentDesignResponse(
        session=audited,
        reply=final_reply,
        reasoning_steps=tuple(reasoning_steps),
    )


def _panel_alternatives_for_explain(
    session: DesignSessionSchema,
    *,
    active_panel_id: str | None,
) -> list[dict[str, object]]:
    if not session.last_solve or not active_panel_id:
        return []

    catalog = load_catalog()
    alternatives: list[dict[str, object]] = []
    for combo in session.last_solve.valid:
        if combo.panel_id == active_panel_id:
            continue
        panel = catalog.panels.get(combo.panel_id)
        if panel is None:
            continue
        alternatives.append(
            {
                "panel_id": panel.id,
                "brand": panel.brand,
                "model": panel.model,
                "wattage_w": panel.wattage_w,
                "fit_score": combo.fit_score,
                "estimated_cost_php": combo.estimated_cost_php,
            },
        )
        if len(alternatives) >= 4:
            break
    return alternatives


def _active_panel_id(active: DesignBuildSchema | None) -> str | None:
    if active is None:
        return None
    for component in active.components:
        if component.slot == "panel" and component.catalog_id:
            return component.catalog_id
    return None


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
    active_panel_id = _active_panel_id(active)
    snapshot = {
        "active_build": active.model_dump() if active else None,
        "homeowner_plans": request.session.homeowner_plans,
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
        "panel_alternatives": _panel_alternatives_for_explain(
            request.session,
            active_panel_id=active_panel_id,
        ),
    }
    explanation = client.explain_snapshot(question=request.question, snapshot=snapshot)
    return ExplainDesignResponse(explanation=explanation)
