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
    "Residential solar quotes in the Philippines are typically at least PHP 100,000. "
    "Never use a line-item quantity (such as 1 inverter or 1 unit) as total_php or panel_count. "
    "panel_count is the number of PV modules only, not inverters or batteries. "
    "If only total wattage is stated (e.g. 3870 W or 3,870 Watts), set system_kwp to "
    "watts divided by 1000. Treat PKR, PHP, and ₱ amounts as numeric values without "
    "currency conversion. Use null when a value is not explicitly stated. "
    "If no grand total is stated, set total_php to the sum of explicit line totals."
)

_SUMMARY_PROMPT = (
    "Write a short, plain-language quote review for a homeowner who knows little "
    "about solar. Use everyday words — explain 'inverter' as the box that turns "
    "solar power into home electricity if you mention it. Avoid jargon like kWp, "
    "BOS, MPPT, hybrid, or catalog tiers unless you immediately explain them. "
    "Cover: overall verdict, whether the price seems fair, whether the parts look "
    "complete, and anything missing or unclear. Use only the facts in the user "
    "message — do not invent prices or savings. End with one simple recommendation."
)

_EXTRACT_LINES_PROMPT = (
    "Extract installer quote line items from the document text. Return JSON with key "
    '"lines": an array of objects with keys slot (panel|inverter|battery|protection|'
    "structure|electrical|installation), brand, model, qty, unit, line_total_php, "
    "and summary. Use only values explicitly stated in the quote. Use null when "
    "unknown. Do not invent equipment that is not listed. "
    "line_total_php must be the peso amount for that row, not quantity."
)

_IMAGE_TRANSCRIBE_PROMPT = (
    "Transcribe this installer quotation image exactly. Preserve all table rows, "
    "descriptions, quantities, unit prices, totals, currency labels (PHP, PKR, ₱), "
    "and headings such as Grand Total or Total Bill. Output plain text only."
)


def _parse_amount(raw: str) -> float:
    return float(raw.replace(",", "").strip())


MIN_PLAUSIBLE_QUOTE_TOTAL_PHP = 10_000
MIN_PANEL_WATTAGE_W = 100
MAX_PANEL_WATTAGE_W = 750
TYPICAL_PANEL_WATTAGE_W = 550
TOTAL_LINE_SUM_TOLERANCE = 0.25


def is_plausible_quote_total(value: float | None) -> bool:
    return isinstance(value, (int, float)) and value >= MIN_PLAUSIBLE_QUOTE_TOTAL_PHP


def _extract_labeled_total_php(text: str) -> float | None:
    pattern = (
        r"(?:grand\s+total|total\s+bill|amount\s+due|net\s+(?:amount|total)|"
        r"total\s+(?:amount|price|investment|cost))[^\d₱PpKk]{0,40}"
        r"(?:₱|PHP|PKR|Php|Pkr)?\s*:?\s*([\d][\d,]*(?:\.\d+)?)"
    )
    matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
    for raw in reversed(matches):
        value = _parse_amount(raw)
        if is_plausible_quote_total(value):
            return value
    return None


def _extract_total_php(text: str) -> float | None:
    labeled = _extract_labeled_total_php(text)
    if labeled is not None:
        return labeled

    trailing_totals = re.findall(
        r"(?:₱|PHP|PKR|Php)\s*([\d][\d,]*(?:\.\d+)?)",
        text,
        re.IGNORECASE,
    )
    plausible_trailing = [
        _parse_amount(raw)
        for raw in trailing_totals
        if is_plausible_quote_total(_parse_amount(raw))
    ]
    if plausible_trailing:
        return plausible_trailing[-1]

    comma_amounts = re.findall(r"\b([\d]{1,3}(?:,\d{3})+)\b", text)
    if comma_amounts:
        values = [_parse_amount(value) for value in comma_amounts]
        plausible = [
            value
            for value in values
            if MIN_PLAUSIBLE_QUOTE_TOTAL_PHP <= value <= 50_000_000
        ]
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


def _line_mentions_panels(line: str) -> bool:
    lowered = line.lower()
    return any(word in lowered for word in ("panel", "module", " pv", "pv "))


