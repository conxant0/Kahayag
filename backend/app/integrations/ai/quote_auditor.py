# Defines Groq and disabled quote-auditor clients for uploaded installer quotes.

import json
import re
from typing import Protocol

import httpx

from app.integrations.ai.groq import GROQ_CHAT_COMPLETIONS_URL

_EXTRACT_PROMPT = (
    "Extract solar quote facts from the document text. Return JSON with keys "
    "total_php (number or null), system_kwp (number or null), panel_count "
    "(integer or null), and notes (string). Use null when a value is not "
    "explicitly stated. Do not guess or calculate missing values."
)

_SUMMARY_PROMPT = (
    "Write two short paragraphs for a homeowner comparing an outside installer "
    "quote to Kahayag's benchmark build. Use only the numeric facts provided "
    "in the user message. Do not invent prices, capacities, or payback figures."
)


def regex_extract_quote_facts(text: str) -> dict[str, float | int | None]:
    total_match = re.search(
        r"(?:total|amount due|grand total)[^\d₱Pp]{0,40}(?:₱|PHP|Php)?\s*([\d,]+(?:\.\d+)?)",
        text,
        re.IGNORECASE,
    )
    kwp_match = re.search(r"([\d.]+)\s*kWp?", text, re.IGNORECASE)
    panel_match = re.search(
        r"([\d]+)\s*(?:x|\×)?\s*(?:panels?|modules?)",
        text,
        re.IGNORECASE,
    )
    return {
        "total_php": float(total_match.group(1).replace(",", ""))
        if total_match
        else None,
        "system_kwp": float(kwp_match.group(1)) if kwp_match else None,
        "panel_count": int(panel_match.group(1)) if panel_match else None,
    }


class QuoteAuditorClient(Protocol):
    def extract_quote_facts(self, *, document_text: str) -> dict[str, float | int | None]: ...

    def summarize_audit(
        self,
        *,
        benchmark: dict[str, float | int],
        extracted: dict[str, float | int | None],
        findings: tuple[str, ...],
    ) -> str: ...


class DisabledQuoteAuditorClient:
    def extract_quote_facts(self, *, document_text: str) -> dict[str, float | int | None]:
        return regex_extract_quote_facts(document_text)

    def summarize_audit(
        self,
        *,
        benchmark: dict[str, float | int],
        extracted: dict[str, float | int | None],
        findings: tuple[str, ...],
    ) -> str:
        lead = findings[0] if findings else "No structured findings were available."
        return (
            f"{lead} Kahayag benchmark: {benchmark['system_kwp']:.2f} kWp, "
            f"{benchmark['panel_count']} panels, total investment "
            f"₱{benchmark['total_investment_php']:,.0f}."
        )


class GroqQuoteAuditorClient:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def extract_quote_facts(self, *, document_text: str) -> dict[str, float | int | None]:
        if not document_text.strip():
            return {"total_php": None, "system_kwp": None, "panel_count": None}
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _EXTRACT_PROMPT},
                        {"role": "user", "content": document_text[:12000]},
                    ],
                },
                timeout=20.0,
            )
            response.raise_for_status()
            payload = json.loads(response.json()["choices"][0]["message"]["content"])
            return {
                "total_php": payload.get("total_php"),
                "system_kwp": payload.get("system_kwp"),
                "panel_count": payload.get("panel_count"),
            }
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return regex_extract_quote_facts(document_text)

    def summarize_audit(
        self,
        *,
        benchmark: dict[str, float | int],
        extracted: dict[str, float | int | None],
        findings: tuple[str, ...],
    ) -> str:
        facts = {
            "benchmark_total_php": benchmark["total_investment_php"],
            "benchmark_system_kwp": benchmark["system_kwp"],
            "benchmark_panel_count": benchmark["panel_count"],
            "extracted_total_php": extracted.get("total_php"),
            "extracted_system_kwp": extracted.get("system_kwp"),
            "extracted_panel_count": extracted.get("panel_count"),
            "findings": list(findings),
        }
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": _SUMMARY_PROMPT},
                        {"role": "user", "content": json.dumps(facts, default=str)},
                    ],
                },
                timeout=20.0,
            )
            response.raise_for_status()
            return str(response.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return DisabledQuoteAuditorClient().summarize_audit(
                benchmark=benchmark,
                extracted=extracted,
                findings=findings,
            )
