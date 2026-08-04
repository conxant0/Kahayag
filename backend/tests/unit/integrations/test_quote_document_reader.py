# Defines quote document reader unit tests.

import pytest

from app.integrations.ai.quote_auditor import DisabledQuoteAuditorClient
from app.integrations.quote_parsing.document_reader import read_quote_document


def test_read_text_quote_file() -> None:
    content = b"Grand Total PHP 500,000\nSystem size: 4.2 kWp\n"
    text = read_quote_document(
        "installer.txt",
        content,
        transcriber=DisabledQuoteAuditorClient(),
    )
    assert "Grand Total" in text


def test_image_without_transcriber_requires_ocr_or_groq() -> None:
    with pytest.raises(ValueError, match="Groq vision|Tesseract"):
        read_quote_document(
            "quote.png",
            b"\x89PNG\r\n\x1a\nfake",
            transcriber=None,
        )


def test_unsupported_extension_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported file type"):
        read_quote_document(
            "quote.docx",
            b"binary",
            transcriber=DisabledQuoteAuditorClient(),
        )
