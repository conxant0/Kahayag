# Defines /permits/chat API integration tests.

import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _request_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "applicant": {
            "solar_in_original_permit": "no",
            "full_name": "Maria Santos",
            "is_registered_owner": True,
            "registered_owner_name": None,
        },
        "system_kwp": 5.5,
        "build_id": "build-1",
        "property_address": "123 Sample Street, Cebu City",
        "user_text": "Why do I need a barangay clearance?",
    }
    payload.update(overrides)
    return payload


def test_chat_qa_turn_accepts_empty_applicant_name() -> None:
    response = client.post(
        "/api/v1/permits/chat",
        data={
            "request": json.dumps(
                _request_payload(
                    applicant={
                        "solar_in_original_permit": "not_sure",
                        "full_name": "",
                        "is_registered_owner": True,
                        "registered_owner_name": None,
                    },
                    user_text="What track am I on?",
                )
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "retrofit" in body["reply"].lower()
    assert body["applicant"]["full_name"] == ""


def test_chat_qa_turn_cites_source_and_flags_unverified() -> None:
    response = client.post(
        "/api/v1/permits/chat",
        data={"request": json.dumps(_request_payload())},
    )

    assert response.status_code == 200
    body = response.json()
    assert "http" in body["reply"]
    assert "could not be confirmed" in body["reply"].lower()
    assert body["assessment"]["packet_status"] == "incomplete"
    assert body["applicant"]["full_name"] == "Maria Santos"


def test_chat_action_turn_updates_applicant_and_recomputes_assessment() -> None:
    response = client.post(
        "/api/v1/permits/chat",
        data={
            "request": json.dumps(
                _request_payload(user_text="My name is Juan Dela Cruz")
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["applicant"]["full_name"] == "Juan Dela Cruz"
    # Recomputed deterministically: no uploads were sent, so it's still
    # incomplete with presence findings — the chat turn never sets this.
    assert body["assessment"]["packet_status"] == "incomplete"
    assert any(f["category"] == "presence" for f in body["assessment"]["findings"])


def test_chat_turn_reassigns_document_slot_and_recomputes() -> None:
    response = client.post(
        "/api/v1/permits/chat",
        data={
            "request": json.dumps(
                _request_payload(
                    user_text="use barangay.txt for obo_12_barangay_clearance"
                )
            ),
            "slot_ids": [""],
        },
        files={
            "files": (
                "barangay.txt",
                b"Barangay Clearance\nIssued to Maria Santos.",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    barangay = next(
        d
        for d in body["assessment"]["documents"]
        if d["document_id"] == "obo_12_barangay_clearance"
    )
    assert barangay["status"] == "uploaded"


def test_chat_turn_rejects_mismatched_slot_and_file_counts() -> None:
    response = client.post(
        "/api/v1/permits/chat",
        data={
            "request": json.dumps(_request_payload()),
            "slot_ids": ["obo_12_barangay_clearance", "obo_14_tct"],
        },
        files={"files": ("barangay.txt", b"Barangay Clearance", "text/plain")},
    )
    assert response.status_code == 400
