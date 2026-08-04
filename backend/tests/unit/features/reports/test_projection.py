from decimal import Decimal

from app.features.assessment.schemas import CompletedAssessment
from app.features.reports.service import build_projection, build_sensitivity_cases
from app.features.reports.validator import build_report_input


def test_projection_keeps_year_one_assessment_values_then_applies_degradation(
    completed_assessment,
) -> None:
    rows = build_projection(build_report_input(completed_assessment))

    assert len(rows) == 25
    assert rows[0].generation_kwh == Decimal("4730.0")
    assert rows[0].annual_savings_php == 22704
    assert rows[1].generation_kwh == Decimal("4706.4")
    assert rows[-1].cumulative_net_php == 318814


def test_projection_holds_savings_flat_while_self_consumption_cap_binds(
    completed_assessment_data,
) -> None:
    # Generation (4730 kWh) exceeds annual consumption (3600 kWh), so the
    # self-consumption cap binds from year 1 onward even as generation
    # degrades. Savings must track the cap, not decay independently of it.
    completed_assessment_data["inputs"]["monthly_consumption_kwh"] = None
    completed_assessment_data["estimated_monthly_consumption_kwh"] = "300.00"
    completed_assessment_data["consumption_source"] = "bill"
    completed_assessment_data["financials"]["annual_savings_php"] = 21600
    completed_assessment_data["financials"]["monthly_savings_php"] = 1800
    assessment = CompletedAssessment.model_validate(completed_assessment_data)

    rows = build_projection(build_report_input(assessment))

    assert rows[0].annual_savings_php == 21600
    assert rows[1].generation_kwh < rows[0].generation_kwh
    assert rows[1].annual_savings_php == 21600
    assert rows[-1].annual_savings_php == 21600


def test_sensitivity_uses_only_the_four_fixed_demo_cases(completed_assessment) -> None:
    cases = build_sensitivity_cases(build_report_input(completed_assessment))

    assert [case.label for case in cases] == [
        "Base",
        "10% lower generation",
        "10% higher installed cost",
        "Combined downside",
    ]
    assert cases[0].generation_ratio == Decimal("1.00")
    assert cases[-1].generation_ratio == Decimal("0.90")
    assert cases[-1].installed_cost_ratio == Decimal("1.10")
