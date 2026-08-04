# Defines Groq and disabled implementations for the design agent tool loop.

import json
import re
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.integrations.ai.design_tools import (
    DESIGN_AGENT_SYSTEM_PROMPT,
    DESIGN_TOOL_SCHEMAS,
    EXPLAIN_DESIGN_SYSTEM_PROMPT,
    MAX_TOOL_ITERATIONS,
)
from app.integrations.ai.groq import GROQ_CHAT_COMPLETIONS_URL


@dataclass(frozen=True)
class PlannedToolCall:
    name: str
    arguments: dict[str, object]


@dataclass(frozen=True)
class AgentStepResult:
    tool_calls: tuple[PlannedToolCall, ...] = ()
    assistant_message: dict[str, object] | None = None
    final_reply: str | None = None


class DesignAgentClient(Protocol):
    def build_agent_messages(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> list[dict[str, object]]: ...

    def agent_step(
        self,
        messages: list[dict[str, object]],
    ) -> AgentStepResult: ...

    def plan_tool_calls(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> tuple[PlannedToolCall, ...]: ...

    def explain_snapshot(
        self,
        *,
        question: str,
        snapshot: dict[str, object],
    ) -> str: ...

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        active_build: dict[str, object] | None,
    ) -> str: ...


def _infer_goal_from_text(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ("budget", "cheaper", "afford", "cost", "cheapest", "save money")):
        return "budget"
    if any(token in lowered for token in ("backup", "blackout", "brownout", "outage", "power cut")):
        return "backup"
    if any(token in lowered for token in ("independence", "self-sufficient", "off-grid", "off grid")):
        return "independence"
    if any(token in lowered for token in ("auto", "optimi", "best fit", "recommend")):
        return "auto"
    return "auto"


def _is_change_request(text: str) -> bool:
    lowered = text.lower()
    change_verbs = (
        "add", "remove", "swap", "change", "update", "optimi",
        "increase", "decrease", "make it", "make this", "more", "fewer",
        "less", "extra", "drop", "include", "maximi", "ensure", "upgrade",
        "downgrade", "switch", "use ", "try ", "set ", "lock ",
    )
    change_nouns = (
        "panel", "battery", "inverter", "storage", "budget", "backup",
        "independence", "kwp", "system", "quotation", "quote",
    )
    return any(v in lowered for v in change_verbs) or any(n in lowered for n in change_nouns)


def _infer_catalog_category(text: str) -> str:
    lowered = text.lower()
    if "inverter" in lowered:
        return "inverters"
    if "batter" in lowered or "storage" in lowered:
        return "batteries"
    return "panels"


def _infer_catalog_brand(text: str) -> str | None:
    lowered = text.lower()
    brands = (
        "ae solar", "ae", "longi", "ja solar", "ja", "jinko", "trina",
        "canadian solar", "growatt", "sungrow", "huawei", "byd", "pylontech",
    )
    for brand in brands:
        if brand in lowered:
            return brand.split()[0] if " " in brand else brand
    return None


def _plan_disabled_tools(
    user_text: str,
    session_summary: dict[str, object],
) -> tuple[PlannedToolCall, ...]:
    lowered = user_text.lower()
    active_build_id = str(session_summary.get("active_build_id", ""))
    last_solve_id = str(session_summary.get("last_solve_id", ""))

    if any(token in lowered for token in ("quote", "quotation", "price breakdown", "bom", "line item")):
        return (
            PlannedToolCall(
                name="generate_quotation",
                arguments={"build_id": active_build_id},
            ),
        )

    if any(
        token in lowered
        for token in (
            "reject", "rejected", "didn't work", "didnt work", "failed",
            "what got rejected", "why not", "why didn't", "why didnt",
            "no valid", "couldn't find", "couldnt find",
        )
    ):
        return (
            PlannedToolCall(
                name="get_rejection_reasons",
                arguments={"solve_id": last_solve_id},
            ),
        )

    if any(
        token in lowered
        for token in (
            "show me", "list", "what panels", "what inverters", "what batteries",
            "catalog", "available", "compatible panel", "compatible inverter",
        )
    ):
        args: dict[str, object] = {"category": _infer_catalog_category(user_text)}
        brand = _infer_catalog_brand(user_text)
        if brand:
            args["brand"] = brand
        return (PlannedToolCall(name="query_catalog", arguments=args),)

    goal = _infer_goal_from_text(user_text)
    if any(
        token in lowered
        for token in ("optimi", "re-run", "rebuild", "solve", "auto", "refresh", "recalculate")
    ):
        return (PlannedToolCall(name="run_solver", arguments={"goal": goal}),)

    if active_build_id and _is_change_request(lowered):
        return (
            PlannedToolCall(
                name="update_build",
                arguments=_infer_update_build_args(user_text, active_build_id),
            ),
        )

    if (
        active_build_id
        and ("backup" in lowered or "battery" in lowered or "storage" in lowered)
        and any(
            token in lowered for token in ("add", "include", "need", "want", "ensure", "get")
        )
    ):
        return (
            PlannedToolCall(
                name="update_build",
                arguments=_infer_update_build_args(user_text, active_build_id),
            ),
        )

    return (PlannedToolCall(name="run_solver", arguments={"goal": goal}),)


def _is_nighttime_question(question: str) -> bool:
    lowered = question.strip().lower()
    return any(
        token in lowered
        for token in (
            "at night",
            "night time",
            "nighttime",
            "after dark",
            "when dark",
            "when the sun goes",
            "no sun",
            "cloudy day",
            "cloudy days",
            "when it's cloudy",
            "when its cloudy",
        )
    ) or (
        any(token in lowered for token in ("how about", "what about", "and at"))
        and "night" in lowered
    )


def _is_outage_question(question: str) -> bool:
    lowered = question.strip().lower()
    return any(
        token in lowered
        for token in (
            "blackout",
            "brownout",
            "power outage",
            "power cut",
            "grid goes down",
            "grid goes out",
            "during an outage",
            "when the power goes",
        )
    )


def _is_general_battery_question(question: str) -> bool:
    lowered = question.strip().lower()
    if _is_nighttime_question(lowered) or _is_outage_question(lowered):
        return False
    general_patterns = (
        "work without",
        "without a battery",
        "without battery",
        "without storage",
        "without an energy storage",
        "without energy storage",
        "need a battery",
        "need battery",
        "require a battery",
        "require battery",
        "is battery required",
        "is a battery required",
        "can solar",
        "can i use solar",
        "will the system work",
        "will it work",
        "do i need",
        "do you need",
        "must i have",
        "must you have",
    )
    return any(pattern in lowered for pattern in general_patterns)


def _explain_grid_tied_without_battery(build: dict[str, object]) -> str:
    kwp = build.get("system_kwp")
    panels = build.get("panel_count")
    payback = build.get("payback_years")
    return (
        f"Yes — your {kwp} kWp system ({panels} panels) works fine without a battery. "
        f"During the day, panels and the inverter power your home and send surplus to "
        f"the grid. At night you draw from the grid as usual. That keeps upfront cost "
        f"lower and payback around {payback} years. Add storage later only if backup "
        f"during outages matters to you."
    )


def _explain_nighttime_operation(build: dict[str, object]) -> str:
    kwp = build.get("system_kwp")
    battery = build.get("battery_kwh")
    if battery:
        return (
            f"At night your {kwp} kWp array stops producing, but your {battery} kWh "
            f"battery can cover evening use until it needs a top-up. On most days the "
            f"panels recharge it the next morning."
        )
    return (
        f"At night your {kwp} kWp panels aren't producing, so you use grid power just "
        f"like today. That's normal for a grid-tied setup without storage — your "
        f"daytime solar offsets the bill through net metering, and the savings "
        f"estimate already accounts for that day-and-night pattern."
    )


def _explain_outage_without_battery(build: dict[str, object]) -> str:
    return (
        "Without a battery, the system shuts off during a grid outage — that's a "
        "safety requirement for grid-tied installs. You won't have backup power until "
        "the grid returns. If blackout backup matters, try “Ensure backup for "
        "blackouts” in the quick actions and we can look for a storage option."
    )


def _explain_missing_battery_in_build(
    build: dict[str, object],
    snapshot: dict[str, object],
) -> str:
    payback = build.get("payback_years")
    goal = "auto"
    last_solve = snapshot.get("last_solve")
    if isinstance(last_solve, dict):
        constraints = last_solve.get("constraints")
        if isinstance(constraints, dict):
            goal = str(constraints.get("goal", "auto"))
    if goal == "budget":
        reason = (
            "We left storage out to keep upfront cost down and shorten payback."
        )
    elif goal in {"backup", "independence"}:
        reason = (
            "We couldn't fit a battery within your current roof, budget, or "
            "available catalog options."
        )
    else:
        reason = (
            "This auto-optimised layout prioritises bill savings first, and storage "
            "isn't required for that."
        )
    return (
        f"There's no energy store in this design. {reason} You'll still cut daytime "
        f"bills through net metering — payback is about {payback} years. Storage is "
        f"optional if you want backup during outages."
    )


def _explain_payback(build: dict[str, object]) -> str:
    label = str(build.get("label", "This build"))
    payback = build.get("payback_years")
    investment = build.get("total_investment_php")
    monthly = build.get("monthly_savings_php")
    return (
        f"{label} should pay for itself in about {payback} years on a "
        f"₱{float(investment):,.0f} investment. That assumes roughly "
        f"₱{float(monthly):,.0f}/month in bill savings from your solar offset."
    )


def _explain_inverter_choice(build: dict[str, object]) -> str:
    kwp = build.get("system_kwp")
    panels = build.get("panel_count")
    inverter_kw = build.get("inverter_kw")
    utilisation = build.get("inverter_utilisation_pct")
    util_text = f" It's running at about {utilisation}% capacity — a good fit." if utilisation else ""
    return (
        f"We matched a {inverter_kw} kW inverter to your {kwp} kWp array "
        f"({panels} panels) so you're not over- or under-sized.{util_text}"
    )


def _component_for_slot(build: dict[str, object], slot: str) -> dict[str, object] | None:
    components = build.get("components")
    if not isinstance(components, (list, tuple)):
        return None
    for row in components:
        if isinstance(row, dict) and row.get("slot") == slot:
            return row
    return None


def _is_panel_choice_question(question: str) -> bool:
    lowered = question.strip().lower()
    if any(
        token in lowered
        for token in (
            "pv equipment",
            "pv panel",
            "solar panel",
            "panel model",
            "this panel",
            "these panels",
            "that panel",
        )
    ):
        return any(
            token in lowered
            for token in ("why", "how come", "instead", "rather", "not other", "not another", "vs", "versus")
        )
    if re.search(r"\b(ae\d|dm\d|lr\d|jam\d|tsm-|450|440|455|550)\b", lowered):
        return "why" in lowered or "?" in question
    return False


def _is_components_overview_question(question: str) -> bool:
    lowered = question.strip().lower()
    return any(
        phrase in lowered
        for phrase in (
            "why are the components",
            "why is the design",
            "why these components",
            "components like this",
            "equipment like this",
            "bill of materials",
            "what's included",
            "whats included",
            "why should the pv",
            "why should it be",
        )
    )


def _mentioned_panel_tokens(question: str) -> list[str]:
    return re.findall(
        r"\b(?:ae|dm|lr|jam|tsm|hs|srp|q\.peak)[a-z0-9./+-]{2,}\b|\b\d{3}w\b",
        question,
        flags=re.IGNORECASE,
    )


def _panel_matches_token(panel: dict[str, object], token: str) -> bool:
    token_lower = token.lower().replace(" ", "")
    for field in ("model", "brand", "catalog_id", "summary"):
        value = panel.get(field)
        if isinstance(value, str) and token_lower in value.lower().replace(" ", ""):
            return True
    return False


def _find_catalog_panel_by_token(token: str) -> dict[str, object] | None:
    from app.domain.design.catalog import load_catalog

    token_lower = token.lower()
    for panel in load_catalog().panels.values():
        haystack = f"{panel.brand} {panel.model} {panel.id}".lower()
        if token_lower in haystack.replace(" ", ""):
            return {
                "panel_id": panel.id,
                "brand": panel.brand,
                "model": panel.model,
                "wattage_w": panel.wattage_w,
            }
    return None


def _alternative_from_snapshot(
    snapshot: dict[str, object],
    *,
    token: str | None = None,
) -> dict[str, object] | None:
    alternatives = snapshot.get("panel_alternatives")
    if not isinstance(alternatives, list):
        return None
    if token:
        for row in alternatives:
            if isinstance(row, dict) and (
                _panel_matches_token(row, token)
                or token.lower() in str(row.get("model", "")).lower()
            ):
                return row
        catalog_row = _find_catalog_panel_by_token(token)
        if catalog_row:
            panel_id = catalog_row["panel_id"]
            last_solve = snapshot.get("last_solve")
            if isinstance(last_solve, dict):
                valid = last_solve.get("valid")
                if isinstance(valid, list):
                    for combo in valid:
                        if isinstance(combo, dict) and combo.get("panel_id") == panel_id:
                            return {
                                **catalog_row,
                                "fit_score": combo.get("fit_score"),
                                "estimated_cost_php": combo.get("estimated_cost_php"),
                            }
            return catalog_row
        return None
    for row in alternatives:
        if isinstance(row, dict):
            return row
    return None


def _explain_panel_choice(
    build: dict[str, object],
    snapshot: dict[str, object],
    question: str,
) -> str:
    panel = _component_for_slot(build, "panel")
    if panel is None:
        return _explain_conversational_fallback(build, question)

    brand = str(panel.get("brand", "This"))
    model = str(panel.get("model", "panel"))
    specs = panel.get("specs")
    wattage = specs.get("wattage_w") if isinstance(specs, dict) else None
    fit = build.get("fit_score")
    kwp = build.get("system_kwp")
    panel_count = build.get("panel_count")

    wattage_text = f"{wattage}W " if wattage else ""
    opener = (
        f"The {wattage_text}{brand} {model} is on this design because it scored "
        f"best for your {kwp} kWp layout ({panel_count} panels)"
    )
    if fit is not None:
        opener += f" — fit score {fit}"
    opener += ". It pairs cleanly with your inverter and roof limits while hitting your savings goal."

    mentioned = _mentioned_panel_tokens(question)
    for token in mentioned:
        if _panel_matches_token(panel, token):
            continue
        alternative = _alternative_from_snapshot(snapshot, token=token)
        if alternative:
            alt_brand = alternative.get("brand", "Another")
            alt_model = alternative.get("model", "panel")
            alt_fit = alternative.get("fit_score")
            alt_cost = alternative.get("estimated_cost_php")
            comparison = (
                f" {alt_brand} {alt_model} is compatible too"
            )
            if alt_fit is not None:
                comparison += f" (fit {alt_fit})"
            if alt_cost is not None:
                comparison += f" at around ₱{float(alt_cost):,.0f}"
            if fit is not None and alt_fit is not None and float(alt_fit) < float(fit):
                comparison += ", but it ranked lower overall for this goal."
            elif fit is not None and alt_fit is not None and float(alt_fit) >= float(fit):
                comparison += ". You can swap to it from the PV equipment card if you prefer that brand."
            else:
                comparison += ". Open the PV equipment picker to compare options side by side."
            return opener + comparison

        catalog_row = _find_catalog_panel_by_token(token)
        if catalog_row:
            return (
                opener
                + f" I don't see {catalog_row['brand']} {catalog_row['model']} in the "
                f"top-ranked combos for this inverter and roof — it may not pair as "
                f"well or may need a different layout. Use the PV equipment picker to "
                f"check compatibility."
            )

    alternative = _alternative_from_snapshot(snapshot)
    if alternative:
        alt_brand = alternative.get("brand", "Another")
        alt_model = alternative.get("model", "panel")
        return (
            opener
            + f" A close alternative is {alt_brand} {alt_model}; tap the PV equipment "
            f"card to compare compatible panels."
        )

    return (
        opener
        + " Tap the PV equipment card anytime to browse compatible panels and swap."
    )


def _explain_components_overview(build: dict[str, object]) -> str:
    kwp = build.get("system_kwp")
    panel_count = build.get("panel_count")
    inverter_kw = build.get("inverter_kw")
    battery = build.get("battery_kwh")
    storage = f"{battery} kWh storage" if battery else "no battery yet"
    return (
        f"This is a standard Philippine grid-tied layout: {panel_count} panels "
        f"({kwp} kWp) on the roof, a {inverter_kw} kW inverter, then protection "
        f"(disconnects, breakers, surge gear), mounting rails, DC/AC wiring, "
        f"grounding, permits, and a net meter — with {storage}. The solver picked "
        f"each line for compatibility and cost; included items are bundled in your "
        f"quotation breakdown."
    )


def _routing_question(question: str) -> str:
    """Use only the homeowner's words for keyword routing.

    Quote-audit questions arrive with a grounded context prefix from the
    frontend. Matching keywords in that prefix (e.g. "inverter" in audit
    findings) must not override the actual question.
    """
    for line in reversed(question.strip().splitlines()):
        stripped = line.strip()
        if stripped.lower().startswith("question:"):
            return stripped.split(":", 1)[1].strip()
    return question.strip()


def _is_quote_audit_context(question: str) -> bool:
    lowered = question.strip().lower()
    return "uploaded installer quote" in lowered or "quoted total:" in lowered


def _parse_quote_context_amounts(question: str) -> tuple[float | None, float | None]:
    quoted: float | None = None
    benchmark: float | None = None
    for line in question.splitlines():
        stripped = line.strip()
        lower = stripped.lower()
        if lower.startswith("quoted total:"):
            raw = stripped.split(":", 1)[1].strip().replace("PHP", "").replace(",", "").strip()
            try:
                quoted = float(raw)
            except ValueError:
                pass
        if lower.startswith("our benchmark total:"):
            raw = stripped.split(":", 1)[1].strip().replace("PHP", "").replace(",", "").strip()
            try:
                benchmark = float(raw)
            except ValueError:
                pass
    return quoted, benchmark


def _explain_fit_score(build: dict[str, object]) -> str:
    fit = build.get("fit_score")
    kwp = build.get("system_kwp")
    utilisation = build.get("inverter_utilisation_pct")
    if fit is None:
        return (
            "Fit score isn't available for this build yet. It blends roof utilisation, "
            "equipment compatibility, and financial outcomes once the solver finishes."
        )
    util_clause = (
        f" Inverter utilisation is about {utilisation}% on this {kwp} kWp layout."
        if utilisation is not None and kwp is not None
        else ""
    )
    return (
        f"Fit score {float(fit):.1f} is the solver's all-round grade for this build — "
        f"higher means better balance of generation, cost, and equipment match.{util_clause}"
    )


def _explain_rate_rise_for_question(build: dict[str, object], routing: str) -> str:
    monthly = build.get("monthly_savings_php")
    annual = build.get("annual_savings_php")
    payback = build.get("payback_years")
    rise_match = re.search(r"(\d+(?:\.\d+)?)\s*%", routing)
    pct = float(rise_match.group(1)) if rise_match else 5.0
    faster = f" Roughly a {pct:.0f}% rate rise would shorten payback proportionally."
    return (
        f"Higher VECO rates make solar savings worth more over time. This build saves about "
        f"₱{float(monthly):,.0f}/month (₱{float(annual):,.0f}/year) at today's tariff, with "
        f"about {payback} years payback.{faster} Figures use the tariff baked into the solver — "
        f"not a forecast."
    )


def _explain_panel_count_question(build: dict[str, object], routing: str) -> str | None:
    lowered = routing.lower()
    if "panel" not in lowered:
        return None
    if _is_panel_choice_question(routing):
        return None

    count_intent = (
        re.search(r"\b(?:need|require|how many|do i need|should i use)\b.*\bpanel", lowered)
        is not None
        or (
            re.search(r"\b\d+\s*panels?\b", lowered) is not None
            and "why" not in lowered
            and "why not" not in lowered
        )
    )
    if not count_intent:
        return None

    panel_count = build.get("panel_count")
    kwp = build.get("system_kwp")
    asked_match = re.search(r"\b(\d+)\s*panels?\b", lowered)
    if asked_match and panel_count is not None:
        asked = int(asked_match.group(1))
        if asked != int(panel_count):
            return (
                f"The solver sized this roof at {panel_count} panels ({kwp} kWp), not {asked}. "
                f"Panel count follows usable roof area and your usage profile — open Design to "
                f"try a different count and re-run the solver."
            )
    return (
        f"This design uses {panel_count} panels ({kwp} kWp), matched to your traced roof and "
        f"monthly usage. That count balances output, inverter loading, and installed cost."
    )


def _explain_quote_negotiation(
    question: str,
    routing: str,
    build: dict[str, object],
) -> str:
    quoted, benchmark = _parse_quote_context_amounts(question)
    kwp = build.get("system_kwp")
    if quoted is not None and benchmark is not None:
        delta = quoted - benchmark
        if delta > 0:
            return (
                f"The installer quoted ₱{quoted:,.0f} against our ₱{benchmark:,.0f} benchmark "
                f"(₱{delta:,.0f} higher). Use that gap in negotiation — ask which labour, "
                f"permits, warranties, and brands are included, and whether each line matches "
                f"what we'd specify for your {kwp} kWp roof."
            )
        if delta < 0:
            return (
                f"The installer quoted ₱{quoted:,.0f}, which is ₱{abs(delta):,.0f} below our "
                f"₱{benchmark:,.0f} benchmark. Confirm what's included — cheaper quotes sometimes "
                f"omit labour, protection gear, or net-metering support."
            )
        return (
            f"The quoted ₱{quoted:,.0f} lines up with our benchmark. Still confirm line items, "
            f"warranties, and timeline before signing."
        )

    if any(token in routing.lower() for token in ("negotiate", "benchmark", "price gap", "price difference")):
        return (
            "Use the quoted total and our benchmark on this page as anchors. Ask the installer "
            "to itemize panels, inverter, labour, permits, and warranties — then compare each "
            "line to what's in your AI design."
        )
    return (
        "Compare the installer quote line-by-line with our estimate on this page. Focus on "
        "equipment brands, labour, permits, and what's missing before you negotiate."
    )


def _is_off_topic_question(routing: str) -> bool:
    lowered = routing.strip().lower()
    if not lowered:
        return False
    solar_tokens = (
        "panel",
        "inverter",
        "battery",
        "solar",
        "kwp",
        "payback",
        "savings",
        "grid",
        "veco",
        "fit score",
        "quote",
        "benchmark",
        "install",
        "roof",
        "storage",
        "night",
        "blackout",
        "net meter",
        "negotiate",
        "tariff",
        "bill",
        "watt",
        "backup",
        "reject",
        "component",
        "equipment",
        "design",
        "upload",
    )
    if any(token in lowered for token in solar_tokens):
        return False
    if "?" not in routing and len(lowered.split()) > 6:
        return False
    return len(lowered.split()) <= 6


def _explain_off_topic(routing: str) -> str:
    cleaned = routing.strip().rstrip("?")
    return (
        f"I can only explain this solar design and quotation — not \"{cleaned}\". "
        f"Try asking about panel count, savings, payback, equipment choices, or how "
        f"this quote compares to our benchmark."
    )


def _route_explain_question(
    question: str,
    snapshot: dict[str, object],
    build: dict[str, object],
) -> str:
    routing = _routing_question(question)
    lowered = routing.lower()
    payback = build.get("payback_years")
    investment = build.get("total_investment_php")

    if _is_off_topic_question(routing):
        return _explain_off_topic(routing)

    if any(token in lowered for token in ("reject", "rejected", "invalid")):
        rejections = snapshot.get("rejections")
        if isinstance(rejections, list) and rejections:
            reasons = []
            for row in rejections[:3]:
                if isinstance(row, dict) and row.get("message"):
                    reasons.append(str(row["message"]))
            if reasons:
                return (
                    "Some combinations didn't make the cut — for example "
                    + "; ".join(reasons)
                    + ". The active build passed those checks."
                )
        return "I don't have rejection details for the latest solve yet."

    if _is_nighttime_question(lowered):
        return _explain_nighttime_operation(build)

    if _is_outage_question(lowered):
        battery = build.get("battery_kwh")
        if battery:
            return (
                f"Your {battery} kWh battery can keep essentials running during "
                f"a short outage, depending on what you run. For longer blackouts "
                f"you may still need to limit high-draw appliances."
            )
        return _explain_outage_without_battery(build)

    if "payback" in lowered:
        return _explain_payback(build)

    if "fit score" in lowered or "fit_score" in lowered:
        return _explain_fit_score(build)

    if any(
        token in lowered
        for token in ("veco", "rate rise", "rates rise", "tariff", "electricity rate")
    ):
        return _explain_rate_rise_for_question(build, routing)

    if _is_quote_audit_context(question) or any(
        token in lowered
        for token in ("negotiate", "benchmark", "price gap", "price difference", "installer quote")
    ):
        return _explain_quote_negotiation(question, routing, build)

    panel_count_reply = _explain_panel_count_question(build, routing)
    if panel_count_reply is not None:
        return panel_count_reply

    if "inverter" in lowered:
        return _explain_inverter_choice(build)

    if _is_panel_choice_question(routing) or _is_components_overview_question(routing):
        if (
            _is_components_overview_question(routing)
            and "panel" not in lowered
            and not _mentioned_panel_tokens(routing)
        ):
            return _explain_components_overview(build)
        return _explain_panel_choice(build, snapshot, routing)

    if _is_general_battery_question(lowered):
        return _explain_grid_tied_without_battery(build)

    if any(
        token in lowered
        for token in ("energy store", "battery", "storage", "not included")
    ):
        battery = build.get("battery_kwh")
        if battery is None:
            return _explain_missing_battery_in_build(build, snapshot)
        return (
            f"This design includes {battery} kWh of battery storage for backup "
            f"and evening use. Payback is about {payback} years on "
            f"₱{float(investment):,.0f}."
        )

    if any(token in lowered for token in ("savings", "monthly bill", "my bill")):
        monthly = build.get("monthly_savings_php")
        return (
            f"Estimated savings are about ₱{float(monthly):,.0f}/month based on "
            f"your usage and this system's size. Payback on the "
            f"₱{float(investment):,.0f} investment is roughly {payback} years."
        )

    return _explain_conversational_fallback(build, routing)


def _explain_conversational_fallback(build: dict[str, object], question: str = "") -> str:
    lowered = question.strip().lower()
    kwp = build.get("system_kwp")
    panels = build.get("panel_count")
    payback = build.get("payback_years")
    battery = build.get("battery_kwh")

    if any(token in lowered for token in ("component", "equipment", "layout", "design")):
        return _explain_components_overview(build)

    storage_note = (
        f"{battery} kWh storage"
        if battery
        else "no battery — grid-tied with net metering"
    )
    return (
        f"I can walk through any part of this design. Right now it's {kwp} kWp "
        f"({panels} panels) with {storage_note} and about {payback} years payback. "
        f"Ask why a specific panel or inverter was chosen, what happens at night, "
        f"or how to add backup storage."
    )


def _infer_update_build_args(user_text: str, build_id: str) -> dict[str, object]:
    lowered = user_text.lower()
    change_bits: list[str] = []
    if any(token in lowered for token in ("battery", "storage", "backup", "blackout", "brownout")):
        if any(token in lowered for token in ("remove", "drop", "without", "no ")):
            change_bits.append("remove battery storage")
        else:
            change_bits.append("require battery storage")
    if any(token in lowered for token in ("more panel", "add panel", "extra panel", "increase panel")):
        count_match = re.search(r"(\d+|one|two|three|four|five)\s+(?:more\s+)?panels?", lowered)
        if count_match:
            change_bits.append(f"add {count_match.group(1)} panels")
        else:
            change_bits.append("add one panel")
    if any(token in lowered for token in ("fewer panel", "less panel", "remove panel", "decrease panel")):
        count_match = re.search(r"(\d+|one|two|three|four|five)\s+panels?", lowered)
        if count_match:
            change_bits.append(f"remove {count_match.group(1)} panels")
        else:
            change_bits.append("remove one panel")
    if any(token in lowered for token in ("budget", "cheaper", "afford", "cheapest")):
        change_bits.append("optimise for budget")
    swap_verbs = ("swap", "switch", "change", "replace", "upgrade", "downgrade")
    if any(verb in lowered for verb in swap_verbs):
        if "inverter" in lowered:
            change_bits.append("swap inverter")
        elif "panel" in lowered:
            change_bits.append("swap panel")
        elif "batter" in lowered or "storage" in lowered or "energy store" in lowered:
            change_bits.append("swap battery")
    if any(token in lowered for token in ("independence", "self-sufficient", "off-grid", "off grid")):
        change_bits.append("optimise for energy independence")
    budget_match = re.search(
        r"(?:under|below|max|maximum|cap(?:ped)? at|within)\s*(?:₱|php|peso[s]?)?\s*([\d,]+(?:\.\d+)?)\s*(?:k|000)?",
        lowered,
    )
    if budget_match:
        raw = budget_match.group(1).replace(",", "")
        amount = float(raw)
        if amount < 1000:
            amount *= 1000
        change_bits.append(f"set budget to ₱{amount:,.0f}")
    if any(token in lowered for token in ("larger inverter", "bigger inverter", "upgrade inverter")):
        change_bits.append("upgrade to a larger inverter")
    panel_model = re.search(r"\b(?:use|switch to|swap to|try)\s+([a-z]{2,}\d{2,}[a-z0-9./+-]*)\b", lowered)
    if panel_model:
        change_bits.append(f"use {panel_model.group(1)} panels")
    change_request = ", ".join(change_bits) if change_bits else user_text.strip()
    return {"build_id": build_id, "change_request": change_request}


class DisabledDesignAgentClient:
    def build_agent_messages(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> list[dict[str, object]]:
        return [
            {"role": "system", "content": DESIGN_AGENT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"user_text": user_text, "session": session_summary},
                    default=str,
                ),
            },
        ]

    def agent_step(
        self,
        messages: list[dict[str, object]],
    ) -> AgentStepResult:
        has_tool_results = any(message.get("role") == "tool" for message in messages)
        if has_tool_results:
            return AgentStepResult()
        user_payload = next(
            (message["content"] for message in messages if message.get("role") == "user"),
            "{}",
        )
        try:
            payload = json.loads(str(user_payload))
            user_text = str(payload.get("user_text", ""))
            session_summary = payload.get("session", {})
            if not isinstance(session_summary, dict):
                session_summary = {}
        except (TypeError, ValueError, json.JSONDecodeError):
            user_text = str(user_payload)
            session_summary = {}
        return AgentStepResult(
            tool_calls=_plan_disabled_tools(user_text, session_summary),
        )

    def plan_tool_calls(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> tuple[PlannedToolCall, ...]:
        return _plan_disabled_tools(user_text, session_summary)

    def explain_snapshot(
        self,
        *,
        question: str,
        snapshot: dict[str, object],
    ) -> str:
        build = snapshot.get("active_build")
        if not isinstance(build, dict):
            return (
                "No active build is available yet. Run the solver to generate a "
                "design before asking for an explanation."
            )

        return _route_explain_question(question, snapshot, build)

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        active_build: dict[str, object] | None,
    ) -> str:
        return build_agent_turn_reply(
            user_text=user_text,
            tool_audit=tool_audit,
            active_build=active_build,
        )


