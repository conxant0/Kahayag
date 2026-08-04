# Defines Groq and disabled quote-auditor clients for uploaded installer quotes.

import base64
import json
import re
from typing import Protocol

import httpx

from app.integrations.ai.groq import GROQ_CHAT_COMPLETIONS_URL

GROQ_VISION_MODEL = "qwen/qwen3.6-27b"


def _clean_vision_transcription(text: str) -> str:
    think_close = "</" + "think" + ">"
    lowered = text.lower()
    if think_close in lowered:
        tail = text[lowered.rfind(think_close) + len(think_close) :].strip()
        if tail:
            return tail

    think_open = "<" + "think" + ">"
    cleaned = re.sub(
        re.escape(think_open) + r".*?" + re.escape(think_close),
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )
    cleaned = re.sub(r"</?think>", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<reasoning>.*?</reasoning>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()

_EXTRACT_PROMPT = (
    "Extract solar installer quote facts from the document text. Return JSON with keys "
    "total_php (number or null), system_kwp (number or null), panel_count "
    "(integer or null), and notes (string). "
    "Use the final quoted total (Grand Total, Total Bill, Amount Due) when present. "
    "If only total wattage is stated (e.g. 3870 W or 3,870 Watts), set system_kwp to "
    "watts divided by 1000. Treat PKR, PHP, and ₱ amounts as numeric values without "
    "currency conversion. Use null when a value is not explicitly stated. "
    "Do not guess by summing line items unless no grand total exists."
)

_SUMMARY_PROMPT = (
    "Write two short paragraphs for a homeowner comparing an outside installer "
    "quote to Kahayag's benchmark build. Use only the numeric facts provided "
    "in the user message. Do not invent prices, capacities, or payback figures."
)

_EXTRACT_LINES_PROMPT = (
    "Extract installer quote line items from the document text. Return JSON with key "
    '"lines": an array of objects with keys slot (panel|inverter|battery|protection|'
    "structure|electrical|installation), brand, model, qty, unit, line_total_php, "
    "and summary. Use only values explicitly stated in the quote. Use null when "
    "unknown. Do not invent equipment that is not listed."
)

_IMAGE_TRANSCRIBE_PROMPT = (
    "Transcribe this installer quotation image exactly. Preserve all table rows, "
    "descriptions, quantities, unit prices, totals, currency labels (PHP, PKR, ₱), "
    "and headings such as Grand Total or Total Bill. Output plain text only."
)


def _parse_amount(raw: str) -> float:
    return float(raw.replace(",", "").strip())


def _extract_total_php(text: str) -> float | None:
    labeled_patterns = (
        (
            r"(?:grand\s+total|total\s+bill|amount\s+due|net\s+(?:amount|total)|"
            r"total\s+(?:amount|price|investment|cost))[^\d₱PpKk]{0,40}"
            r"(?:₱|PHP|PKR|Php|Pkr)?\s*:?\s*([\d][\d,]*(?:\.\d+)?)"
        ),
        r"(?:₱|PHP|PKR|Php)\s*([\d][\d,]*(?:\.\d+)?)\s*$",
        r"Grand Total\s+([\d][\d,]*(?:\.\d+)?)",
    )
    for pattern in labeled_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return _parse_amount(match.group(1))

    trailing_totals = re.findall(
        r"(?:₱|PHP|PKR|Php)\s*([\d][\d,]*(?:\.\d+)?)",
        text,
        re.IGNORECASE,
    )
    if trailing_totals:
        return _parse_amount(trailing_totals[-1])

    comma_amounts = re.findall(r"\b([\d]{1,3}(?:,\d{3})+)\b", text)
    if comma_amounts:
        values = [_parse_amount(value) for value in comma_amounts]
        plausible = [value for value in values if 10_000 <= value <= 50_000_000]
        if plausible:
            return max(plausible)

    return None


def _extract_system_kwp(text: str) -> float | None:
    kwp_match = re.search(r"([\d.]+)\s*kWp?\b", text, re.IGNORECASE)
    if kwp_match:
        return float(kwp_match.group(1))

    watt_patterns = (
        r"([\d.]+)\s*(?:x|\×)\s*([\d]+)\s*=\s*([\d,]+)\s*watts?\b",
        r"=\s*([\d,]+)\s*watts?\b",
        r"\b([\d,]{3,6})\s*watts?\b",
        r"\b([\d,]{3,6})\s*W\b",
    )
    watt_values: list[float] = []
    for pattern in watt_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            if pattern.startswith(r"([\d.]+)"):
                watts = _parse_amount(match.group(3))
            else:
                watts = _parse_amount(match.group(1))
            if 500 <= watts <= 500_000:
                watt_values.append(watts)
    if watt_values:
        return round(max(watt_values) / 1000, 2)

    panel_watt_match = re.search(
        r"([\d.]+)\s*(?:w|watts?)\b[^.\n]{0,80}([\d]+)\s*(?:x|\×|pcs|panels?|modules?)",
        text,
        re.IGNORECASE,
    )
    if panel_watt_match:
        watts = float(panel_watt_match.group(1))
        count = int(panel_watt_match.group(2))
        if 100 <= watts <= 1000 and 1 <= count <= 500:
            return round(watts * count / 1000, 2)

    reverse_panel_match = re.search(
        r"([\d]+)\s*(?:x|\×)\s*([\d.]+)\s*(?:w|watts?)\b",
        text,
        re.IGNORECASE,
    )
    if reverse_panel_match:
        count = int(reverse_panel_match.group(1))
        watts = float(reverse_panel_match.group(2))
        if 100 <= watts <= 1000 and 1 <= count <= 500:
            return round(watts * count / 1000, 2)

    return None


def _extract_panel_count(text: str) -> int | None:
    calc_match = re.search(
        r"([\d.]+)\s*(?:x|\×)\s*([\d]+)\s*=\s*([\d,]+)\s*watts?\b",
        text,
        re.IGNORECASE,
    )
    if calc_match:
        count = int(calc_match.group(2))
        if 1 <= count <= 500:
            return count

    explicit_patterns = (
        r"([\d]+)\s*(?:x|\×)?\s*(?:nos\.?|pcs\.?|panels?|modules?)\b",
        r"([\d]+)\s*(?:panels?|modules?)\b",
    )
    for pattern in explicit_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            count = int(match.group(1))
            if 1 <= count <= 500:
                return count

    reverse_panel_match = re.search(
        r"([\d]+)\s*(?:x|\×)\s*([\d.]+)\s*(?:w|watts?)\b",
        text,
        re.IGNORECASE,
    )
    if reverse_panel_match:
        count = int(reverse_panel_match.group(1))
        if 1 <= count <= 500:
            return count

    table_row_match = re.search(
        r"solar\s+panels?[^\n]*?(\d{1,3})\s+[\d,]{4,}",
        text,
        re.IGNORECASE,
    )
    if table_row_match:
        count = int(table_row_match.group(1))
        if 1 <= count <= 500:
            return count

    return None


def regex_extract_quote_facts(text: str) -> dict[str, float | int | None]:
    return {
        "total_php": _extract_total_php(text),
        "system_kwp": _extract_system_kwp(text),
        "panel_count": _extract_panel_count(text),
    }


def classify_quote_line(description: str) -> str:
    lowered = description.lower()
    if any(word in lowered for word in ("panel", "module", "pv")):
        return "panel"
    if "inverter" in lowered:
        return "inverter"
    if any(word in lowered for word in ("battery", "lithium", "storage")):
        return "battery"
    if any(word in lowered for word in ("mount", "rail", "structure")):
        return "structure"
    if any(word in lowered for word in ("cable", "wire", "conduit")):
        return "electrical"
    if any(word in lowered for word in ("breaker", "spd", "surge", "protection")):
        return "protection"
    if any(word in lowered for word in ("install", "labour", "labor", "permit")):
        return "installation"
    return "installation"


def regex_extract_quote_lines(text: str) -> list[dict[str, object]]:
    lines: list[dict[str, object]] = []
    row_pattern = re.compile(
        r"^\s*\d+\s+"
        r"(?P<desc>.+?)\s+"
        r"(?P<qty>\d+)\s+"
        r"(?P<unit_price>[\d,]+)\s+"
        r"(?P<line_total>[\d,]+)\s*$",
        re.IGNORECASE | re.MULTILINE,
    )
    for match in row_pattern.finditer(text):
        desc = match.group("desc").strip()
        qty = int(match.group("qty"))
        line_total = _parse_amount(match.group("line_total"))
        parts = desc.split()
        brand = parts[1] if len(parts) > 1 else "Quoted"
        model = parts[2] if len(parts) > 2 else desc
        lines.append(
            {
                "slot": classify_quote_line(desc),
                "brand": brand,
                "model": model,
                "qty": qty,
                "unit": "pcs",
                "line_total_php": line_total,
                "summary": desc,
            },
        )

    inverter_match = re.search(
        r"(?P<brand>\w+)\s+(?P<model>[\w-]+)?\s*(?:Hybrid\s+)?Inverter",
        text,
        re.IGNORECASE,
    )
    if inverter_match and not any(line.get("slot") == "inverter" for line in lines):
        lines.append(
            {
                "slot": "inverter",
                "brand": inverter_match.group("brand"),
                "model": inverter_match.group("model") or "Inverter",
                "qty": 1,
                "unit": "pcs",
                "line_total_php": None,
                "summary": inverter_match.group(0),
            },
        )

    return lines


def merge_quote_facts(
    primary: dict[str, float | int | None],
    fallback: dict[str, float | int | None],
) -> dict[str, float | int | None]:
    merged: dict[str, float | int | None] = {}
    for key in ("total_php", "system_kwp", "panel_count"):
        primary_value = primary.get(key)
        fallback_value = fallback.get(key)
        if key == "total_php":
            if isinstance(primary_value, (int, float)) and primary_value >= 10_000:
                merged[key] = float(primary_value)
            elif isinstance(fallback_value, (int, float)):
                merged[key] = float(fallback_value)
            elif isinstance(primary_value, (int, float)):
                merged[key] = float(primary_value)
            else:
                merged[key] = None
            continue
        merged[key] = (
            primary_value if primary_value is not None else fallback_value
        )
    return merged


class QuoteAuditorClient(Protocol):
    def extract_quote_facts(self, *, document_text: str) -> dict[str, float | int | None]: ...

    def extract_quote_lines(self, *, document_text: str) -> list[dict[str, object]]: ...

    def transcribe_image(self, *, content: bytes, mime_type: str) -> str: ...

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

    def extract_quote_lines(self, *, document_text: str) -> list[dict[str, object]]:
        return regex_extract_quote_lines(document_text)

    def transcribe_image(self, *, content: bytes, mime_type: str) -> str:
        return ""

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
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        vision_model: str = GROQ_VISION_MODEL,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._vision_model = vision_model or GROQ_VISION_MODEL

    def extract_quote_facts(self, *, document_text: str) -> dict[str, float | int | None]:
        regex_facts = regex_extract_quote_facts(document_text)
        if not document_text.strip():
            return regex_facts
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
                timeout=30.0,
            )
            response.raise_for_status()
            payload = json.loads(response.json()["choices"][0]["message"]["content"])
            ai_facts = {
                "total_php": payload.get("total_php"),
                "system_kwp": payload.get("system_kwp"),
                "panel_count": payload.get("panel_count"),
            }
            return merge_quote_facts(ai_facts, regex_facts)
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return regex_facts

    def extract_quote_lines(self, *, document_text: str) -> list[dict[str, object]]:
        regex_lines = regex_extract_quote_lines(document_text)
        if not document_text.strip():
            return regex_lines
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _EXTRACT_LINES_PROMPT},
                        {"role": "user", "content": document_text[:12000]},
                    ],
                },
                timeout=30.0,
            )
            response.raise_for_status()
            payload = json.loads(response.json()["choices"][0]["message"]["content"])
            raw_lines = payload.get("lines")
            if not isinstance(raw_lines, list):
                return regex_lines
            ai_lines = [line for line in raw_lines if isinstance(line, dict)]
            return ai_lines or regex_lines
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return regex_lines

    def transcribe_image(self, *, content: bytes, mime_type: str) -> str:
        encoded = base64.standard_b64encode(content).decode("ascii")
        model = self._vision_model
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": _IMAGE_TRANSCRIBE_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{mime_type};base64,{encoded}",
                                    },
                                },
                            ],
                        }
                    ],
                    "temperature": 0,
                    "max_tokens": 8192,
                },
                timeout=90.0,
            )
            response.raise_for_status()
            raw_text = str(response.json()["choices"][0]["message"]["content"])
            text = _clean_vision_transcription(raw_text)
            if text:
                return text
            if raw_text.strip():
                return raw_text.strip()
            raise ValueError(f"{model} returned an empty transcription.")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                raise ValueError(
                    "Quote image reading hit a Groq rate limit. Wait 30 seconds and try again."
                ) from exc
            detail = exc.response.text[:240].replace("\n", " ")
            raise ValueError(
                f"Could not read the quotation image with {model}. {detail or exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ValueError(
                f"Could not reach Groq to read the quotation image ({model})."
            ) from exc

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
                timeout=30.0,
            )
            response.raise_for_status()
            return str(response.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return DisabledQuoteAuditorClient().summarize_audit(
                benchmark=benchmark,
                extracted=extracted,
                findings=findings,
            )
