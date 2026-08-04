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
        label = str(build.get("label", "Active build"))
        kwp = build.get("system_kwp")
        panels = build.get("panel_count")
        inverter_kw = build.get("inverter_kw")
        investment = build.get("total_investment_php")
        payback = build.get("payback_years")
        insight = str(build.get("insight", "")).strip()

        if any(token in lowered for token in ("reject", "rejected", "invalid")):
            rejections = snapshot.get("rejections")
            if isinstance(rejections, list) and rejections:
                reasons = []
                for row in rejections[:3]:
                    if isinstance(row, dict) and row.get("message"):
                        reasons.append(str(row["message"]))
                if reasons:
                    return (
                        "The solver rejected other combinations because "
                        + "; ".join(reasons)
                        + "."
                    )
            return "No rejection details are available for the latest solve yet."

        if "payback" in lowered:
            return (
                f"Estimated payback for {label} is {payback} years on an investment "
                f"of ₱{float(investment):,.0f}. {insight}"
            ).strip()

        if "inverter" in lowered:
            return (
                f"{label} pairs a {inverter_kw} kW inverter with a {kwp} kWp array "
                f"({panels} panels). {insight}"
            ).strip()

        if any(
            token in lowered
            for token in ("energy store", "battery", "storage", "not included")
        ):
            battery = build.get("battery_kwh")
            if battery is None:
                goal = "auto"
                last_solve = snapshot.get("last_solve")
                if isinstance(last_solve, dict):
                    constraints = last_solve.get("constraints")
                    if isinstance(constraints, dict):
                        goal = str(constraints.get("goal", "auto"))
                if goal == "budget":
                    reason = (
                        "The budget-focused solve prioritised lower upfront cost, "
                        "so it kept a grid-tied layout without storage."
                    )
                elif goal in {"backup", "independence"}:
                    reason = (
                        "The solver could not fit a battery within the current roof, "
                        "budget, or catalog constraints."
                    )
                else:
                    reason = (
                        "The current auto-optimised layout targets savings first and "
                        "does not require battery storage."
                    )
                return f"No energy store is in this build. {reason}".strip()
            return (
                f"{label} includes {battery} kWh of battery storage. {insight}"
            ).strip()

        if any(token in lowered for token in ("why", "how", "what", "explain")):
            if insight:
                return insight
            return (
                f"{label} is a {kwp} kWp system ({panels} panels, {inverter_kw} kW "
                f"inverter) with an estimated payback of {payback} years."
            )

        return (
            f"{label}: {kwp} kWp, {panels} panels, {inverter_kw} kW inverter, "
            f"investment ₱{float(investment):,.0f}, payback {payback} years. "
            f"{insight}"
        ).strip()

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        active_build: dict[str, object] | None,
    ) -> str:
        if not active_build:
            return "Design session updated."
        return (
            f"Updated design to {active_build.get('system_kwp')} kWp "
            f"({active_build.get('panel_count')} panels). "
            f"Investment ₱{float(active_build.get('total_investment_php', 0)):,.0f}; "
            f"payback {active_build.get('payback_years')} years."
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
