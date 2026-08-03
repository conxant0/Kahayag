from copy import deepcopy
from decimal import Decimal

import pytest

from app.features.assessment.schemas import CompletedAssessment
from app.features.reports.schemas import ValidatedReportInput
from app.features.reports.validator import (
    build_report_input,
    validate_preserved_values,
)


def test_report_input_inherits_completed_assessment() -> None:
    assert issubclass(ValidatedReportInput, CompletedAssessment)


def test_build_report_input_preserves_completed_assessment(
    completed_assessment: CompletedAssessment,
) -> None:
    report = build_report_input(completed_assessment)

    assert report.model_dump() == completed_assessment.model_dump()


def test_validator_accepts_exact_canonical_report_candidate(
    completed_assessment: CompletedAssessment,
) -> None:
    candidate = build_report_input(completed_assessment)

    assert validate_preserved_values(completed_assessment, candidate) is None


@pytest.mark.parametrize(
    ("path", "replacement"),
    [
        (("recommendation", "panel_count"), 9),
        (("recommendation", "system_capacity_kwp"), Decimal("4.01")),
        (("recommendation", "annual_generation_kwh"), Decimal("5001.00")),
        (("financials", "estimated_cost_low_php"), 180001),
        (("financials", "estimated_cost_high_php"), 252001),
        (("financials", "annual_savings_php"), 60001),
        (("financials", "payback_years"), Decimal("3.76")),
    ],
)
def test_validator_rejects_altered_calculated_value(
    completed_assessment: CompletedAssessment,
    path: tuple[str, str],
    replacement: int | Decimal,
) -> None:
    from app.features.reports.validator import (
        AlteredReportValueError,
        validate_preserved_values,
    )

    candidate_data = deepcopy(completed_assessment.model_dump())
    candidate_data[path[0]][path[1]] = replacement
    candidate = ValidatedReportInput.model_validate(candidate_data)

    with pytest.raises(
        AlteredReportValueError,
        match="must match the completed assessment",
    ):
        validate_preserved_values(completed_assessment, candidate)
