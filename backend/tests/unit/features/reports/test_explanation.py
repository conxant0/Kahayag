import pytest

from app.features.assessment.schemas import CompletedAssessment
from app.features.reports.schemas import ReportExplanation, ValidatedReportInput
from app.features.reports.service import resolve_explanation


@pytest.fixture
def report_input(
    completed_assessment: CompletedAssessment,
) -> ValidatedReportInput:
    return ValidatedReportInput.model_validate(completed_assessment.model_dump())


def test_resolves_approved_placeholders_from_report_values(
    report_input: ValidatedReportInput,
) -> None:
    explanation = ReportExplanation(
        summary="A {system_capacity_kwp} kWp system uses {panel_count} panels.",
        recommendation_reason="Estimated annual generation is {annual_generation_kwh} kWh.",
        next_steps=(
            (
                "Ask installers to verify the ₱{estimated_cost_low_php}–"
                "₱{estimated_cost_high_php} range."
            ),
        ),
    )

    resolved = resolve_explanation(report_input, explanation)

    assert resolved.used_fallback is False
    assert resolved.summary == "A 3.60 kWp system uses 8 panels."
    assert resolved.recommendation_reason == "Estimated annual generation is 4730 kWh."
    assert resolved.next_steps == (
        "Ask installers to verify the ₱180000–₱252000 range.",
    )


def test_unknown_placeholder_uses_fallback(
    report_input: ValidatedReportInput,
) -> None:
    explanation = ReportExplanation(
        summary="Guaranteed return: {invented_roi}",
        recommendation_reason="Demo",
        next_steps=("Demo",),
    )

    resolved = resolve_explanation(report_input, explanation)

    assert resolved.used_fallback is True
    assert "{invented_roi}" not in resolved.summary


def test_missing_ai_explanation_uses_fallback(
    report_input: ValidatedReportInput,
) -> None:
    resolved = resolve_explanation(report_input, None)

    assert resolved.used_fallback is True
    assert "8 panels" in resolved.summary


def test_malformed_ai_placeholder_uses_fallback(
    report_input: ValidatedReportInput,
) -> None:
    explanation = ReportExplanation(
        summary="A {panel_count system.",
        recommendation_reason="Demo",
        next_steps=("Demo",),
    )

    resolved = resolve_explanation(report_input, explanation)

    assert resolved.used_fallback is True


def test_unformattable_ai_placeholder_uses_fallback(
    report_input: ValidatedReportInput,
) -> None:
    report_without_payback = report_input.model_copy(
        update={
            "financials": report_input.financials.model_copy(
                update={"payback_years": None}
            )
        }
    )
    explanation = ReportExplanation(
        summary="Estimated payback: {payback_years:.2f} years.",
        recommendation_reason="Demo",
        next_steps=("Demo",),
    )

    resolved = resolve_explanation(report_without_payback, explanation)

    assert resolved.used_fallback is True


def test_unavailable_approved_placeholder_uses_sensible_fallback(
    report_input: ValidatedReportInput,
) -> None:
    report_without_payback = report_input.model_copy(
        update={
            "financials": report_input.financials.model_copy(
                update={"payback_years": None}
            )
        }
    )
    explanation = ReportExplanation(
        summary="Estimated payback: {payback_years} years.",
        recommendation_reason="Demo",
        next_steps=("Demo",),
    )

    resolved = resolve_explanation(report_without_payback, explanation)

    assert resolved.used_fallback is True
    assert "8 panels" in resolved.summary
    assert "None" not in " ".join(
        (resolved.summary, resolved.recommendation_reason, *resolved.next_steps)
    )


@pytest.mark.parametrize(
    "summary",
    [
        "Estimated capacity: {system_capacity_kwp:.1f} kWp.",
        "Panel count: {panel_count!s}.",
        "Panel count: {panel_count:100000}.",
        "Panel count: {panel_count:}.",
    ],
    ids=[
        "numeric-rounding",
        "conversion",
        "oversized-width",
        "empty-format-spec",
    ],
)
def test_non_bare_ai_placeholder_uses_fallback(
    report_input: ValidatedReportInput,
    summary: str,
) -> None:
    explanation = ReportExplanation(
        summary=summary,
        recommendation_reason="Demo",
        next_steps=("Demo",),
    )

    resolved = resolve_explanation(report_input, explanation)

    assert resolved.used_fallback is True


def test_excessive_ai_explanation_input_uses_fallback(
    report_input: ValidatedReportInput,
) -> None:
    explanation = ReportExplanation(
        summary="A" * 10_000,
        recommendation_reason="Demo",
        next_steps=("Demo",),
    )

    resolved = resolve_explanation(report_input, explanation)

    assert resolved.used_fallback is True
