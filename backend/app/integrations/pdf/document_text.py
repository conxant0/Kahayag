# Defines uploaded-document text extraction (PDF via pypdf, plain text passthrough).

import io

# Magic-byte signatures for common image formats. A photo dropped into a
# document slot must surface as unreadable, not decode into throwaway ASCII
# (e.g. JPEG's "JFIF" marker) that would slip past the caller's blank-text
# guard — see intake.py's "unreadable" check.
_IMAGE_SIGNATURES: tuple[bytes, ...] = (
    b"\xff\xd8\xff",  # JPEG
    b"\x89PNG\r\n\x1a\n",  # PNG
    b"GIF87a",  # GIF
    b"GIF89a",  # GIF
    b"RIFF",  # WEBP (RIFF container; also covers AVI, harmless false-positive)
    b"BM",  # BMP
    b"II*\x00",  # TIFF little-endian
    b"MM\x00*",  # TIFF big-endian
)


def _looks_like_image(content: bytes) -> bool:
    return any(content.startswith(sig) for sig in _IMAGE_SIGNATURES)


def extract_document_text(filename: str, content: bytes) -> str:
    lowered = filename.lower()
    if lowered.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            from pypdf.errors import PyPdfError

            reader = PdfReader(io.BytesIO(content))
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages).strip()
        except (ImportError, OSError, PyPdfError, ValueError):
            # Malformed PDFs raise PyPdfError subclasses; returning "" lets the
            # caller surface an unreadable finding instead of a raw 500.
            return ""
    if _looks_like_image(content):
        return ""
    return content.decode("utf-8", errors="ignore").strip()
