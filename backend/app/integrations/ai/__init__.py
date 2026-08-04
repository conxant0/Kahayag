# Defines AI report-writer and design-agent integrations.
from app.core.config import Settings
from app.integrations.ai.design_agent import (
    DesignAgentClient,
    DisabledDesignAgentClient,
    GroqDesignAgentClient,
)
from app.integrations.ai.disabled import DisabledAIProvider
from app.integrations.ai.groq import GroqAIProvider
from app.integrations.ai.provider import AIReportProvider


def get_ai_provider(settings: Settings) -> AIReportProvider:
    if settings.ai_provider == "groq" and settings.groq_api_key:
        return GroqAIProvider(api_key=settings.groq_api_key, model=settings.groq_model)
    return DisabledAIProvider()


def get_design_agent_client(settings: Settings) -> DesignAgentClient:
    if settings.ai_provider == "groq" and settings.groq_api_key:
        return GroqDesignAgentClient(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        )
    return DisabledDesignAgentClient()
