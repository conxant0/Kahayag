# Defines optional local OCR for quote images when cloud vision is unavailable.

import io


def transcribe_image_local(content: bytes) -> str | None:
    """Return OCR text from a JPEG/PNG image, or None if Tesseract is unavailable."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return None

    try:
        pytesseract.get_tesseract_version()
    except pytesseract.TesseractNotFoundError:
        return None

    try:
        image = Image.open(io.BytesIO(content))
    except OSError:
        return None

    text = pytesseract.image_to_string(image).strip()
    return text or None
