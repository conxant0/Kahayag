# Defines catalog options API integration tests.

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_catalog_options_returns_panel_entries(
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
        "/api/v1/designs/catalog-options",
        json={"session": bootstrap, "slot": "panel"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 5
    statuses = {row["status"] for row in body}
    assert "selected" in statuses
    assert any(row["status"] in {"recommended", "compatible", "incompatible"} for row in body)
    assert all(row["line_total_php"] > 0 for row in body)
    assert all(row["unit_price_php"] > 0 for row in body)


def test_mutate_locked_battery_adds_storage(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    backup_session = client.post(
        "/api/v1/designs/optimise",
        json={"session": bootstrap, "goal": "backup"},
    ).json()

    options = client.post(
        "/api/v1/designs/catalog-options",
        json={"session": backup_session, "slot": "battery"},
    ).json()
    compatible = next(
        row for row in options if row["status"] in {"recommended", "compatible", "selected"}
    )

    response = client.post(
        "/api/v1/designs/mutate",
        json={
            "session": backup_session,
            "require_battery": True,
            "min_battery_kwh": 3.0,
            "locked_battery_id": compatible["id"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    active = next(build for build in body["builds"] if build["id"] == body["active_build_id"])
    assert active["battery_kwh"] is not None
