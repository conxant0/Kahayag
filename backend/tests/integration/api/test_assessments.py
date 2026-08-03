# Defines assessment endpoint integration coverage.

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_assessment_uses_fallback_and_returns_completed_assessment(
    assessment_request_data: dict[str, object],
):
    response = client.post("/api/v1/assessments", json=assessment_request_data)

    assert response.status_code == 200
    body = response.json()
    assert body["assumptions"]["solar_resource_source"] == "nationwide_fallback"
    assert body["shading"] is None
    assert body["is_provisional"] is True


def test_adjustment_endpoint_recomputes_requested_panel_count(
    assessment_request_data: dict[str, object],
):
    payload = {
        "property": assessment_request_data["property"],
        "roof": assessment_request_data["roof"],
        "inputs": assessment_request_data["inputs"],
        "requested_panel_count": 5,
    }

    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=payload,
    )

    assert response.status_code == 200
    assert response.json()["recommendation"]["panel_count"] == 5


def test_infeasible_assessment_returns_readable_422(
    assessment_request_data: dict[str, object],
):
    invalid = dict(assessment_request_data)
    invalid["inputs"] = {
        **assessment_request_data["inputs"],
        "monthly_consumption_kwh": "1.00",
    }

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 422
    assert "single standard-450 panel" in response.json()["detail"]

