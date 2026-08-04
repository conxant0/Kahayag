# Defines Google Cloud Vision OCR for quote image transcription.

import base64

import httpx

VISION_ANNOTATE_URL = "https://vision.googleapis.com/v1/images:annotate"


class GoogleVisionOcrClient:
    def __init__(self, *, api_key: str) -> None:
        self._api_key = api_key

    def transcribe_image(self, *, content: bytes, mime_type: str) -> str:
        encoded = base64.standard_b64encode(content).decode("ascii")
        try:
            response = httpx.post(
                VISION_ANNOTATE_URL,
                params={"key": self._api_key},
                json={
                    "requests": [
                        {
                            "image": {"content": encoded},
                            "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                        }
                    ]
                },
                timeout=60.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 403:
                raise ValueError(
                    "Google Cloud Vision API is not enabled or the API key lacks access. "
                    "Enable Cloud Vision API in Google Cloud Console for this project."
                ) from exc
            detail = exc.response.text[:240].replace("\n", " ")
            raise ValueError(
                "Google Cloud Vision OCR failed "
                f"({exc.response.status_code}). {detail or 'Unknown error'}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ValueError("Could not reach Google Cloud Vision OCR.") from exc

        payload = response.json()
        responses = payload.get("responses") or []
        if not responses:
            raise ValueError("Google Cloud Vision returned no OCR result.")

        error = responses[0].get("error")
        if error:
            message = str(error.get("message", "Unknown Vision API error"))
            raise ValueError(f"Google Cloud Vision OCR error: {message}")

        full_text = str(responses[0].get("fullTextAnnotation", {}).get("text", ""))
        if full_text.strip():
            return full_text.strip()

        annotations = responses[0].get("textAnnotations") or []
        if annotations:
            text = str(annotations[0].get("description", ""))
            if text.strip():
                return text.strip()

        raise ValueError("Google Cloud Vision found no text in the image.")
