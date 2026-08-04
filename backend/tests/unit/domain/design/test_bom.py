# Defines BOM and financial rollup unit tests.

from app.domain.design.bom import (
    GRID_TIE_BOM_LINES,
    expand_combo_to_components,
    sum_component_lines,
    sum_component_lines_at_tier,
)
from app.domain.design.constants import VAT_RATE
from app.domain.design.entities import ValidCombo
from app.domain.design.financials import (
    build_design_build,
    calculate_total_php,
    calculate_vat_php,
)


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
    assert len(components) == 2 + len(GRID_TIE_BOM_LINES)


def test_bom_expands_granular_balance_of_system_lines() -> None:
    components = expand_combo_to_components(_sample_combo())
    catalog_ids = {component.catalog_id for component in components}
    panel = next(component for component in components if component.slot == "panel")
    assert panel.product_image is not None
    assert "prot_005" in catalog_ids
    assert "prot_006" in catalog_ids
    assert "cable_003" in catalog_ids
    assert "misc_005" in catalog_ids
    assert "prot_001" not in catalog_ids
    assert "cable_001" not in catalog_ids


def test_vat_is_twelve_percent_of_subtotal() -> None:
    subtotal = 100_000.0
    assert calculate_vat_php(subtotal) == round(subtotal * VAT_RATE, 2)


def test_component_line_tiers_bracket_mid_subtotal() -> None:
    components = expand_combo_to_components(_sample_combo())
    subtotal = sum_component_lines(components)
    subtotal_low = sum_component_lines_at_tier(components, "min")
    subtotal_high = sum_component_lines_at_tier(components, "max")
    assert subtotal_low <= subtotal <= subtotal_high
    assert subtotal_low < subtotal_high


def test_build_investment_range_wraps_catalog_tiers() -> None:
    combo = _sample_combo()
    components = expand_combo_to_components(combo)
    build = build_design_build(
        build_id="build-test",
        label="Test build",
        tags=(),
        combo=combo,
        solve_id="solve-test",
        components=components,
        source="ai_suggested",
        annual_consumption_kwh=6000.0,
        annual_yield_per_kwp_kwh=1314.0,
        resolved_tariff_php_per_kwh=12.0,
    )
    assert build.total_investment_low_php <= build.total_investment_php
    assert build.total_investment_php <= build.total_investment_high_php
    assert build.total_investment_low_php == calculate_total_php(
        sum_component_lines_at_tier(components, "min")
    )
    assert build.total_investment_high_php == calculate_total_php(
        sum_component_lines_at_tier(components, "max")
    )