def build_agent_turn_reply(
    *,
    user_text: str,
    tool_audit: list[dict[str, object]],
    active_build: dict[str, object] | None,
) -> str:
    lowered = user_text.lower()
    remove_verbs = ("remove", "drop", "delete", "take out", "get rid of", "without")

    if tool_audit:
        last = tool_audit[-1]
        name = str(last.get("name", ""))
        result = last.get("result")
        if isinstance(result, dict):
            if result.get("error"):
                message = str(result["error"])
                if message.startswith(("I can't", "I'm not", "That wouldn't", "No cheaper")):
                    return message
                return f"I couldn't do that — {message[0].lower()}{message[1:]}" if message else message

            if name == "generate_quotation" and result.get("total_php") is not None:
                total = float(result["total_php"])
                lines = result.get("line_count", 0)
                return (
                    f"Here's your quotation — ₱{total:,.0f} total "
                    f"({lines} line items). Open the quotation view for the full breakdown."
                )
            if name == "get_rejection_reasons":
                rejections = result.get("rejections")
                if isinstance(rejections, list) and rejections:
                    samples = []
                    for row in rejections[:3]:
                        if isinstance(row, dict) and row.get("message"):
                            samples.append(str(row["message"]))
                    if samples:
                        return (
                            "Some combinations were rejected — for example: "
                            + "; ".join(samples)
                            + ". I can adjust the design if you'd like to retry."
                        )
                return "No rejection details are available for the latest solve."
            if name == "query_catalog":
                items = result.get("items")
                if isinstance(items, list) and items:
                    names = []
                    for row in items[:5]:
                        if isinstance(row, dict):
                            names.append(
                                f"{row.get('brand', '')} {row.get('model', '')}".strip(),
                            )
                    return (
                        "Compatible options include "
                        + ", ".join(name for name in names if name)
                        + ". Use the component picker on the canvas to swap."
                    )
                return "I couldn't find matching catalog items for that query."
            if name == "run_solver":
                kwp = result.get("system_kwp") or (active_build or {}).get("system_kwp")
                investment = result.get("total_investment_php") or (active_build or {}).get(
                    "total_investment_php",
                )
                if kwp is not None and investment is not None:
                    return (
                        f"I re-optimised your design — it's now {kwp} kWp with about "
                        f"₱{float(investment):,.0f} total investment."
                    )
                return "I re-ran the optimiser on your design."
            if name == "update_build":
                if (
                    result.get("swap_slot") == "inverter"
                    and result.get("component_changed")
                    and result.get("new_model")
                ):
                    previous = result.get("previous_model")
                    new_model = result.get("new_model")
                    investment = result.get("total_investment_php")
                    if previous:
                        reply = f"I swapped the inverter from {previous} to {new_model}."
                    else:
                        reply = f"I swapped the inverter to {new_model}."
                    if investment is not None:
                        reply += f" Total investment is about ₱{float(investment):,.0f}."
                    return reply

                previous_battery = result.get("previous_battery_kwh")
                battery = result.get("battery_kwh")
                if previous_battery and not battery:
                    return (
                        "I've removed battery storage from this design — it's grid-tied "
                        "without backup for now."
                    )
                if not previous_battery and battery:
                    return f"I've added {battery} kWh of battery storage to your design."

                previous_panels = result.get("previous_panel_count")
                panels = result.get("panel_count")
                if (
                    previous_panels is not None
                    and panels is not None
                    and previous_panels != panels
                ):
                    delta = int(panels) - int(previous_panels)
                    kwp = result.get("system_kwp")
                    if delta > 0:
                        return (
                            f"I added {delta} panel{'s' if delta != 1 else ''} — "
                            f"you're now at {panels} panels ({kwp} kWp)."
                        )
                    return (
                        f"I removed {abs(delta)} panel{'s' if abs(delta) != 1 else ''} — "
                        f"you're now at {panels} panels ({kwp} kWp)."
                    )

                if any(token in lowered for token in ("budget", "cheaper", "optimi", "afford")):
                    kwp = result.get("system_kwp")
                    investment = result.get("total_investment_php")
                    if kwp is not None and investment is not None:
                        return (
                            f"I adjusted the design for cost — you're at {kwp} kWp with "
                            f"about ₱{float(investment):,.0f} total investment."
                        )

                if any(token in lowered for token in remove_verbs) and any(
                    token in lowered for token in ("battery", "storage", "energy store")
                ):
                    return (
                        "Battery storage is already removed — this build is grid-tied "
                        "without backup."
                    )

    if not active_build:
        return "I wasn't able to update your design."

    kwp = active_build.get("system_kwp")
    panels = active_build.get("panel_count")
    investment = float(active_build.get("total_investment_php", 0))
    payback = active_build.get("payback_years")
    battery = active_build.get("battery_kwh")
    storage_clause = (
        f", including {battery} kWh storage"
        if battery
        else ", without battery backup"
    )
    return (
        f"Your design is at {kwp} kWp ({panels} panels{storage_clause}). "
        f"Estimated investment is about ₱{investment:,.0f} with roughly {payback} years payback."
    )


