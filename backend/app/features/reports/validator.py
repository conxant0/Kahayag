# Defines preservation checks for calculated report values.
# Note: this checks the candidate against what the client posted as the
# assessment, not against a server-side computation. There is no database or
# server session to compute from independently, so this guards against the
# client-supplied report values being altered in transit or by the frontend
# after the assessment was built, not against the client fabricating the
# assessment itself.

from app.features.assessment.schemas import CompletedAssessment
from app.features.reports.schemas import ValidatedReportInput


class AlteredReportValueError(ValueError):
    pass


def build_report_input(
    assessment: CompletedAssessment,
) -> ValidatedReportInput:
    if assessment.inputs.monthly_consumption_kwh is None:
        raise ValueError(
            "assessment must include monthly_consumption_kwh to generate a report"
        )
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
