# Defines report-generation use-case orchestration.

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from string import Formatter
from uuid import uuid4

from app.features.reports.schemas import (
    ProjectionRow,
    ReportExplanation,
    ReportNarrative,
    ResolvedReportExplanation,
    ResolvedReportNarrative,
    SensitivityCase,
    ValidatedReportInput,
)
from app.features.reports.templates.fallback import (
    FALLBACK_NEXT_STEPS,
    FALLBACK_REASON,
    FALLBACK_SUMMARY,
)

_MAX_EXPLANATION_LENGTH = 4_000
_ANALYSIS_YEARS = 25
_ANNUAL_DEGRADATION = Decimal("0.005")


def _placeholder_values(report: ValidatedReportInput) -> dict[str, object]:
    return {
        "panel_count": report.recommendation.panel_count,
        "system_capacity_kwp": report.recommendation.system_capacity_kwp,
        "annual_generation_kwh": report.recommendation.annual_generation_kwh,
        "estimated_cost_low_php": report.financials.estimated_cost_low_php,
        "estimated_cost_high_php": report.financials.estimated_cost_high_php,
        "annual_savings_php": report.financials.annual_savings_php,
        "payback_years": report.financials.payback_years,
    }


def _has_only_approved_placeholders(
    template: str,
    values: dict[str, object],
) -> bool:
    try:
        tuple(Formatter().parse(template))
    except ValueError:
        return False

    index = 0
    while index < len(template):
        character = template[index]
        if character == "{":
            if index + 1 < len(template) and template[index + 1] == "{":
                index += 2
                continue
            closing_index = template.find("}", index + 1)
            if closing_index == -1:
                return False
            field_name = template[index + 1 : closing_index]
            if field_name not in values or values[field_name] is None:
                return False
            index = closing_index + 1
            continue
        if character == "}":
            if index + 1 >= len(template) or template[index + 1] != "}":
                return False
            index += 2
            continue
        index += 1

    return True


def _resolve_templates(
    explanation: ReportExplanation,
    values: dict[str, object],
) -> tuple[str, str, tuple[str, ...]] | None:
    templates = (
        explanation.summary,
        explanation.recommendation_reason,
        *explanation.next_steps,
    )
    if sum(len(template) for template in templates) > _MAX_EXPLANATION_LENGTH:
        return None
    if not all(
        _has_only_approved_placeholders(template, values)
        for template in templates
    ):
        return None

    try:
        resolved = tuple(template.format_map(values) for template in templates)
    except (KeyError, ValueError, AttributeError, IndexError, TypeError):
        return None

    if sum(len(text) for text in resolved) > _MAX_EXPLANATION_LENGTH:
        return None

    return resolved[0], resolved[1], resolved[2:]


def _fallback_explanation(values: dict[str, object]) -> ResolvedReportExplanation:
    resolved = _resolve_templates(
        ReportExplanation(
            summary=FALLBACK_SUMMARY,
            recommendation_reason=FALLBACK_REASON,
            next_steps=FALLBACK_NEXT_STEPS,
        ),
        values,
    )
    if resolved is None:
        raise RuntimeError("Fallback explanation templates must be valid")

    return ResolvedReportExplanation(
        summary=resolved[0],
        recommendation_reason=resolved[1],
        next_steps=resolved[2],
        used_fallback=True,
    )


def resolve_explanation(
    report: ValidatedReportInput,
    explanation: ReportExplanation | None,
) -> ResolvedReportExplanation:
    values = _placeholder_values(report)
    if explanation is not None:
        templates = (
            explanation.summary,
            explanation.recommendation_reason,
            *explanation.next_steps,
        )
        has_digit = any(
            any(character.isdigit() for character in text) for text in templates
        )
        resolved = None if has_digit else _resolve_templates(explanation, values)
        if resolved is not None:
            return ResolvedReportExplanation(
                summary=resolved[0],
                recommendation_reason=resolved[1],
                next_steps=resolved[2],
                used_fallback=False,
            )

    return _fallback_explanation(values)


