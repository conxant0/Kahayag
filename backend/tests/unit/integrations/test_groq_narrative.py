import json

import httpx

from app.features.reports.validator import build_report_input
from app.integrations.ai.groq import GROQ_CHAT_COMPLETIONS_URL, GroqAIProvider


def test_groq_provider_returns_valid_structured_narrative(
    monkeypatch, completed_assessment
) -> None:
    payload = {
        "executive_summary": "The preliminary system appears promising.",
        "technical_explanation": "Verify the roof and electrical service on site.",
        "financial_explanation": "Confirm the planning range in a quotation.",
        "contractor_observations": [
            "Measure the roof.",
            "Inspect the service panel.",
            "Confirm cable routing.",
        ],
    }

    def respond(*_args, **_kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("POST", GROQ_CHAT_COMPLETIONS_URL),
            json={"choices": [{"message": {"content": json.dumps(payload)}}]},
        )

    monkeypatch.setattr("app.integrations.ai.groq.httpx.post", respond)

    narrative = GroqAIProvider(api_key="test-key", model="test-model").write(
        build_report_input(completed_assessment)
    )

    assert narrative is not None
    assert narrative.contractor_observations == tuple(payload["contractor_observations"])
