from decimal import Decimal

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
