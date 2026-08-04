# Defines image normalization before quote vision transcription.

import io

MAX_VISION_EDGE_PX = 1200
JPEG_QUALITY = 80

_HEIC_BRANDS = frozenset({b"heic", b"heif", b"mif1", b"heix"})


def prepare_image_for_vision(content: bytes, mime_type: str) -> tuple[bytes, str]:
    if _is_heic(content):
        raise ValueError(
            "HEIC photos are not supported. Save the quote as JPG or PNG, or set "
            "your iPhone camera to Most Compatible before taking the photo."
        )

    try:
        from PIL import Image
    except ImportError:
        return content, mime_type

    try:
        with Image.open(io.BytesIO(content)) as image:
            rgb = image.convert("RGB")
            rgb.thumbnail((MAX_VISION_EDGE_PX, MAX_VISION_EDGE_PX))
            buffer = io.BytesIO()
            rgb.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            return buffer.getvalue(), "image/jpeg"
    except OSError:
        return content, mime_type


def _is_heic(content: bytes) -> bool:
    if len(content) < 12:
        return False
    return content[4:8] in _HEIC_BRANDS
