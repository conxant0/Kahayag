# Defines quote audit API integration tests.

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_quote_audit_compares_uploaded_total(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    benchmark_total = bootstrap["builds"][0]["total_investment_php"]

    quote_text = (
        "Installer quote\n"
        "System size: 5.5 kWp\n"
        f"Grand total: PHP {benchmark_total + 25000:,.0f}\n"
    ).encode()

    response = client.post(
        "/api/v1/designs/quote-audit",
        data={"session": __import__("json").dumps(bootstrap)},
        files={"file": ("installer-quote.txt", quote_text, "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["benchmark_total_php"] == benchmark_total
    assert body["extracted_total_php"] == benchmark_total + 25000
    assert body["findings"]
    assert "summary" in body


def test_mutate_reruns_solver_with_panel_delta(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()

    response = client.post(
        "/api/v1/designs/mutate",
        json={
            "session": bootstrap,
            "panel_count_delta": 1,
            "goal": "auto",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["builds"]) >= 2
    assert body["last_solve"] is not None
