# Defines AI report-writer integrations.
from app.core.config import Settings
from app.integrations.ai.disabled import DisabledAIProvider
from app.integrations.ai.groq import GroqAIProvider
from app.integrations.ai.provider import AIReportProvider


def get_ai_provider(settings: Settings) -> AIReportProvider:
    if settings.ai_provider == "groq" and settings.groq_api_key:
        return GroqAIProvider(api_key=settings.groq_api_key, model=settings.groq_model)
    return DisabledAIProvider()
