# Defines preservation checks for calculated report values.

from app.features.assessment.schemas import CompletedAssessment
from app.features.reports.schemas import ValidatedReportInput


class AlteredReportValueError(ValueError):
    pass


def build_report_input(
    assessment: CompletedAssessment,
) -> ValidatedReportInput:
    return ValidatedReportInput.model_validate(assessment.model_dump())


def validate_preserved_values(
    assessment: CompletedAssessment,
    candidate: ValidatedReportInput,
) -> None:
    expected = build_report_input(assessment)
    if candidate != expected:
        raise AlteredReportValueError(
            "report values must match the completed assessment"
        )
