# Defines the OpenAPI compatibility test boundary.

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.domain.solar.assumptions import DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH
from app.main import app

client = TestClient(app)


def test_openapi_schema_documents_assessment_request_and_response() -> None:
    schema = client.get("/openapi.json").json()

    post_assessments = schema["paths"]["/api/v1/assessments"]["post"]
    request_ref = post_assessments["requestBody"]["content"]["application/json"][
        "schema"
    ]["$ref"]
    response_ref = post_assessments["responses"]["200"]["content"]["application/json"][
        "schema"
    ]["$ref"]

    assert request_ref.endswith("AssessmentRequest")
    assert response_ref.endswith(("CompletedAssessment", "CompletedAssessment-Output"))


def test_create_assessment_accepts_representative_request(
    assessment_request_data: dict[str, object],
) -> None:
    response = client.post("/api/v1/assessments", json=assessment_request_data)

    assert response.status_code == 200
    body = response.json()
    assert body["property"] == assessment_request_data["property"]
    assert body["roof"] == assessment_request_data["roof"]
    assert body["inputs"] == assessment_request_data["inputs"]
    assert body["recommendation"]["panel_count"] > 0
    assert (
        body["financials"]["estimated_cost_high_php"]
        >= (body["financials"]["estimated_cost_low_php"])
    )
    assert body["limitations"]
    assert (
        "Battery options and net-metering export credits are not included."
        in body["limitations"]
    )
    assert body["recommendation"]["rationale"]
    assert body["is_provisional"] is True


def test_create_assessment_does_not_advertise_an_unapplied_roof_ratio(
    assessment_request_data: dict[str, object],
) -> None:
    response = client.post("/api/v1/assessments", json=assessment_request_data)

    assert response.status_code == 200
    assert "roof_utilization_ratio" not in response.json()["assumptions"]


