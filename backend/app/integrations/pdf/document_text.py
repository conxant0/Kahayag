# Defines uploaded-document text extraction (PDF via pypdf, plain text passthrough).

import io


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
    if lowered.endswith((".txt", ".csv", ".md")):
        return content.decode("utf-8", errors="ignore").strip()
    return content.decode("utf-8", errors="ignore").strip()
