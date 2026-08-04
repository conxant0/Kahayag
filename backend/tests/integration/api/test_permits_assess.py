# Defines /permits/assess API integration tests.

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
    }
    payload.update(overrides)
    return payload


def test_assess_permits_with_no_uploads_reports_presence_findings() -> None:
    response = client.post(
        "/api/v1/permits/assess",
        data={"request": json.dumps(_request_payload())},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["track"] == "retrofit"
    assert body["packet_status"] == "incomplete"
    assert any(f["category"] == "presence" for f in body["findings"])
    assert all(doc["status"] == "missing" for doc in body["documents"])
    assert "summary" in body
    assert isinstance(body["net_metering_eligibility"]["satisfied"], bool)
    barangay = next(
        d for d in body["documents"] if d["document_id"] == "obo_12_barangay_clearance"
    )
    assert barangay["unverified"] is True
    assert barangay["expires"] is None
    assert barangay["steps"]
    assert barangay["issuing_agency"]
    tax_clearance = next(
        d for d in body["documents"] if d["document_id"] == "obo_16_tax_clearance_lot"
    )
    assert tax_clearance["prerequisites"] == ["obo_15_tax_declaration_lot"]


def test_assess_permits_with_uploads_pairs_slot_ids_to_files() -> None:
    response = client.post(
        "/api/v1/permits/assess",
        data={
            "request": json.dumps(_request_payload()),
            "slot_ids": ["obo_12_barangay_clearance"],
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
        d for d in body["documents"] if d["document_id"] == "obo_12_barangay_clearance"
    )
    assert barangay["status"] == "uploaded"


def test_assess_permits_rejects_mismatched_slot_and_file_counts() -> None:
    response = client.post(
        "/api/v1/permits/assess",
        data={
            "request": json.dumps(_request_payload()),
            "slot_ids": ["obo_12_barangay_clearance", "obo_14_tct"],
        },
        files={"files": ("barangay.txt", b"Barangay Clearance", "text/plain")},
    )
    assert response.status_code == 400
