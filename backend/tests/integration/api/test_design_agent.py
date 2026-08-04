# Defines unit tests for the design agent tool loop.

from fastapi.testclient import TestClient

from app.features.design.agent import _parse_change_request, run_design_agent_turn
from app.features.design.schemas import AgentDesignRequest, DesignSessionSchema
from app.integrations.ai.design_agent import DisabledDesignAgentClient
from app.main import app

client = TestClient(app)


def test_agent_dry_run_returns_preview_without_mutating_session(
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
        "/api/v1/designs/agent",
        json={
            "session": bootstrap,
            "user_text": "Add two more panels",
            "dry_run": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["requires_confirmation"] is True
    assert body["planned_actions"]
    assert body["session"]["active_build_id"] == bootstrap["active_build_id"]
    assert len(body["session"]["agent_audit"]) == len(bootstrap["agent_audit"])


def test_disabled_agent_runs_solver_and_audits(
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
        "/api/v1/designs/agent",
        json={
            "session": bootstrap,
            "user_text": "Optimise for my budget",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session"]["last_solve"] is not None
    assert len(body["session"]["agent_audit"]) == 1
    assert body["session"]["agent_audit"][0]["tool_calls"]
    assert "kWp" in body["reply"] or "₱" in body["reply"]


def test_explain_answers_missing_battery_question(
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
        "/api/v1/designs/explain",
        json={
            "session": bootstrap,
            "question": "Why is the energy store not included?",
        },
    )

    assert response.status_code == 200
    explanation = response.json()["explanation"].lower()
    assert "no energy store" in explanation or "no battery" in explanation
    assert any(
        token in explanation
        for token in ("savings", "grid-tied", "budget", "does not require")
    )


def test_explain_returns_grounded_copy(
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
        "/api/v1/designs/explain",
        json={
            "session": bootstrap,
            "question": "Why this inverter?",
        },
    )

    assert response.status_code == 200
    explanation = response.json()["explanation"]
    assert str(bootstrap["builds"][0]["system_kwp"]) in explanation
    assert "kWp" in explanation


def test_parse_change_request_detects_battery_and_panels() -> None:
    patch = _parse_change_request("Add battery storage and one more panel")
    assert patch["require_battery"] is True
    assert patch["panel_count_delta"] == 1
    assert patch["min_battery_kwh"] == 4.5

    two_panel_patch = _parse_change_request("Add two more panels")
    assert two_panel_patch["panel_count_delta"] == 2


def test_normalize_tool_call_uses_active_build_for_quotation(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()
    session = DesignSessionSchema.model_validate(bootstrap)
    from app.features.design.agent import _normalize_tool_call
    from app.integrations.ai.design_agent import PlannedToolCall

    normalized = _normalize_tool_call(
        PlannedToolCall(
            name="generate_quotation",
            arguments={"build_id": "stale-build-id"},
        ),
        session=session,
        user_text="Quote this build",
    )
    assert normalized.arguments["build_id"] == session.active_build_id


def test_disabled_planner_selects_run_solver(
    completed_assessment_data: dict[str, object],
) -> None:
    bootstrap = client.post(
        "/api/v1/designs/bootstrap",
        json={
            "assessment": completed_assessment_data,
            "property_ref": "demo-property-1",
        },
    ).json()

    response = run_design_agent_turn(
        AgentDesignRequest(
            session=DesignSessionSchema.model_validate(bootstrap),
            user_text="Please auto-optimise the design",
        ),
        client=DisabledDesignAgentClient(),
    )

    assert response.session.agent_audit
    tool_names = [
        call["name"] for call in response.session.agent_audit[0].tool_calls
    ]
    assert "run_solver" in tool_names
