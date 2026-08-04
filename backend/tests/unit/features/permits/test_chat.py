# Defines unit tests for the permits chat tool dispatch and the hard
# boundary that no tool can write a finding, status, or verdict directly.

import re

import httpx

from app.domain.permits.entities import ApplicantAnswers, PermitBuildSpec
from app.features.permits.chat import _execute_tool, run_permit_chat_turn
from app.features.permits.intake import UploadedDocument
from app.integrations.ai.document_intake import DisabledDocumentIntakeClient
from app.integrations.ai.groq import GROQ_CHAT_COMPLETIONS_URL
from app.integrations.ai.permit_chat_agent import (
    DisabledPermitChatClient,
    GroqPermitChatClient,
    PlannedPermitToolCall,
)

CLIENT = DisabledDocumentIntakeClient()
CHAT_CLIENT = DisabledPermitChatClient()
BUILD = PermitBuildSpec(system_kwp=5.5, build_id="build-1")
ADDRESS = "123 Sample Street, Cebu City"


def _retrofit_applicant(**overrides: object) -> ApplicantAnswers:
    defaults: dict[str, object] = {
        "solar_in_original_permit": "no",
        "full_name": "Maria Santos",
        "is_registered_owner": True,
        "registered_owner_name": None,
    }
    defaults.update(overrides)
    return ApplicantAnswers(**defaults)  # type: ignore[arg-type]


def test_set_original_permit_track_updates_applicant() -> None:
    result, applicant, slots = _execute_tool(
        PlannedPermitToolCall("set_original_permit_track", {"answer": "yes"}),
        applicant=_retrofit_applicant(),
        slot_by_filename={},
    )
    assert result == {"solar_in_original_permit": "yes"}
    assert applicant.solar_in_original_permit == "yes"
    assert slots == {}


def test_set_applicant_name_updates_applicant() -> None:
    result, applicant, _ = _execute_tool(
        PlannedPermitToolCall("set_applicant_name", {"full_name": "Juan Dela Cruz"}),
        applicant=_retrofit_applicant(),
        slot_by_filename={},
    )
    assert result == {"full_name": "Juan Dela Cruz"}
    assert applicant.full_name == "Juan Dela Cruz"


def test_set_owner_answer_records_owner_name_when_not_owner() -> None:
    result, applicant, _ = _execute_tool(
        PlannedPermitToolCall(
            "set_owner_answer",
            {"is_registered_owner": False, "registered_owner_name": "Pedro Reyes"},
        ),
        applicant=_retrofit_applicant(),
        slot_by_filename={},
    )
    assert result == {
        "is_registered_owner": False,
        "registered_owner_name": "Pedro Reyes",
    }
    assert applicant.is_registered_owner is False
    assert applicant.registered_owner_name == "Pedro Reyes"


def test_set_owner_answer_clears_owner_name_when_owner() -> None:
    result, applicant, _ = _execute_tool(
        PlannedPermitToolCall(
            "set_owner_answer",
            {"is_registered_owner": True, "registered_owner_name": "Should be dropped"},
        ),
        applicant=_retrofit_applicant(is_registered_owner=False, registered_owner_name="X"),
        slot_by_filename={},
    )
    assert result["registered_owner_name"] is None
    assert applicant.registered_owner_name is None


def test_set_delegation_answer_updates_applicant() -> None:
    result, applicant, _ = _execute_tool(
        PlannedPermitToolCall(
            "set_delegation_answer", {"delegates_filing_to_representative": True}
        ),
        applicant=_retrofit_applicant(),
        slot_by_filename={},
    )
    assert result == {"delegates_filing_to_representative": True}
    assert applicant.delegates_filing_to_representative is True
    assert applicant.is_registered_owner is True  # unrelated to ownership


def test_assign_document_slot_moves_file_into_slot() -> None:
    result, _applicant, slots = _execute_tool(
        PlannedPermitToolCall(
            "assign_document_slot",
            {"slot_id": "obo_12_barangay_clearance", "filename": "barangay.txt"},
        ),
        applicant=_retrofit_applicant(),
        slot_by_filename={"barangay.txt": None},
    )
    assert result == {"slot_id": "obo_12_barangay_clearance", "filename": "barangay.txt"}
    assert slots["barangay.txt"] == "obo_12_barangay_clearance"