def _rounded_php(value: Decimal) -> int:
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _scenario_rows(
    report: ValidatedReportInput,
    *,
    generation_ratio: Decimal = Decimal(1),
    installed_cost_ratio: Decimal = Decimal(1),
) -> tuple[ProjectionRow, ...]:
    generation = report.recommendation.annual_generation_kwh * generation_ratio
    savings = Decimal(report.financials.annual_savings_php) * generation_ratio
    cumulative = -Decimal(report.financials.estimated_base_cost_php) * installed_cost_ratio
    rows = []

    for year in range(1, _ANALYSIS_YEARS + 1):
        annual_savings = _rounded_php(savings)
        cumulative += annual_savings
        rows.append(
            ProjectionRow(
                year=year,
                generation_kwh=generation.quantize(Decimal("0.1")),
                annual_savings_php=annual_savings,
                cumulative_net_php=_rounded_php(cumulative),
            )
        )
        generation *= Decimal(1) - _ANNUAL_DEGRADATION
        savings *= Decimal(1) - _ANNUAL_DEGRADATION

    return tuple(rows)


def build_projection(report: ValidatedReportInput) -> tuple[ProjectionRow, ...]:
    return _scenario_rows(report)


def build_sensitivity_cases(
    report: ValidatedReportInput,
) -> tuple[SensitivityCase, ...]:
    cases = (
        ("Base", Decimal("1.00"), Decimal("1.00")),
        ("10% lower generation", Decimal("0.90"), Decimal("1.00")),
        ("10% higher installed cost", Decimal("1.00"), Decimal("1.10")),
        ("Combined downside", Decimal("0.90"), Decimal("1.10")),
    )
    result = []

    for label, generation_ratio, installed_cost_ratio in cases:
        rows = _scenario_rows(
            report,
            generation_ratio=generation_ratio,
            installed_cost_ratio=installed_cost_ratio,
        )
        annual_savings = Decimal(rows[0].annual_savings_php)
        cost = Decimal(report.financials.estimated_base_cost_php) * installed_cost_ratio
        payback = (
            None
            if annual_savings == 0
            else (cost / annual_savings).quantize(Decimal("0.1"))
        )
        result.append(
            SensitivityCase(
                label=label,
                generation_ratio=generation_ratio,
                installed_cost_ratio=installed_cost_ratio,
                payback_years=payback,
                year_25_net_php=rows[-1].cumulative_net_php,
            )
        )

    return tuple(result)


def _fallback_narrative(values: dict[str, object]) -> ResolvedReportNarrative:
    return ResolvedReportNarrative(
        executive_summary=(
            "This preliminary assessment recommends {panel_count} panels for a "
            "{system_capacity_kwp} kWp system. A contractor should verify the "
            "roof, electrical service, and final layout before quoting."
        ).format_map(values),
        technical_explanation=(
            "The layout appears suitable for an initial review, but panel spacing, "
            "setbacks, shading, structure, and cable routes must be verified on site."
        ),
        financial_explanation=(
            "The planning range is PHP {estimated_cost_low_php} to PHP "
            "{estimated_cost_high_php}. Savings and payback are preliminary and "
            "are not a contractor quotation."
        ).format_map(values),
        contractor_observations=(
            "Measure the roof and confirm final panel setbacks.",
            "Inspect the main panel, breakers, grounding, and cable route.",
            "Prepare an itemized quotation with permits and exclusions stated.",
        ),
        used_fallback=True,
    )


def resolve_narrative(
    report: ValidatedReportInput,
    candidate: ReportNarrative | None,
) -> ResolvedReportNarrative:
    values = _placeholder_values(report)
    if candidate is None:
        return _fallback_narrative(values)

    templates = (
        candidate.executive_summary,
        candidate.technical_explanation,
        candidate.financial_explanation,
        *candidate.contractor_observations,
    )
    if any(any(character.isdigit() for character in text) for text in templates):
        return _fallback_narrative(values)
    if not all(_has_only_approved_placeholders(text, values) for text in templates):
        return _fallback_narrative(values)

    try:
        resolved = tuple(text.format_map(values) for text in templates)
    except (KeyError, ValueError, AttributeError, IndexError, TypeError):
        return _fallback_narrative(values)

    return ResolvedReportNarrative(
        executive_summary=resolved[0],
        technical_explanation=resolved[1],
        financial_explanation=resolved[2],
        contractor_observations=resolved[3:],
        used_fallback=False,
    )


def new_report_id(assessment_date: date) -> str:
    return f"KAH-{assessment_date:%Y%m%d}-{uuid4().hex[:8].upper()}"
