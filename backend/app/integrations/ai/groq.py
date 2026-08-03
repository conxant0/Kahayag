# Defines the Groq-backed AI report-writer implementation.
import json

import httpx

from app.features.reports.schemas import ReportNarrative, ValidatedReportInput

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"

# AI must only narrate already-validated numbers, never recompute them (see DEVELOPER_GUIDE.md).
SYSTEM_PROMPT = (
    "Write concise, cautious English prose for a preliminary solar report. "
    "Do not calculate, alter, or invent numbers, brands, guarantees, or measured "
    "site conditions. Return JSON with executive_summary, technical_explanation, "
    "financial_explanation, and three to five contractor_observations."
)


class GroqAIProvider:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def explain(self, *, summary: str, values: dict[str, float]) -> str:
        response = httpx.post(
            GROQ_CHAT_COMPLETIONS_URL,
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": summary},
                ],
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    def write(self, report: ValidatedReportInput) -> ReportNarrative | None:
        summary = {
            "property_locality": report.property.address,
            "roof_area_m2": str(report.roof.usable_area_m2),
            "panel_count": report.recommendation.panel_count,
            "system_capacity_kwp": str(report.recommendation.system_capacity_kwp),
            "annual_generation_kwh": str(report.recommendation.annual_generation_kwh),
            "annual_savings_php": report.financials.annual_savings_php,
            "payback_years": str(report.financials.payback_years),
            "limitations": report.limitations,
        }
        try:
            response = httpx.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(summary)},
                    ],
                },
                timeout=10.0,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return ReportNarrative.model_validate(json.loads(content))
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return None
