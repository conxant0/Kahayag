# Defines vision transcription cleanup unit tests.

from app.integrations.ai.quote_auditor import _clean_vision_transcription


def test_clean_vision_transcription_strips_think_blocks() -> None:
    raw = (
        "<" + "think" + ">planning</" + "think" + ">\nGrand Total 1,165,700"
    )
    assert _clean_vision_transcription(raw) == "Grand Total 1,165,700"


def test_clean_vision_transcription_keeps_tail_after_think_block() -> None:
    raw = (
        "<" + "think" + ">still planning</" + "think" + ">\n"
        "Total Bill: PKR 415,355"
    )
    assert _clean_vision_transcription(raw) == "Total Bill: PKR 415,355"