def _line_mentions_inverter_or_battery(line: str) -> bool:
    lowered = line.lower()
    return any(
        word in lowered for word in ("inverter", "battery", "storage", "powerwall", "ess")
    )


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

    table_row_match = re.search(
        r"(?:\d+\s+)?(?:solar\s+)?panels?\b.+?\b(\d{1,3})\s+[\d,]{3,}\s+[\d,]{3,}",
        text,
        re.IGNORECASE,
    )
    if table_row_match:
        count = int(table_row_match.group(1))
        if 1 <= count <= 500:
            return count

    panel_line_patterns = (
        r"(?:\d+\s+)?(?:solar\s+)?panels?\b.+?\b(\d{1,3})\s+[\d,]{3,}\s+[\d,]{3,}",
        r"(\d{1,3})\s*(?:x|\×)?\s*(?:nos\.?|pcs\.?|units?)\s*(?:of\s+)?(?:solar\s+)?(?:panels?|modules?)\b",
        r"(?<![\d,])(\d{1,3})\s*(?:solar\s+)?(?:panels?|modules?|pv\s+modules?)\b",
    )
    for line in text.splitlines():
        if not _line_mentions_panels(line) or _line_mentions_inverter_or_battery(line):
            continue
        for pattern in panel_line_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
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
        watts = float(reverse_panel_match.group(2))
        if 100 <= watts <= 1000 and 1 <= count <= 500:
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


def _quote_line_from_match(
    *,
    desc: str,
    qty: int,
    line_total: float,
    unit: str = "pcs",
) -> dict[str, object]:
    parts = desc.split()
    brand = parts[1] if len(parts) > 1 else "Quoted"
    model = parts[2] if len(parts) > 2 else desc
    return {
        "slot": classify_quote_line(desc),
        "brand": brand,
        "model": model,
        "qty": qty,
        "unit": unit,
        "line_total_php": line_total,
        "summary": desc.strip(),
    }


def regex_extract_quote_lines(text: str) -> list[dict[str, object]]:
    lines: list[dict[str, object]] = []
    seen: set[tuple[str, float]] = set()

    row_patterns = (
        re.compile(
            r"^\s*\d+\s+"
            r"(?P<desc>.+?)\s+"
            r"(?P<qty>\d+)\s+"
            r"(?P<unit_price>[\d,]+)\s+"
            r"(?P<line_total>[\d,]+)\s*$",
            re.IGNORECASE | re.MULTILINE,
        ),
        re.compile(
            r"^\s*(?:\d+\s+)?(?P<desc>.+?(?:panel|inverter|battery|lithium|mount|install|labou?r|cable|breaker|protection).+?)\s+"
            r"(?P<qty>\d+)\s+"
            r"(?P<unit_price>[\d,]+)\s+"
            r"(?P<line_total>[\d,]+)\s*$",
            re.IGNORECASE | re.MULTILINE,
        ),
    )
    for pattern in row_patterns:
        for match in pattern.finditer(text):
            desc = match.group("desc").strip()
            qty = int(match.group("qty"))
            line_total = _parse_amount(match.group("line_total"))
            key = (desc.lower(), line_total)
            if key in seen or not is_plausible_quote_total(line_total):
                continue
            seen.add(key)
            lines.append(_quote_line_from_match(desc=desc, qty=qty, line_total=line_total))

    keyword_line = re.compile(
        r"^(?P<desc>.+(?:panel|inverter|battery|lithium|mount|install|labou?r).+?)\s+"
        r"(?:(?P<qty>\d+)\s+)?"
        r"(?P<line_total>[\d]{1,3}(?:,\d{3})+)\s*$",
        re.IGNORECASE,
    )
    for raw_line in text.splitlines():
        match = keyword_line.match(raw_line.strip())
        if not match:
            continue
        desc = match.group("desc").strip()
        qty_raw = match.group("qty")
        qty = int(qty_raw) if qty_raw else 1
        line_total = _parse_amount(match.group("line_total"))
        key = (desc.lower(), line_total)
        if key in seen or not is_plausible_quote_total(line_total):
            continue
        seen.add(key)
        lines.append(_quote_line_from_match(desc=desc, qty=qty, line_total=line_total))

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