class GroqDesignAgentClient:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def build_agent_messages(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> list[dict[str, object]]:
        return [
            {"role": "system", "content": DESIGN_AGENT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"user_text": user_text, "session": session_summary},
                    default=str,
                ),
            },
        ]

    def agent_step(
        self,
        messages: list[dict[str, object]],
    ) -> AgentStepResult:
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": messages,
                    "tools": list(DESIGN_TOOL_SCHEMAS),
                    "tool_choice": "auto",
                },
                timeout=15.0,
            )
            response.raise_for_status()
            message = response.json()["choices"][0]["message"]
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                content = message.get("content")
                return AgentStepResult(
                    final_reply=str(content) if content else None,
                )
            planned: list[PlannedToolCall] = []
            for call in tool_calls:
                fn = call["function"]
                args_raw = fn.get("arguments", "{}")
                args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
                planned.append(
                    PlannedToolCall(name=str(fn["name"]), arguments=dict(args)),
                )
            return AgentStepResult(
                tool_calls=tuple(planned),
                assistant_message=message,
            )
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return AgentStepResult()

    def plan_tool_calls(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> tuple[PlannedToolCall, ...]:
        messages = self.build_agent_messages(
            user_text=user_text,
            session_summary=session_summary,
        )
        planned: list[PlannedToolCall] = []
        try:
            for _ in range(MAX_TOOL_ITERATIONS):
                step = self.agent_step(messages)
                if step.final_reply and not step.tool_calls:
                    break
                if not step.tool_calls:
                    break
                planned.extend(step.tool_calls)
                if step.assistant_message:
                    messages.append(step.assistant_message)
                for index, call in enumerate(step.tool_calls):
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": f"preview-{index}",
                            "content": json.dumps({"status": "preview_only"}),
                        },
                    )
                if len(planned) >= MAX_TOOL_ITERATIONS:
                    break
        except (TypeError, ValueError):
            planned.clear()

        if not planned:
            return DisabledDesignAgentClient().plan_tool_calls(
                user_text=user_text,
                session_summary=session_summary,
            )
        return tuple(planned[:MAX_TOOL_ITERATIONS])

    def explain_snapshot(
        self,
        *,
        question: str,
        snapshot: dict[str, object],
    ) -> str:
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": EXPLAIN_DESIGN_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": json.dumps(
                                {"question": question, "snapshot": snapshot},
                                default=str,
                            ),
                        },
                    ],
                },
                timeout=15.0,
            )
            response.raise_for_status()
            return str(response.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return DisabledDesignAgentClient().explain_snapshot(
                question=question,
                snapshot=snapshot,
            )

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        active_build: dict[str, object] | None,
    ) -> str:
        if not active_build:
            return "Design session updated."
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": DESIGN_AGENT_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": json.dumps(
                                {
                                    "user_text": user_text,
                                    "tool_audit": tool_audit,
                                    "active_build": active_build,
                                },
                                default=str,
                            ),
                        },
                    ],
                },
                timeout=15.0,
            )
            response.raise_for_status()
            return str(response.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return DisabledDesignAgentClient().generate_turn_reply(
                user_text=user_text,
                tool_audit=tool_audit,
                active_build=active_build,
            )
