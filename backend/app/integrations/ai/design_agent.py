# Defines Groq and disabled implementations for the design agent tool loop.

import json
import re
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.integrations.ai.design_tools import (
    DESIGN_AGENT_SYSTEM_PROMPT,
    DESIGN_TOOL_SCHEMAS,
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
        return (
            f"{build.get('label', 'Active build')}: {build.get('system_kwp')} kWp, "
            f"{build.get('panel_count')} panels, inverter {build.get('inverter_kw')} kW, "
            f"investment ₱{build.get('total_investment_php')}, payback "
            f"{build.get('payback_years')} years. {build.get('insight', '')} "
            f"Question: {question.strip()}"
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
                        {"role": "system", "content": DESIGN_AGENT_SYSTEM_PROMPT},
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
