# Defines design REST API integration tests.

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_bootstrap_returns_ai_suggested_build(
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
    assert len(body["builds"]) == 1
    assert body["builds"][0]["source"] == "ai_suggested"
    assert body["builds"][0]["label"] == "AI suggested"
    assert (
        body["builds"][0]["panel_count"]
        == completed_assessment_data["recommendation"]["panel_count"]
    )
    assert body["active_build_id"] == body["builds"][0]["id"]
    assert body["last_solve"] is not None
    assert len(body["last_solve"]["valid"]) >= 1


def test_bootstrap_with_backup_plans_includes_battery(
    completed_assessment_data: dict[str, object],
) -> None:
    response = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
            "plans": {
                "primary_goal": "backup-outages",
                "usage_pattern": "nighttime",
                "roof_material": "metal",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    build = body["builds"][0]
    assert build["battery_kwh"] is not None
    assert body["homeowner_plans"] is not None
    assert body["homeowner_plans"]["primary_goal"] == "Backup for outages"
    structure = next(c for c in build["components"] if c["slot"] == "structure")
    assert structure["catalog_id"] == "mount_002"
    assert body["last_solve"]["constraints"]["goal"] == "backup"
    assert body["last_solve"]["constraints"]["require_battery"] is True


def test_optimise_backup_returns_battery_build(
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
        "/api/v1/designs/optimise",
        json={"session": bootstrap, "goal": "backup"},
    )

    assert response.status_code == 200
    body = response.json()
    active = next(build for build in body["builds"] if build["id"] == body["active_build_id"])
    assert active["battery_kwh"] is not None


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
    assert quote["total_low_php"] == build["total_investment_low_php"]
    assert quote["total_high_php"] == build["total_investment_high_php"]


def test_bootstrap_succeeds_for_small_usable_roof(
    completed_assessment_data: dict[str, object],
) -> None:
    assessment = {
        **completed_assessment_data,
        "roof": {
            **completed_assessment_data["roof"],  # type: ignore[arg-type]
            "area_m2": "12.00",
            "usable_area_m2": "12.00",
        },
    }

    response = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": assessment,
            "property_ref": "demo-property-small-roof",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["builds"]) >= 1
    assert body["builds"][0]["panel_count"] >= 1


def test_create_user_build_starts_empty(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()

    response = client.post("/api/v1/designs/builds", json={"session": bootstrap})

    assert response.status_code == 200
    body = response.json()
    assert len(body["builds"]) == 2
    user_build = next(build for build in body["builds"] if build["source"] == "user")
    assert user_build["panel_count"] == 0
    assert user_build["system_kwp"] == 0
    assert user_build["components"] == []
    assert body["active_build_id"] == user_build["id"]


def test_update_user_build_component_adds_panel(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    created = client.post("/api/v1/designs/builds", json={"session": bootstrap}).json()
    user_build = next(build for build in created["builds"] if build["source"] == "user")
    panel_id = bootstrap["builds"][0]["components"][0]["catalog_id"]

    response = client.post(
        f"/api/v1/designs/builds/{user_build['id']}/components",
        json={
            "session": created,
            "build_id": user_build["id"],
            "slot": "panel",
            "catalog_id": panel_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    active = next(build for build in body["builds"] if build["id"] == user_build["id"])
    assert active["panel_count"] > 0
    assert active["system_kwp"] > 0
    assert any(component["slot"] == "panel" for component in active["components"])


def test_user_build_battery_options_without_inverter(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    created = client.post("/api/v1/designs/builds", json={"session": bootstrap}).json()
    user_build = next(build for build in created["builds"] if build["source"] == "user")
    panel_id = bootstrap["builds"][0]["components"][0]["catalog_id"]
    with_panel = client.post(
        f"/api/v1/designs/builds/{user_build['id']}/components",
        json={
            "session": created,
            "build_id": user_build["id"],
            "slot": "panel",
            "catalog_id": panel_id,
        },
    ).json()

    options = client.post(
        "/api/v1/designs/catalog-options",
        json={"session": with_panel, "slot": "battery"},
    ).json()

    assert len(options) > 0
    reasons = [row.get("reason") or "" for row in options if row["status"] == "incompatible"]
    assert reasons
    assert not any("inv_" in reason for reason in reasons)
    assert not any("DC:AC ratio" in reason for reason in reasons)


def test_duplicate_user_build_creates_copy(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    created = client.post("/api/v1/designs/builds", json={"session": bootstrap}).json()
    user_build = next(build for build in created["builds"] if build["source"] == "user")
    panel_id = bootstrap["builds"][0]["components"][0]["catalog_id"]
    populated = client.post(
        f"/api/v1/designs/builds/{user_build['id']}/components",
        json={
            "session": created,
            "build_id": user_build["id"],
            "slot": "panel",
            "catalog_id": panel_id,
        },
    ).json()

    response = client.post(
        f"/api/v1/designs/builds/{user_build['id']}/duplicate",
        json={"session": populated, "build_id": user_build["id"]},
    )

    assert response.status_code == 200
    body = response.json()
    user_builds = [build for build in body["builds"] if build["source"] == "user"]
    assert len(user_builds) == 2
    duplicate = next(build for build in user_builds if build["id"] != user_build["id"])
    source = next(build for build in populated["builds"] if build["id"] == user_build["id"])
    assert duplicate["label"] == "Your build B"
    assert duplicate["panel_count"] == source["panel_count"]
    assert body["active_build_id"] == duplicate["id"]


def test_delete_user_build_falls_back_to_ai_suggested(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    created = client.post("/api/v1/designs/builds", json={"session": bootstrap}).json()
    user_build = next(build for build in created["builds"] if build["source"] == "user")
    ai_build = next(build for build in created["builds"] if build["source"] == "ai_suggested")

    response = client.post(
        f"/api/v1/designs/builds/{user_build['id']}/delete",
        json={"session": created, "build_id": user_build["id"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["builds"]) == 1
    assert body["active_build_id"] == ai_build["id"]
    assert all(build["source"] != "user" for build in body["builds"])


def test_cannot_delete_ai_suggested_build(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    ai_build = bootstrap["builds"][0]

    response = client.post(
        f"/api/v1/designs/builds/{ai_build['id']}/delete",
        json={"session": bootstrap, "build_id": ai_build["id"]},
    )

    assert response.status_code == 422
