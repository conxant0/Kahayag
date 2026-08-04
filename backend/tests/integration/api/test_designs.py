# Defines design REST API integration tests.

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_bootstrap_returns_at_least_two_builds(
    completed_assessment_data: dict[str, object],
) -> None:
    response = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["builds"]) >= 2
    assert body["active_build_id"] == body["builds"][0]["id"]
    assert body["last_solve"] is not None
    assert len(body["last_solve"]["valid"]) >= 2


def test_quotation_matches_build_totals(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    build = bootstrap["builds"][0]

    quote_response = client.post(
        f"/api/v1/designs/quotation/{build['id']}",
        json={"build_id": build["id"], "session": bootstrap},
    )

    assert quote_response.status_code == 200
    quote = quote_response.json()
    assert quote["subtotal_php"] == build["subtotal_php"]
    assert quote["vat_php"] == build["vat_php"]
    assert quote["total_php"] == build["total_investment_php"]
