from app.features.reports.service import resolve_narrative
from app.features.reports.validator import build_report_input


def test_missing_ai_narrative_uses_complete_fixed_copy(completed_assessment) -> None:
    narrative = resolve_narrative(build_report_input(completed_assessment), None)

    assert narrative.used_fallback is True
    assert "8 panels" in narrative.executive_summary
    assert "verified on site" in narrative.technical_explanation.lower()
    assert narrative.contractor_observations
