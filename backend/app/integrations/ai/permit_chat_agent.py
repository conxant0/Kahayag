# Defines Groq and disabled implementations for the permits chat turn: tool
# planning (applicant inputs only) and grounded Q&A. The model never writes a
# finding, severity, status, or verdict — app.features.permits.chat is solely
# responsible for recomputing those deterministically after any tool call.

import json
import re
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.integrations.ai.groq import GROQ_CHAT_COMPLETIONS_URL
from app.integrations.ai.permit_chat_tools import (
    MAX_TOOL_ITERATIONS,
    PERMIT_CHAT_SYSTEM_PROMPT,
    PERMIT_CHAT_TOOL_SCHEMAS,
    PERMIT_QA_SYSTEM_PROMPT,
)


@dataclass(frozen=True)
class PlannedPermitToolCall:
    name: str
    arguments: dict[str, object]


class PermitChatClient(Protocol):
    def plan_tool_calls(
        self,
        *,
        user_text: str,
        applicant: dict[str, object],
        uploaded_filenames: tuple[str, ...],
    ) -> tuple[PlannedPermitToolCall, ...]: ...

    def answer_question(
        self,
        *,
        user_text: str,
        grounding: dict[str, object],
    ) -> str: ...

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        assessment: dict[str, object],
    ) -> str: ...


_TRACK_ANSWER_PATTERN = re.compile(r"\boriginal (?:building )?permit\b", re.IGNORECASE)
_NAME_PATTERN = re.compile(
    r"(?:my name is|call me|i am)\s+([A-Za-z.'\- ]{2,60})", re.IGNORECASE
)
_OWNER_NAME_PATTERN = re.compile(
    r"owner(?:'s)? name is\s+([A-Za-z.'\- ]{2,60})", re.IGNORECASE
)
_ASSIGN_PATTERN = re.compile(
    r"(?:assign|use|put)\s+([\w.\-]+\.\w+)\s+(?:for|as|to)\s+(\w+)", re.IGNORECASE
)
_CLEAR_PATTERN = re.compile(r"clear\s+(?:the\s+)?(\w+)\s+slot", re.IGNORECASE)


# Generic words shared across many catalog titles ("Barangay Clearance",
# "Locational Clearance", ...) — stripped before matching so a question only
# matches the entry it actually names, not the first title sharing a common
# suffix word.
_GENERIC_TITLE_WORDS = frozenset(
    {
        "clearance",
        "certificate",
        "permit",
        "permits",
        "document",
        "documents",
        "final",
        "original",
        "valid",
        "government",
        "issued",
        "proof",
    }
)


def _distinguishing_tokens(label: str) -> list[str]:
    tokens = [token for token in re.split(r"\W+", label.lower()) if len(token) > 3]
    return [token for token in tokens if token not in _GENERIC_TITLE_WORDS]


def _match_catalog_entry(
    lowered_question: str, grounding: dict[str, object]
) -> dict[str, object] | None:
    candidates = list(grounding.get("documents", [])) + list(grounding.get("permits", []))
    for entry in candidates:
        if not isinstance(entry, dict):
            continue
        label = str(entry.get("title") or entry.get("name") or "")
        tokens = _distinguishing_tokens(label)
        if tokens and all(token in lowered_question for token in tokens):
            return entry
    return None


def _match_finding(
    lowered_question: str, grounding: dict[str, object]
) -> tuple[dict[str, object] | None, dict[str, object] | None]:
    docs_by_id = {
        str(doc["id"]): doc
        for doc in grounding.get("documents", [])
        if isinstance(doc, dict)
    }
    for finding in grounding.get("findings", []):
        if not isinstance(finding, dict):
            continue
        doc = docs_by_id.get(str(finding.get("document_id")))
        if not doc:
            continue
        tokens = _distinguishing_tokens(str(doc["title"]))
        if tokens and all(token in lowered_question for token in tokens):
            return finding, doc
    return None, None


def _cite(entry: dict[str, object], *, message: str) -> str:
    reply = message
    source_url = entry.get("source_url")
    if source_url:
        reply = f"{reply} Source: {source_url}"
    if entry.get("unverified"):
        reply = (
            "This requirement could not be confirmed in research and should "
            f"be checked with the issuing office. {reply}"
        )
    return reply