def merge_quote_lines(
    ai_lines: list[dict[str, object]],
    regex_lines: list[dict[str, object]],
) -> list[dict[str, object]]:
    merged: list[dict[str, object]] = [dict(line) for line in regex_lines]

    def find_match(candidate: dict[str, object]) -> dict[str, object] | None:
        slot = candidate.get("slot")
        for line in merged:
            if line.get("slot") == slot:
                return line
        return None

    for ai_line in ai_lines:
        match = find_match(ai_line)
        if match is None:
            merged.append(dict(ai_line))
            continue
        ai_total = ai_line.get("line_total_php")
        match_total = match.get("line_total_php")
        if not isinstance(match_total, (int, float)) and isinstance(ai_total, (int, float)) or (
            isinstance(ai_total, (int, float))
            and isinstance(match_total, (int, float))
            and float(ai_total) > float(match_total)
        ):
            match["line_total_php"] = ai_total
        ai_qty = ai_line.get("qty")
        if match.get("slot") == "panel" and isinstance(ai_qty, (int, float)):
            match_qty = match.get("qty")
            if not isinstance(match_qty, (int, float)) or ai_qty > match_qty:
                match["qty"] = int(ai_qty)
        for key in ("brand", "model", "summary", "unit"):
            if not match.get(key) and ai_line.get(key):
                match[key] = ai_line[key]
    return merged


def is_plausible_panel_count(
    count: float | None,
    system_kwp: float | None,
) -> bool:
    if not isinstance(count, (int, float)):
        return False
    panel_count = int(count)
    if panel_count < 1 or panel_count > 500:
        return False
    if isinstance(system_kwp, (int, float)) and system_kwp > 0:
        implied_w = system_kwp * 1000 / panel_count
        return MIN_PANEL_WATTAGE_W <= implied_w <= MAX_PANEL_WATTAGE_W
    return panel_count >= 2


def panel_count_from_lines(raw_lines: list[dict[str, object]]) -> int | None:
    best: int | None = None
    for raw in raw_lines:
        slot = str(raw.get("slot") or "").lower()
        summary = str(raw.get("summary") or raw.get("model") or "")
        if slot != "panel" and classify_quote_line(summary) != "panel":
            continue
        qty = raw.get("qty")
        if isinstance(qty, (int, float)) and qty >= 1:
            count = int(qty)
            if best is None or count > best:
                best = count
    return best


def estimate_panel_count_from_kwp(system_kwp: float) -> int:
    return max(1, round(system_kwp * 1000 / TYPICAL_PANEL_WATTAGE_W))


def resolve_panel_count(
    extracted: dict[str, float | int | None],
    raw_lines: list[dict[str, object]],
) -> int | None:
    system_kwp = extracted.get("system_kwp")
    kwp = float(system_kwp) if isinstance(system_kwp, (int, float)) else None

    for candidate in (extracted.get("panel_count"), panel_count_from_lines(raw_lines)):
        if isinstance(candidate, (int, float)) and is_plausible_panel_count(
            int(candidate),
            kwp,
        ):
            return int(candidate)

    if kwp is not None and kwp >= 1.0:
        estimated = estimate_panel_count_from_kwp(kwp)
        if is_plausible_panel_count(estimated, kwp):
            return estimated
    return None


def sum_quote_line_totals(raw_lines: list[dict[str, object]]) -> float | None:
    total = 0.0
    found = False
    for raw in raw_lines:
        line_total = raw.get("line_total_php")
        if isinstance(line_total, (int, float)) and line_total > 0:
            total += float(line_total)
            found = True
    if not found or total < MIN_PLAUSIBLE_QUOTE_TOTAL_PHP:
        return None
    return round(total, 2)


def sum_component_line_totals(components: tuple[object, ...] | None) -> float | None:
    if not components:
        return None
    total = 0.0
    found = False
    for component in components:
        line_total = getattr(component, "line_total_php", None)
        if isinstance(line_total, (int, float)) and line_total > 0:
            total += float(line_total)
            found = True
    if not found or total < MIN_PLAUSIBLE_QUOTE_TOTAL_PHP:
        return None
    return round(total, 2)


