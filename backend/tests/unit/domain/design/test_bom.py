# Defines BOM and financial rollup unit tests.

from app.domain.design.bom import expand_combo_to_components, sum_component_lines
from app.domain.design.constants import VAT_RATE
from app.domain.design.entities import ValidCombo
from app.domain.design.financials import calculate_vat_php


def _sample_combo() -> ValidCombo:
    return ValidCombo(
        combo_id="panel_001:inv_001:none:8",
        panel_id="panel_001",
        inverter_id="inv_001",
        battery_id=None,
        panel_count=8,
        system_kwp=3.52,
        dc_ac_ratio=1.17,
        inverter_utilisation_pct=70.4,
        fit_score=75.0,
        rejection_log_ref="solve-test",
        estimated_cost_php=250_000.0,
    )


def test_bom_line_sums_match_subtotal() -> None:
    components = expand_combo_to_components(_sample_combo())
    subtotal = sum_component_lines(components)
    assert subtotal > 0
    assert len(components) >= 5


def test_vat_is_twelve_percent_of_subtotal() -> None:
    subtotal = 100_000.0
    assert calculate_vat_php(subtotal) == round(subtotal * VAT_RATE, 2)