class DisabledPermitChatClient:
    def plan_tool_calls(
        self,
        *,
        user_text: str,
        applicant: dict[str, object],
        uploaded_filenames: tuple[str, ...],
    ) -> tuple[PlannedPermitToolCall, ...]:
        lowered = user_text.lower()
        calls: list[PlannedPermitToolCall] = []

        if _TRACK_ANSWER_PATTERN.search(lowered):
            if "not sure" in lowered:
                answer = "not_sure"
            elif re.search(r"\bno\b", lowered):
                answer = "no"
            elif re.search(r"\byes\b", lowered):
                answer = "yes"
            else:
                answer = None
            if answer:
                calls.append(
                    PlannedPermitToolCall("set_original_permit_track", {"answer": answer})
                )

        name_match = _NAME_PATTERN.search(user_text)
        if name_match:
            calls.append(
                PlannedPermitToolCall(
                    "set_applicant_name", {"full_name": name_match.group(1).strip()}
                )
            )

        if "not the registered owner" in lowered or "not the owner" in lowered:
            owner_match = _OWNER_NAME_PATTERN.search(user_text)
            calls.append(
                PlannedPermitToolCall(
                    "set_owner_answer",
                    {
                        "is_registered_owner": False,
                        "registered_owner_name": owner_match.group(1).strip()
                        if owner_match
                        else None,
                    },
                )
            )
        elif "i am the registered owner" in lowered or "i am the owner" in lowered:
            calls.append(
                PlannedPermitToolCall(
                    "set_owner_answer",
                    {"is_registered_owner": True, "registered_owner_name": None},
                )
            )

        assign_match = _ASSIGN_PATTERN.search(user_text)
        if assign_match:
            calls.append(
                PlannedPermitToolCall(
                    "assign_document_slot",
                    {"filename": assign_match.group(1), "slot_id": assign_match.group(2)},
                )
            )
        else:
            clear_match = _CLEAR_PATTERN.search(user_text)
            if clear_match:
                calls.append(
                    PlannedPermitToolCall(
                        "assign_document_slot",
                        {"filename": None, "slot_id": clear_match.group(1)},
                    )
                )

        return tuple(calls)

    def answer_question(
        self,
        *,
        user_text: str,
        grounding: dict[str, object],
    ) -> str:
        lowered = user_text.lower()

        finding, doc = _match_finding(lowered, grounding)
        if finding is not None and doc is not None:
            return _cite(doc, message=str(finding["message"]))

        entry = _match_catalog_entry(lowered, grounding)
        if entry is not None:
            label = entry.get("title") or entry.get("name")
            basis = entry.get("legal_basis", "")
            message = f"{label} is required under {basis}."
            return _cite(entry, message=message)

        return (
            "The permit catalog doesn't cover that question. Ask about a "
            "specific document or permit, such as the barangay clearance or "
            "the OBO building permit."
        )

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        assessment: dict[str, object],
    ) -> str:
        if not tool_audit:
            return "I didn't catch anything to update. Could you rephrase?"

        def _failed(entry: dict[str, object]) -> bool:
            result = entry.get("result")
            return isinstance(result, dict) and bool(result.get("error"))

        errors = [str(entry["result"]["error"]) for entry in tool_audit if _failed(entry)]
        applied = [
            str(entry["name"]).replace("_", " ") for entry in tool_audit if not _failed(entry)
        ]
        reply = f"Updated: {', '.join(applied)}." if applied else "No changes were applied."
        reply = f"{reply} Packet status is now {assessment.get('packet_status')}."
        if errors:
            reply = f"{reply} {' '.join(errors)}"
        return reply


class GroqPermitChatClient:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def plan_tool_calls(
        self,
        *,
        user_text: str,
        applicant: dict[str, object],
        uploaded_filenames: tuple[str, ...],
    ) -> tuple[PlannedPermitToolCall, ...]:
        messages: list[dict[str, object]] = [
            {"role": "system", "content": PERMIT_CHAT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "user_text": user_text,
                        "applicant": applicant,
                        "uploaded_filenames": list(uploaded_filenames),
                    },
                    default=str,
                ),
            },
        ]
        planned: list[PlannedPermitToolCall] = []
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": messages,
                    "tools": list(PERMIT_CHAT_TOOL_SCHEMAS),
                    "tool_choice": "auto",
                },
                timeout=15.0,
            )
            response.raise_for_status()
            message = response.json()["choices"][0]["message"]
            for call in message.get("tool_calls") or []:
                fn = call["function"]
                args_raw = fn.get("arguments", "{}")
                args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
                planned.append(PlannedPermitToolCall(name=str(fn["name"]), arguments=dict(args)))
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            planned.clear()

        if not planned:
            return DisabledPermitChatClient().plan_tool_calls(
                user_text=user_text,
                applicant=applicant,
                uploaded_filenames=uploaded_filenames,
            )
        return tuple(planned[:MAX_TOOL_ITERATIONS])

    def answer_question(
        self,
        *,
        user_text: str,
        grounding: dict[str, object],
    ) -> str:
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": PERMIT_QA_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": json.dumps(
                                {"question": user_text, "grounding": grounding},
                                default=str,
                            ),
                        },
                    ],
                },
                timeout=15.0,
            )
            response.raise_for_status()
            content = str(response.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return DisabledPermitChatClient().answer_question(
                user_text=user_text,
                grounding=grounding,
            )

        # The system prompt asks the model to cite source_url and surface
        # unverified — but nothing stops it from ignoring that. Since this is
        # a hard requirement (T4), fall back to the deterministic Disabled
        # answer whenever the model's reply doesn't actually contain the
        # citation/flag a matched grounding entry requires.
        lowered = user_text.lower()
        _finding, doc = _match_finding(lowered, grounding)
        entry = doc if doc is not None else _match_catalog_entry(lowered, grounding)
        if entry is not None:
            source_url = entry.get("source_url")
            cites_source = bool(source_url) and str(source_url) in content
            surfaces_unverified = not entry.get("unverified") or any(
                token in content.lower() for token in ("unverified", "not confirmed", "confirm")
            )
            if not (cites_source and surfaces_unverified):
                return DisabledPermitChatClient().answer_question(
                    user_text=user_text,
                    grounding=grounding,
                )
        return content

    def generate_turn_reply(
        self,
        *,
        user_text: str,
        tool_audit: list[dict[str, object]],
        assessment: dict[str, object],
    ) -> str:
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": PERMIT_CHAT_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": json.dumps(
                                {
                                    "user_text": user_text,
                                    "tool_audit": tool_audit,
                                    "assessment": assessment,
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
            return DisabledPermitChatClient().generate_turn_reply(
                user_text=user_text,
                tool_audit=tool_audit,
                assessment=assessment,
            )
