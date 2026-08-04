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


class DesignAgentClient(Protocol):
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
    if any(token in lowered for token in ("budget", "cheaper", "afford", "cost")):
        return "budget"
    if any(token in lowered for token in ("backup", "blackout", "outage")):
        return "backup"
    if any(token in lowered for token in ("independence", "self-sufficient", "off-grid")):
        return "independence"
    return "auto"


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
    if any(token in lowered for token in ("battery", "storage", "backup")):
        change_bits.append("require battery storage")
    if any(token in lowered for token in ("more panel", "add panel", "extra panel")):
        change_bits.append("add one panel")
    if any(token in lowered for token in ("fewer panel", "less panel", "remove panel")):
        change_bits.append("remove one panel")
    if any(token in lowered for token in ("budget", "cheaper", "afford")):
        change_bits.append("optimise for budget")
    change_request = ", ".join(change_bits) if change_bits else user_text.strip()
    return {"build_id": build_id, "change_request": change_request}


class DisabledDesignAgentClient:
    def plan_tool_calls(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> tuple[PlannedToolCall, ...]:
        active_build_id = str(session_summary.get("active_build_id", ""))
        goal = _infer_goal_from_text(user_text)
        if active_build_id and re.search(
            r"\b(panel|battery|inverter|change|swap|update|more|fewer|add|remove)\b",
            user_text,
            re.IGNORECASE,
        ):
            return (
                PlannedToolCall(
                    name="update_build",
                    arguments=_infer_update_build_args(user_text, active_build_id),
                ),
            )
        return (PlannedToolCall(name="run_solver", arguments={"goal": goal}),)

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

        lowered = question.strip().lower()
        payback = build.get("payback_years")
        investment = build.get("total_investment_php")

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

        if "inverter" in lowered:
            return _explain_inverter_choice(build)

        if _is_panel_choice_question(question) or _is_components_overview_question(question):
            if (
                _is_components_overview_question(question)
                and "panel" not in lowered
                and not _mentioned_panel_tokens(question)
            ):
                return _explain_components_overview(build)
            return _explain_panel_choice(build, snapshot, question)

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

        return _explain_conversational_fallback(build, question)

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        active_build: dict[str, object] | None,
    ) -> str:
        if not active_build:
            return "Design session updated."
        kwp = active_build.get("system_kwp")
        panels = active_build.get("panel_count")
        investment = float(active_build.get("total_investment_php", 0))
        payback = active_build.get("payback_years")
        return (
            f"Done — updated to {kwp} kWp ({panels} panels). "
            f"Investment is now ₱{investment:,.0f} with about {payback} years payback."
        )


class GroqDesignAgentClient:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def plan_tool_calls(
        self,
        *,
        user_text: str,
        session_summary: dict[str, object],
    ) -> tuple[PlannedToolCall, ...]:
        messages: list[dict[str, object]] = [
            {"role": "system", "content": DESIGN_AGENT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"user_text": user_text, "session": session_summary},
                    default=str,
                ),
            },
        ]
        planned: list[PlannedToolCall] = []
        try:
            for _ in range(MAX_TOOL_ITERATIONS):
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
                    break
                messages.append(message)
                for call in tool_calls:
                    fn = call["function"]
                    args_raw = fn.get("arguments", "{}")
                    args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
                    planned.append(
                        PlannedToolCall(name=str(fn["name"]), arguments=dict(args)),
                    )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call["id"],
                            "content": json.dumps({"status": "queued"}),
                        },
                    )
                if len(planned) >= MAX_TOOL_ITERATIONS:
                    break
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
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