def test_create_assessment_defaults_to_standard_panel_category(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    request["inputs"].pop("panel_category_id", None)

    response = client.post("/api/v1/assessments", json=request)

    assert response.status_code == 200
    assert response.json()["inputs"]["panel_category_id"] == "standard-450"
    assert response.json()["recommendation"]["panel_category_id"] == "standard-450"
    assert response.json()["recommendation"]["panel_wattage_w"] == 450


def test_create_assessment_uses_high_output_panel_category(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    request["inputs"]["panel_category_id"] = "high-output-550"
    request["inputs"]["budget_php"] = 330000
    request["inputs"]["monthly_consumption_kwh"] = "10000.00"

    response = client.post("/api/v1/assessments", json=request)

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"]["panel_category_id"] == "high-output-550"
    assert body["recommendation"]["panel_wattage_w"] == 550
    assert body["recommendation"]["panel_count"] == 10
    assert body["recommendation"]["system_capacity_kwp"] == "5.50"
    assert body["financials"]["estimated_cost_low_php"] == 275000
    assert body["financials"]["estimated_cost_high_php"] == 385000


def test_create_assessment_rejects_unknown_panel_category(
    assessment_request_data: dict[str, object],
) -> None:
    invalid = deepcopy(assessment_request_data)
    invalid["inputs"]["panel_category_id"] = "unknown"

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 422


def test_create_assessment_sizes_to_roof_when_no_budget_given(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    del request["inputs"]["budget_php"]
    # High enough that demand isn't the binding constraint here; this test
    # is specifically about roof sizing. See
    # test_create_assessment_sizes_to_demand_when_demand_is_tighter_than_roof_and_budget
    # for demand-limited sizing.
    request["inputs"]["monthly_consumption_kwh"] = "10000.00"

    response = client.post("/api/v1/assessments", json=request)

    assert response.status_code == 200
    recommendation = response.json()["recommendation"]
    assert recommendation["panel_count"] == 16
    assert recommendation["limiting_constraint"] == "roof_area"


def test_create_assessment_sizes_to_demand_when_demand_is_tighter_than_roof_and_budget(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    del request["inputs"]["budget_php"]
    request["inputs"]["monthly_consumption_kwh"] = "300.00"

    response = client.post("/api/v1/assessments", json=request)

    assert response.status_code == 200
    recommendation = response.json()["recommendation"]
    assert recommendation["panel_count"] == 5
    assert recommendation["limiting_constraint"] == "demand"


def test_create_assessment_rejects_when_demand_cannot_fit_a_single_panel(
    assessment_request_data: dict[str, object],
) -> None:
    invalid = deepcopy(assessment_request_data)
    invalid["inputs"]["monthly_consumption_kwh"] = "1.00"

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 422


def test_create_assessment_sizes_to_budget_when_budget_is_tighter_than_roof(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    request["inputs"]["budget_php"] = 100000

    response = client.post("/api/v1/assessments", json=request)

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"]["panel_count"] == 3
    assert body["recommendation"]["limiting_constraint"] == "budget"
    assert body["financials"]["budget_compatible"] is True
    assert body["financials"]["estimated_cost_low_php"] <= 100000
    assert body["financials"]["budget_gap_php"] == 0
    assert body["financials"]["monthly_savings_php"] == (
        body["financials"]["annual_savings_php"] // 12
    )


def test_create_assessment_accepts_bill_only_and_sizes_with_default_tariff(
    assessment_request_data: dict[str, object],
) -> None:
    # The frontend's /energy submission carries only monthly_bill_php — the
    # exact shape this test exercises.
    bill_only = deepcopy(assessment_request_data)
    bill_only["inputs"] = {"monthly_bill_php": bill_only["inputs"]["monthly_bill_php"]}

    explicit_default_tariff = deepcopy(bill_only)
    explicit_default_tariff["inputs"]["electricity_rate_php_per_kwh"] = str(
        DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH
    )

    bill_only_response = client.post("/api/v1/assessments", json=bill_only)
    explicit_response = client.post("/api/v1/assessments", json=explicit_default_tariff)

    assert bill_only_response.status_code == 200
    bill_only_body = bill_only_response.json()
    assert bill_only_body["recommendation"] == explicit_response.json()["recommendation"]
    assert bill_only_body["financials"] == explicit_response.json()["financials"]


def test_create_assessment_exposes_base_cost_used_for_payback(
    assessment_request_data: dict[str, object],
) -> None:
    response = client.post("/api/v1/assessments", json=assessment_request_data)

    assert response.status_code == 200
    financials = response.json()["financials"]
    assert financials["estimated_base_cost_php"] == 243000
    assert financials["payback_years"] == "3.4"


def test_create_assessment_returns_zero_gap_when_low_estimate_fits_budget(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    request["inputs"]["budget_php"] = 22500
    request["inputs"]["monthly_consumption_kwh"] = "10000.00"

    response = client.post("/api/v1/assessments", json=request)

    assert response.status_code == 200
    financials = response.json()["financials"]
    assert financials["budget_compatible"] is True
    assert financials["budget_gap_php"] == 0


def test_create_assessment_rejects_when_roof_cannot_fit_a_single_panel(
    assessment_request_data: dict[str, object],
) -> None:
    invalid = deepcopy(assessment_request_data)
    invalid["roof"] = {"area_m2": "3.00", "usable_area_m2": "1.98"}

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 422


def test_create_assessment_returns_minimum_estimate_for_insufficient_budget(
    assessment_request_data: dict[str, object],
) -> None:
    invalid = deepcopy(assessment_request_data)
    invalid["inputs"]["budget_php"] = 1

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"]["panel_count"] == 1
    assert body["recommendation"]["limiting_constraint"] == "budget"
    assert body["recommendation"]["rationale"] == (
        "₱1 does not cover a single standard-450 panel. This is the smallest "
        "system we can estimate and is ₱22,499 above your budget."
    )
    assert body["financials"]["budget_compatible"] is False
    assert body["financials"]["budget_gap_php"] == 22499


@pytest.mark.parametrize("section", ["property", "roof", "inputs"])
def test_create_assessment_rejects_incomplete_request(
    assessment_request_data: dict[str, object],
    section: str,
) -> None:
    invalid = deepcopy(assessment_request_data)
    del invalid[section]

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 422


def test_create_assessment_accepts_omitted_budget(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    del request["inputs"]["budget_php"]

    response = client.post("/api/v1/assessments", json=request)

    assert response.status_code == 200
    body = response.json()
    assert body["inputs"]["budget_php"] is None
    assert body["financials"]["budget_compatible"] is True
    assert body["financials"]["budget_gap_php"] is None


@pytest.mark.parametrize(
    "field",
    [
        "monthly_bill_php",
        "monthly_consumption_kwh",
        "electricity_rate_php_per_kwh",
        "budget_php",
    ],
)
@pytest.mark.parametrize("invalid_value", [0, -1])
def test_create_assessment_rejects_non_positive_input_values(
    assessment_request_data: dict[str, object],
    field: str,
    invalid_value: int,
) -> None:
    invalid = deepcopy(assessment_request_data)
    invalid["inputs"][field] = invalid_value

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 422


def test_create_assessment_rejects_usable_roof_area_above_total(
    assessment_request_data: dict[str, object],
) -> None:
    invalid = deepcopy(assessment_request_data)
    invalid["roof"] = {"area_m2": "40.00", "usable_area_m2": "40.01"}

    response = client.post("/api/v1/assessments", json=invalid)

    assert response.status_code == 422


def _adjustment_payload(
    assessment_request_data: dict[str, object], requested_panel_count: int
) -> dict[str, object]:
    return {
        "property": assessment_request_data["property"],
        "roof": assessment_request_data["roof"],
        "inputs": assessment_request_data["inputs"],
        "requested_panel_count": requested_panel_count,
    }


def test_adjust_panel_count_recomputes_size_generation_cost_and_savings(
    assessment_request_data: dict[str, object],
) -> None:
    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(assessment_request_data, 5),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"]["panel_count"] == 5
    assert body["recommendation"]["system_capacity_kwp"] == "2.25"
    assert body["recommendation"]["limiting_constraint"] == "user_selected"
    assert (
        body["financials"]["estimated_cost_high_php"]
        >= (body["financials"]["estimated_cost_low_php"])
    )


def test_adjust_panel_count_accepts_the_roof_capacity_boundary(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    del request["inputs"]["budget_php"]
    # High enough that demand isn't the binding constraint; this test is
    # specifically about the roof boundary. See
    # test_adjust_panel_count_accepts_the_demand_boundary for demand.
    request["inputs"]["monthly_consumption_kwh"] = "10000.00"

    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(request, 16),
    )

    assert response.status_code == 200
    assert response.json()["recommendation"]["limiting_constraint"] == "roof_area"


def test_adjust_panel_count_accepts_the_demand_boundary(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    del request["inputs"]["budget_php"]
    request["inputs"]["monthly_consumption_kwh"] = "300.00"

    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(request, 5),
    )

    assert response.status_code == 200
    assert response.json()["recommendation"]["limiting_constraint"] == "demand"


def test_adjust_panel_count_returns_minimum_estimate_for_insufficient_budget(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    request["inputs"]["budget_php"] = 1

    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(request, 1),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"]["limiting_constraint"] == "budget"
    assert body["recommendation"]["rationale"] == (
        "₱1 does not cover a single standard-450 panel. This is the smallest "
        "system we can estimate and is ₱22,499 above your budget."
    )
    assert body["financials"]["budget_compatible"] is False
    assert body["financials"]["budget_gap_php"] == 22499


def test_adjust_panel_count_accepts_counts_above_demand(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    del request["inputs"]["budget_php"]
    request["inputs"]["monthly_consumption_kwh"] = "300.00"

    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(request, 6),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"]["panel_count"] == 6
    assert body["recommendation"]["limiting_constraint"] == "user_selected"
    assert "Savings are capped" in body["recommendation"]["rationale"]


def test_adjust_panel_count_rejects_counts_above_roof_capacity(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    del request["inputs"]["budget_php"]

    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(request, 17),
    )

    assert response.status_code == 422
    assert "17 panels exceed the usable roof area" in response.json()["detail"]


def test_adjust_panel_count_rejects_counts_above_budget(
    assessment_request_data: dict[str, object],
) -> None:
    request = deepcopy(assessment_request_data)
    # High enough that demand isn't the binding constraint; this test is
    # specifically about the budget rejection.
    request["inputs"]["monthly_consumption_kwh"] = "10000.00"

    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(request, 12),
    )

    assert response.status_code == 422
    assert "12 panels exceed the" in response.json()["detail"]


def test_adjust_panel_count_rejects_non_positive_counts(
    assessment_request_data: dict[str, object],
) -> None:
    response = client.post(
        "/api/v1/assessments/panel-count-adjustment",
        json=_adjustment_payload(assessment_request_data, 0),
    )

    assert response.status_code == 422