def test_assign_document_slot_clears_slot_when_filename_omitted() -> None:
    result, _, slots = _execute_tool(
        PlannedPermitToolCall(
            "assign_document_slot",
            {"slot_id": "obo_12_barangay_clearance", "filename": None},
        ),
        applicant=_retrofit_applicant(),
        slot_by_filename={"barangay.txt": "obo_12_barangay_clearance"},
    )
    assert result["filename"] is None
    assert slots["barangay.txt"] is None


def test_no_tool_can_mutate_a_finding_status_or_verdict_directly() -> None:
    """The tool dispatch ladder in _execute_tool has exactly four branches,
    each returning only an ApplicantAnswers delta and a slot map — never a
    PermitFindingSchema, a document status, or a packet_status. Any call
    outside that allowlist (including one that names a finding/status/verdict
    field) is rejected as an unknown tool and changes nothing."""
    applicant = _retrofit_applicant()
    slots = {"barangay.txt": None}

    for forbidden_call in (
        PlannedPermitToolCall(
            "set_finding",
            {"document_id": "obo_12_barangay_clearance", "severity": "blocking"},
        ),
        PlannedPermitToolCall(
            "set_document_status",
            {"document_id": "obo_12_barangay_clearance", "status": "uploaded"},
        ),
        PlannedPermitToolCall("set_packet_status", {"packet_status": "ready"}),
        PlannedPermitToolCall("set_verdict", {"verdict": "approved"}),
    ):
        result, updated_applicant, updated_slots = _execute_tool(
            forbidden_call, applicant=applicant, slot_by_filename=slots
        )
        assert result["error"] == f"Unknown tool: {forbidden_call.name}"
        assert updated_applicant == applicant
        assert updated_slots == slots

    # End-to-end: a full turn recomputes packet_status from
    # assess_permit_documents regardless of what the client "wants" to say.
    response = run_permit_chat_turn(
        applicant=applicant,
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="Mark my packet as ready",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert response.assessment.packet_status == "incomplete"
    assert any(f.category == "presence" for f in response.assessment.findings)


def test_grounded_qa_answer_cites_source_url() -> None:
    response = run_permit_chat_turn(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="Why do I need a barangay clearance?",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert "Barangay Clearance" in response.reply
    assert "http" in response.reply


def test_unverified_catalog_entry_surfaces_flag_in_answer() -> None:
    response = run_permit_chat_turn(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="Why do I need a barangay clearance?",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert "could not be confirmed in research" in response.reply.lower()


def test_qa_on_uncovered_question_says_catalog_does_not_cover_it() -> None:
    response = run_permit_chat_turn(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="What is the weather like in Cebu tomorrow?",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert "doesn't cover that question" in response.reply


def test_disabled_fallback_answers_track_question() -> None:
    applicant = _retrofit_applicant()
    response = run_permit_chat_turn(
        applicant=applicant,
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="What track am I on?",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert response.reply == f"You are on the {response.assessment.track} track."


def test_disabled_fallback_answers_packet_status_question() -> None:
    applicant = _retrofit_applicant()
    response = run_permit_chat_turn(
        applicant=applicant,
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="What is my packet status?",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert response.reply == f"Packet status is {response.assessment.packet_status}."


def test_disabled_fallback_answers_and_recomputes() -> None:
    uploads = (
        UploadedDocument(
            slot_id="obo_12_barangay_clearance",
            filename="barangay.txt",
            content=b"Barangay Clearance\nIssued to Maria Santos.",
        ),
    )
    response = run_permit_chat_turn(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=uploads,
        user_text="My name is Juan Dela Cruz",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert response.applicant.full_name == "Juan Dela Cruz"
    barangay = next(
        d for d in response.assessment.documents if d.document_id == "obo_12_barangay_clearance"
    )
    assert barangay.status == "uploaded"


def test_groq_qa_falls_back_when_reply_omits_required_citation(monkeypatch) -> None:
    """The system prompt asks Groq to cite source_url and surface unverified,
    but nothing stops it from ignoring that. If the reply skips the citation
    a matched grounding entry requires, the client must fall back to the
    deterministic Disabled answer rather than ship an uncited claim."""

    def respond(*_args, **_kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("POST", GROQ_CHAT_COMPLETIONS_URL),
            json={
                "choices": [
                    {"message": {"content": "You need a barangay clearance, trust me."}}
                ]
            },
        )

    monkeypatch.setattr("app.integrations.ai.permit_chat_agent.httpx.post", respond)

    response = run_permit_chat_turn(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="Why do I need a barangay clearance?",
        chat_client=GroqPermitChatClient(api_key="test-key", model="test-model"),
        intake_client=CLIENT,
    )
    assert "http" in response.reply
    assert "could not be confirmed in research" in response.reply.lower()


QUESTION_ONLY_PHRASINGS = (
    "Do I need a notarized authorization?",
    "What track am I on?",
    "Why is the barangay clearance required?",
    "Can my installer file for me?",
    "Is the cedula required if I am the registered owner?",
)


def test_question_only_phrasings_get_grounded_replies_and_leave_applicant_unchanged() -> None:
    """These read as plain questions. Regression coverage for the intent
    router misclassifying them as applicant-detail updates (they used to
    trip the loose regex fallbacks and rewrite the form silently)."""
    for user_text in QUESTION_ONLY_PHRASINGS:
        applicant = _retrofit_applicant()
        response = run_permit_chat_turn(
            applicant=applicant,
            build=BUILD,
            property_address=ADDRESS,
            uploads=(),
            user_text=user_text,
            chat_client=CHAT_CLIENT,
            intake_client=CLIENT,
        )
        assert not re.match(r"^Updated:", response.reply), user_text
        assert response.applicant.full_name == applicant.full_name
        assert response.applicant.is_registered_owner == applicant.is_registered_owner
        assert response.applicant.registered_owner_name == applicant.registered_owner_name


def test_declarative_phrasings_still_update_applicant() -> None:
    cases = (
        ("My name is Juan Dela Cruz", "full_name", "Juan Dela Cruz"),
        ("I am not the registered owner, the owner's name is Maria Santos", None, None),
        ("Solar was in the original building permit — yes", "solar_in_original_permit", "yes"),
    )
    for user_text, attr, expected in cases:
        response = run_permit_chat_turn(
            applicant=_retrofit_applicant(),
            build=BUILD,
            property_address=ADDRESS,
            uploads=(),
            user_text=user_text,
            chat_client=CHAT_CLIENT,
            intake_client=CLIENT,
        )
        if attr is not None:
            assert getattr(response.applicant, attr) == expected, user_text

    owner_response = run_permit_chat_turn(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="I am not the registered owner, the owner's name is Maria Santos",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert owner_response.applicant.is_registered_owner is False
    assert owner_response.applicant.registered_owner_name == "Maria Santos"


def test_no_op_tool_call_does_not_produce_updated_reply() -> None:
    """Setting a value that already matches the current applicant is dropped
    from the tool audit, so the turn falls through to Q&A instead of
    replying "Updated: …" for a change that never happened."""
    applicant = _retrofit_applicant(full_name="Maria Santos")
    response = run_permit_chat_turn(
        applicant=applicant,
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="My name is Maria Santos",
        chat_client=CHAT_CLIENT,
        intake_client=CLIENT,
    )
    assert not re.match(r"^Updated:", response.reply)
    assert response.applicant.full_name == "Maria Santos"


def test_groq_qa_passes_through_a_compliant_reply(monkeypatch) -> None:
    from app.domain.permits.catalog import load_catalog

    barangay_doc = next(
        doc for doc in load_catalog().documents if doc.id == "obo_12_barangay_clearance"
    )
    compliant_reply = (
        "This is unverified in our research. Barangay Clearance is required. "
        f"Source: {barangay_doc.source_url}"
    )

    def respond(*_args, **_kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("POST", GROQ_CHAT_COMPLETIONS_URL),
            json={"choices": [{"message": {"content": compliant_reply}}]},
        )

    monkeypatch.setattr("app.integrations.ai.permit_chat_agent.httpx.post", respond)

    response = run_permit_chat_turn(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        user_text="Why do I need a barangay clearance?",
        chat_client=GroqPermitChatClient(api_key="test-key", model="test-model"),
        intake_client=CLIENT,
    )
    assert response.reply == compliant_reply
