# Defines local OCR fallback unit tests.

from unittest.mock import MagicMock, patch

from app.integrations.quote_parsing.local_ocr import transcribe_image_local


def test_transcribe_image_local_returns_none_without_tesseract() -> None:
    with patch.dict("sys.modules", {"pytesseract": None}):
        assert transcribe_image_local(b"fake") is None


def test_transcribe_image_local_returns_text_when_available() -> None:
    mock_tesseract = MagicMock()
    mock_tesseract.get_tesseract_version.return_value = "5.0.0"
    mock_tesseract.image_to_string.return_value = "Grand Total PHP 500,000"

    mock_image = MagicMock()
    mock_pil = MagicMock()
    mock_pil.Image.open.return_value = mock_image

    with patch.dict(
        "sys.modules",
        {"pytesseract": mock_tesseract, "PIL": mock_pil},
    ):
        text = transcribe_image_local(b"fake-image-bytes")

    assert text == "Grand Total PHP 500,000"
