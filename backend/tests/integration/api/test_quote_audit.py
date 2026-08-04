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


def test_quote_audit_rejects_unsupported_file(
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
        "/api/v1/designs/quote-audit",
        data={"session": __import__("json").dumps(bootstrap)},
        files={"file": ("quote.docx", b"binary", "application/octet-stream")},
    )

    assert response.status_code == 422


def test_quote_audit_parses_table_style_grand_total(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()

    quote_text = (
        "1 Solar Panels Aiko 655 12 29475 353,700\n"
        "645 x 6 = 3,870 Watts\n"
        "Grand Total 1,165,700\n"
    ).encode()

    response = client.post(
        "/api/v1/designs/quote-audit",
        data={"session": __import__("json").dumps(bootstrap)},
        files={"file": ("installer-quote.txt", quote_text, "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["extracted_total_php"] == 1_165_700
    assert body["extracted_system_kwp"] == 3.87
    assert body["extracted_panel_count"] == 6
    assert body["diagram_components"]
    assert any(item["slot"] == "panel" for item in body["diagram_components"])
    assert any(item["slot"] == "inverter" for item in body["diagram_components"])


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