def resolve_quote_total_php(
    extracted: dict[str, float | int | None],
    raw_lines: list[dict[str, object]],
    diagram_components: tuple[object, ...] | None = None,
    *,
    document_text: str = "",
) -> float | None:
    labeled_total = _extract_labeled_total_php(document_text) if document_text else None
    fact_total = extracted.get("total_php")
    line_sum = sum_quote_line_totals(raw_lines)
    component_sum = sum_component_line_totals(diagram_components)

    if line_sum is not None:
        for candidate in (
            labeled_total,
            float(fact_total) if is_plausible_quote_total(fact_total) else None,
        ):
            if candidate is None:
                continue
            delta_ratio = abs(candidate - line_sum) / line_sum
            if delta_ratio <= TOTAL_LINE_SUM_TOLERANCE:
                return candidate
        if labeled_total is not None and labeled_total > line_sum * 1.05:
            return labeled_total
        return line_sum

    for candidate in (
        labeled_total,
        float(fact_total) if is_plausible_quote_total(fact_total) else None,
        component_sum,
    ):
        if candidate is not None and is_plausible_quote_total(candidate):
            return candidate
    return None


def merge_quote_facts(
    primary: dict[str, float | int | None],
    fallback: dict[str, float | int | None],
) -> dict[str, float | int | None]:
    merged: dict[str, float | int | None] = {}
    for key in ("total_php", "system_kwp", "panel_count"):
        primary_value = primary.get(key)
        fallback_value = fallback.get(key)
        if key == "total_php":
            if is_plausible_quote_total(primary_value):
                merged[key] = float(primary_value)  # type: ignore[arg-type]
            elif is_plausible_quote_total(fallback_value):
                merged[key] = float(fallback_value)  # type: ignore[arg-type]
            else:
                merged[key] = None
            continue
        if key == "panel_count":
            kwp_raw = merged.get("system_kwp")
            if kwp_raw is None:
                kwp_raw = (
                    primary.get("system_kwp")
                    if primary.get("system_kwp") is not None
                    else fallback.get("system_kwp")
                )
            kwp = float(kwp_raw) if isinstance(kwp_raw, (int, float)) else None
            if is_plausible_panel_count(primary_value, kwp):
                merged[key] = int(primary_value)  # type: ignore[arg-type]
            elif is_plausible_panel_count(fallback_value, kwp):
                merged[key] = int(fallback_value)  # type: ignore[arg-type]
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
        pros: tuple[str, ...] = (),
        cons: tuple[str, ...] = (),
        verdict: str = "needs_review",
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
        pros: tuple[str, ...] = (),
        cons: tuple[str, ...] = (),
        verdict: str = "needs_review",
    ) -> str:
        lead = findings[0] if findings else "We couldn't pull out enough detail from this quote."
        verdict_labels = {
            "favorable": "looks like a fair deal",
            "caution": "worth a closer look",
            "needs_review": "needs a careful review before you sign",
        }
        verdict_label = verdict_labels.get(verdict, verdict.replace("_", " "))
        return (
            f"{lead} Overall, this quote {verdict_label}. "
            f"For your roof we'd expect about {benchmark['system_kwp']:.1f} kW "
            f"({benchmark['panel_count']} panels) at roughly "
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
            return merge_quote_facts(regex_facts, ai_facts)
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
            return merge_quote_lines(ai_lines, regex_lines) if ai_lines else regex_lines
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
        pros: tuple[str, ...] = (),
        cons: tuple[str, ...] = (),
        verdict: str = "needs_review",
    ) -> str:
        facts = {
            "verdict": verdict,
            "benchmark_total_php": benchmark["total_investment_php"],
            "benchmark_system_kwp": benchmark["system_kwp"],
            "benchmark_panel_count": benchmark["panel_count"],
            "extracted_total_php": extracted.get("total_php"),
            "extracted_system_kwp": extracted.get("system_kwp"),
            "extracted_panel_count": extracted.get("panel_count"),
            "findings": list(findings),
            "pros": list(pros),
            "cons": list(cons),
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
                pros=pros,
                cons=cons,
                verdict=verdict,
            )
