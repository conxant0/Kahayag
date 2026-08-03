from copy import deepcopy
from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.features.assessment.schemas import AssessmentInputs, CompletedAssessment


def test_completed_assessment_accepts_representative_fixture(
    completed_assessment_data: dict[str, object],
) -> None:
    assessment = CompletedAssessment.model_validate(completed_assessment_data)

    assert assessment.recommendation.panel_count == 8
    assert assessment.financials.estimated_cost_low_php == 180000


def test_completed_assessment_preserves_decimal_and_date_json_parsing(
    completed_assessment_data: dict[str, object],
) -> None:
    assessment = CompletedAssessment.model_validate(completed_assessment_data)

    assert assessment.property.assessment_date == date(2026, 7, 25)
    assert assessment.roof.area_m2 == Decimal("40.00")


def test_assessment_inputs_defaults_panel_category(
    completed_assessment_data: dict[str, object],
) -> None:
    inputs = deepcopy(completed_assessment_data["inputs"])
    inputs.pop("panel_category_id", None)

    assessment = AssessmentInputs.model_validate(inputs)

    assert assessment.panel_category_id == "standard-450"


def test_assessment_inputs_accepts_high_output_category(
    completed_assessment_data: dict[str, object],
) -> None:
    inputs = deepcopy(completed_assessment_data["inputs"])
    inputs["panel_category_id"] = "high-output-550"

    assessment = AssessmentInputs.model_validate(inputs)

    assert assessment.panel_category_id == "high-output-550"


def test_assessment_inputs_rejects_unknown_panel_category(
    completed_assessment_data: dict[str, object],
) -> None:
    inputs = deepcopy(completed_assessment_data["inputs"])
    inputs["panel_category_id"] = "unknown"

    with pytest.raises(ValidationError):
        AssessmentInputs.model_validate(inputs)


@pytest.mark.parametrize(
    "section",
    [
        "property",
        "roof",
        "inputs",
        "recommendation",
        "financials",
        "assumptions",
        "limitations",
        "is_provisional",
    ],
)
def test_completed_assessment_requires_every_section(
    completed_assessment_data: dict[str, object],
    section: str,
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid.pop(section)

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)


@pytest.mark.parametrize(
    ("section", "field"),
    [
        ("recommendation", "panel_category_id"),
        ("recommendation", "panel_wattage_w"),
        ("recommendation", "panel_count"),
        ("recommendation", "system_capacity_kwp"),
        ("recommendation", "annual_generation_kwh"),
        ("recommendation", "annual_consumption_offset_ratio"),
        ("recommendation", "limiting_constraint"),
        ("recommendation", "rationale"),
        ("financials", "estimated_cost_low_php"),
        ("financials", "estimated_cost_high_php"),
        ("financials", "annual_savings_php"),
        ("financials", "monthly_savings_php"),
        ("financials", "budget_compatible"),
    ],
)
def test_completed_assessment_requires_nested_report_value(
    completed_assessment_data: dict[str, object],
    section: str,
    field: str,
) -> None:
    invalid = deepcopy(completed_assessment_data)
    nested = dict(invalid[section])
    nested.pop(field)
    invalid[section] = nested

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)


def test_completed_assessment_rejects_unknown_fields(
    completed_assessment_data: dict[str, object],
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["unexpected"] = True

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)


@pytest.mark.parametrize(
    ("section", "field"),
    [
        ("inputs", "monthly_bill_php"),
        ("inputs", "budget_php"),
        ("recommendation", "panel_wattage_w"),
        ("recommendation", "panel_count"),
        ("financials", "estimated_cost_low_php"),
        ("financials", "estimated_cost_high_php"),
        ("financials", "annual_savings_php"),
        ("financials", "monthly_savings_php"),
        ("assumptions", "cost_low_php_per_kwp"),
        ("assumptions", "cost_high_php_per_kwp"),
    ],
)
@pytest.mark.parametrize(
    "invalid_value",
    ["6000", True, 6000.0],
    ids=["string", "boolean", "float"],
)
def test_completed_assessment_rejects_non_integer_scalar_types(
    completed_assessment_data: dict[str, object],
    section: str,
    field: str,
    invalid_value: object,
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid[section] = {
        **invalid[section],
        field: invalid_value,
    }

    with pytest.raises(ValidationError) as exc_info:
        CompletedAssessment.model_validate(invalid)

    assert any(
        error["loc"] == (section, field) and error["type"] == "int_type"
        for error in exc_info.value.errors()
    )


@pytest.mark.parametrize(
    "invalid_value",
    ["true", 1, 1.0],
    ids=["string", "integer", "float"],
)
def test_completed_assessment_rejects_non_boolean_budget_compatibility(
    completed_assessment_data: dict[str, object],
    invalid_value: object,
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["financials"] = {
        **invalid["financials"],
        "budget_compatible": invalid_value,
    }

    with pytest.raises(ValidationError) as exc_info:
        CompletedAssessment.model_validate(invalid)

    assert any(
        error["loc"] == ("financials", "budget_compatible")
        and error["type"] == "bool_type"
        for error in exc_info.value.errors()
    )


@pytest.mark.parametrize(
    "invalid_value",
    ["true", 1, 1.0],
    ids=["string", "integer", "float"],
)
def test_completed_assessment_rejects_non_boolean_provisional_flag(
    completed_assessment_data: dict[str, object],
    invalid_value: object,
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["is_provisional"] = invalid_value

    with pytest.raises(ValidationError) as exc_info:
        CompletedAssessment.model_validate(invalid)

    assert any(
        error["loc"] == ("is_provisional",) and error["type"] == "bool_type"
        for error in exc_info.value.errors()
    )


def test_completed_assessment_rejects_usable_roof_area_above_total(
    completed_assessment_data: dict[str, object],
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["roof"] = {"area_m2": "40.00", "usable_area_m2": "40.01"}

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)


def test_completed_assessment_rejects_inverted_cost_range(
    completed_assessment_data: dict[str, object],
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["financials"] = {
        **invalid["financials"],
        "estimated_cost_low_php": 252001,
    }

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)


def test_completed_assessment_rejects_inverted_assumption_cost_range(
    completed_assessment_data: dict[str, object],
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["assumptions"] = {
        **invalid["assumptions"],
        "cost_low_php_per_kwp": 70001,
    }

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)


def test_completed_assessment_rejects_ratio_above_one(
    completed_assessment_data: dict[str, object],
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["recommendation"] = {
        **invalid["recommendation"],
        "annual_consumption_offset_ratio": Decimal("1.01"),
    }

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)


def test_completed_assessment_rejects_empty_limitations(
    completed_assessment_data: dict[str, object],
) -> None:
    invalid = deepcopy(completed_assessment_data)
    invalid["limitations"] = []

    with pytest.raises(ValidationError):
        CompletedAssessment.model_validate(invalid)
