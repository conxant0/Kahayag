# Defines quote document text extraction from PDF, text, and image uploads.

import io
from typing import Protocol

from app.integrations.quote_parsing.image_normalize import prepare_image_for_vision
from app.integrations.quote_parsing.local_ocr import transcribe_image_local

IMAGE_EXTENSIONS = frozenset(
    {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic"}
)
TEXT_EXTENSIONS = frozenset({".txt", ".csv", ".md"})
MAX_QUOTE_UPLOAD_BYTES = 10 * 1024 * 1024

_MIME_BY_EXTENSION = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".heic": "image/heic",
}


class QuoteImageTranscriber(Protocol):
    def transcribe_image(self, *, content: bytes, mime_type: str) -> str: ...


def validate_quote_upload(filename: str, content: bytes) -> None:
    if not content:
        raise ValueError("Uploaded file is empty.")
    if len(content) > MAX_QUOTE_UPLOAD_BYTES:
        raise ValueError("Upload is too large. Maximum size is 10 MB.")
    lowered = filename.lower()
    if lowered.endswith(".pdf") or _extension(lowered) in IMAGE_EXTENSIONS | TEXT_EXTENSIONS:
        return
    if content[:4] == b"%PDF":
        return
    raise ValueError(
        "Unsupported file type. Upload a PDF, image (PNG/JPG), or text quote."
    )


def read_quote_document(
    filename: str,
    content: bytes,
    *,
    transcriber: QuoteImageTranscriber | None = None,
) -> str:
    validate_quote_upload(filename, content)
    lowered = filename.lower()
    extension = _extension(lowered)

    if extension in IMAGE_EXTENSIONS or _looks_like_image(content):
        mime_type = _MIME_BY_EXTENSION.get(extension, "image/jpeg")
        prepared_content, prepared_mime = prepare_image_for_vision(content, mime_type)
        vision_errors: list[str] = []
        if transcriber is not None:
            try:
                text = transcriber.transcribe_image(
                    content=prepared_content,
                    mime_type=prepared_mime,
                )
                if text.strip():
                    return text.strip()
                vision_errors.append("AI vision returned an empty transcription.")
            except ValueError as exc:
                vision_errors.append(str(exc))

        local_text = transcribe_image_local(prepared_content)
        if local_text:
            return local_text

        if vision_errors:
            raise ValueError(
                f"{vision_errors[0]} "
                "Local OCR also found no text — install Tesseract (`brew install tesseract`) "
                "or upload a text-based PDF or .txt quote."
            )
        raise ValueError(
            "Image quotes need Google Cloud Vision (APP_GOOGLE_CLOUD_VISION_API_KEY or "
            "APP_GOOGLE_SOLAR_API_KEY), Groq vision (APP_GROQ_API_KEY), or local Tesseract "
            "(brew install tesseract). You can also upload a text-based PDF or .txt quote."
        )

    if lowered.endswith(".pdf") or content[:4] == b"%PDF":
        text = _read_pdf_text(content)
        if text.strip():
            return text.strip()
        raise ValueError(
            "This PDF has no readable text layer. Upload a photo of the quote instead."
        )

    if extension in TEXT_EXTENSIONS:
        return content.decode("utf-8", errors="ignore").strip()

    decoded = content.decode("utf-8", errors="ignore").strip()
    if decoded:
        return decoded

    raise ValueError(
        "Could not read the upload. Try a PDF, image (PNG/JPG), or .txt quote."
    )


def _extension(filename: str) -> str:
    dot = filename.rfind(".")
    if dot == -1:
        return ""
    return filename[dot:]


def _looks_like_image(content: bytes) -> bool:
    signatures = (
        b"\x89PNG\r\n\x1a\n",
        b"\xff\xd8\xff",
        b"GIF87a",
        b"GIF89a",
        b"RIFF",
    )
    return any(content.startswith(signature) for signature in signatures)


def _read_pdf_text(content: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    except (ImportError, OSError, ValueError):
        return ""
