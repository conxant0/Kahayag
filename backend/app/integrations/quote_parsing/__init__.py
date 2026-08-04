# Defines quote parsing integrations and OCR provider selection.

from app.core.config import Settings
from app.integrations.ai.quote_auditor import GroqQuoteAuditorClient, QuoteAuditorClient
from app.integrations.quote_parsing.document_reader import QuoteImageTranscriber
from app.integrations.quote_parsing.google_vision_ocr import GoogleVisionOcrClient


def get_quote_image_transcriber(
    settings: Settings,
    *,
    quote_client: QuoteAuditorClient | None = None,
) -> QuoteImageTranscriber | None:
    if settings.quote_ocr_provider == "google_vision":
        api_key = settings.google_cloud_vision_api_key or settings.google_solar_api_key
        if api_key:
            return GoogleVisionOcrClient(api_key=api_key)
        return None
    if settings.quote_ocr_provider == "groq" and isinstance(
        quote_client, GroqQuoteAuditorClient
    ):
        return quote_client
    return None
