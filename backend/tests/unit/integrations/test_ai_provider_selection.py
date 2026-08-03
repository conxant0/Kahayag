from app.core.config import Settings
from app.integrations.ai import get_ai_provider
from app.integrations.ai.disabled import DisabledAIProvider
from app.integrations.ai.groq import GroqAIProvider


def test_disabled_when_no_provider_selected():
    settings = Settings(ai_provider="disabled", groq_api_key="")
    assert isinstance(get_ai_provider(settings), DisabledAIProvider)


def test_disabled_when_groq_selected_without_key():
    settings = Settings(ai_provider="groq", groq_api_key="")
    assert isinstance(get_ai_provider(settings), DisabledAIProvider)


def test_groq_when_selected_with_key():
    settings = Settings(ai_provider="groq", groq_api_key="test-key")
    assert isinstance(get_ai_provider(settings), GroqAIProvider)


def test_disabled_provider_passes_summary_through_unchanged():
    provider = DisabledAIProvider()
    assert provider.explain(summary="fixed text", values={"kwh": 123.0}) == "fixed text"
