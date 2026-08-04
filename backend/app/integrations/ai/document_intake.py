# Defines Groq and disabled document-intake clients for uploaded permit
# documents. The model only reads documents into fields; every acceptance
# verdict is a deterministic comparison in app/features/permits/intake.py.

import json
import re
from typing import Protocol

import httpx

from app.integrations.ai.groq import GROQ_CHAT_COMPLETIONS_URL

DocumentFields = dict[str, str | None]

_FIELD_KEYS = (
    "registered_owner_name",
    "property_address",
    "tct_number",
    "tax_declaration_number",
    "issue_date",
)

_EXTRACT_PROMPT = (
    "Extract facts from a Philippine permit or property document. Return JSON "
    "with keys registered_owner_name, property_address, tct_number, "
    "tax_declaration_number, and issue_date (all strings or null). Use null "
    "when a value is not explicitly stated. Do not guess or infer values that "
    "are not written in the text."
)

_SUMMARY_PROMPT = (
    "Write a short plain-language summary for a homeowner of the permit "
    "document findings listed in the user message. Use only the findings "
    "given. Do not invent new facts, documents, or numbers."
)

_FIELD_PATTERNS: dict[str, tuple[str, ...]] = {
    "registered_owner_name": (
        r"registered owner[:\s]+([A-Za-z.,'\-\s]{3,60})",
        r"owner'?s?\s+name[:\s]+([A-Za-z.,'\-\s]{3,60})",
        r"name of owner[:\s]+([A-Za-z.,'\-\s]{3,60})",
    ),
    "property_address": (
        r"property address[:\s]+([^\n]{3,120})",
        r"located at[:\s]+([^\n]{3,120})",
        r"address[:\s]+([^\n]{3,120})",
    ),
    "tct_number": (
        r"transfer certificate of title\s*no\.?\s*([\w\-]+)",
        r"\btct\s*no\.?\s*([\w\-]+)",
    ),
    "tax_declaration_number": (
        r"tax declaration\s*no\.?\s*([\w\-]+)",
        r"\bard?\s*no\.?\s*([\w\-]+)",
    ),
    "issue_date": (
        r"date issued[:\s]+([\w,/\-\s]{6,20})",
        r"issued on[:\s]+([\w,/\-\s]{6,20})",
        r"issued[:\s]+([\w,/\-\s]{6,20})",
    ),
}


def regex_extract_document_fields(text: str) -> DocumentFields:
    fields: DocumentFields = dict.fromkeys(_FIELD_KEYS)
    for key, patterns in _FIELD_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields[key] = match.group(1).strip().rstrip(".,")
                break
    return fields


class DocumentIntakeClient(Protocol):
    def extract_document_fields(self, *, document_text: str) -> DocumentFields: ...

    def summarize_findings(self, *, findings: tuple[str, ...]) -> str: ...


class DisabledDocumentIntakeClient:
    def extract_document_fields(self, *, document_text: str) -> DocumentFields:
        return regex_extract_document_fields(document_text)

    def summarize_findings(self, *, findings: tuple[str, ...]) -> str:
        if not findings:
            return "All submitted documents matched what was expected. No issues found."
        return " ".join(findings)


class GroqDocumentIntakeClient:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def extract_document_fields(self, *, document_text: str) -> DocumentFields:
        if not document_text.strip():
            return dict.fromkeys(_FIELD_KEYS)
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
            return {key: payload.get(key) for key in _FIELD_KEYS}
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return regex_extract_document_fields(document_text)

    def summarize_findings(self, *, findings: tuple[str, ...]) -> str:
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": _SUMMARY_PROMPT},
                        {"role": "user", "content": json.dumps({"findings": list(findings)})},
                    ],
                },
                timeout=20.0,
            )
            response.raise_for_status()
            return str(response.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return DisabledDocumentIntakeClient().summarize_findings(findings=findings)
