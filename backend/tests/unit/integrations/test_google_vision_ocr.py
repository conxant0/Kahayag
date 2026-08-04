# Defines Google Cloud Vision OCR unit tests.

import httpx
import pytest

from app.integrations.quote_parsing.google_vision_ocr import (
    VISION_ANNOTATE_URL,
    GoogleVisionOcrClient,
)


def test_google_vision_ocr_returns_document_text(monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(*_args: object, **_kwargs: object) -> httpx.Response:
        return httpx.Response(
            200,
            request=httpx.Request("POST", VISION_ANNOTATE_URL),
            json={
                "responses": [
                    {
                        "fullTextAnnotation": {
                            "text": "Grand Total 1,165,700\n3,870 Watts",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("app.integrations.quote_parsing.google_vision_ocr.httpx.post", respond)

    text = GoogleVisionOcrClient(api_key="test-key").transcribe_image(
        content=b"fake-image",
        mime_type="image/jpeg",
    )

    assert "Grand Total 1,165,700" in text


def test_google_vision_ocr_surfaces_api_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(*_args: object, **_kwargs: object) -> httpx.Response:
        return httpx.Response(
            403,
            request=httpx.Request("POST", VISION_ANNOTATE_URL),
            text='{"error":{"message":"API not enabled"}}',
        )

    monkeypatch.setattr("app.integrations.quote_parsing.google_vision_ocr.httpx.post", respond)

    with pytest.raises(ValueError, match="Cloud Vision API is not enabled"):
        GoogleVisionOcrClient(api_key="test-key").transcribe_image(
            content=b"fake-image",
            mime_type="image/jpeg",
        )


def test_get_quote_image_transcriber_prefers_google_vision() -> None:
    from app.core.config import Settings
    from app.integrations.quote_parsing import get_quote_image_transcriber

    settings = Settings(
        quote_ocr_provider="google_vision",
        google_cloud_vision_api_key="vision-key",
    )
    transcriber = get_quote_image_transcriber(settings)
    assert transcriber is not None
    assert transcriber.__class__.__name__ == "GoogleVisionOcrClient"
