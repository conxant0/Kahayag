# Defines unit tests for cheaper inverter swap selection.

from app.domain.design.catalog import get_inverter, load_catalog
from app.features.design.schemas import DesignBuildSchema, DesignComponentSchema
from app.features.design.service import (
    _inverter_line_cost_mid,
    _pick_cheaper_inverter_combo,
)


def _build_with_inverter(
    *,
    inverter_id: str,
    panel_count: int,
    line_total_php: float,
    total_investment_php: float,
) -> DesignBuildSchema:
    catalog = load_catalog()
    inverter = get_inverter(inverter_id, catalog)
    return DesignBuildSchema(
        id="build-test",
        label="Test build",
        tags=(),
        combo_id="combo-test",
        solve_id="solve-test",
        system_kwp=5.85,
        panel_count=panel_count,
        inverter_kw=5.0,
        battery_kwh=None,
        monthly_savings_php=8000.0,
        annual_savings_php=96000.0,
        payback_years=4.3,
        total_investment_php=total_investment_php,
        total_investment_low_php=total_investment_php * 0.9,
        total_investment_high_php=total_investment_php * 1.1,
        subtotal_php=total_investment_php * 0.89,
        vat_php=total_investment_php * 0.11,
        inverter_utilisation_pct=79.0,
        fit_score=61.0,
        co2_tonnes_avoided_yearly=5.6,
        insight="Test build.",
        components=(
            DesignComponentSchema(
                slot="panel",
                catalog_id="panel_020",
                brand="DMEGC",
                model="DM450M10RT-54H",
                summary="PV modules",
                qty=float(panel_count),
                unit="pcs",
                unit_price_php=20000.0,
                line_total_php=20000.0 * panel_count,
                warranty_note="12-year product warranty",
            ),
            DesignComponentSchema(
                slot="inverter",
                catalog_id=inverter_id,
                brand=inverter.brand,
                model=inverter.model,
                summary="Inverter",
                qty=1.0 if inverter.rated_ac_output_w >= 1000 else float(panel_count),
                unit="pcs",
                unit_price_php=line_total_php,
                line_total_php=line_total_php,
                warranty_note="10-year warranty",
            ),
        ),
        source="custom",
    )


def test_inverter_line_cost_scales_microinverters_by_panel_count() -> None:
    catalog = load_catalog()
    string_inv = get_inverter("inv_005", catalog)
    micro_inv = get_inverter("inv_009", catalog)

    assert _inverter_line_cost_mid(string_inv, 13) == string_inv.price_php.mid
    assert _inverter_line_cost_mid(micro_inv, 13) == micro_inv.price_php.mid * 13
    assert _inverter_line_cost_mid(micro_inv, 13) > _inverter_line_cost_mid(string_inv, 13)


def test_pick_cheaper_inverter_rejects_microinverter_with_lower_unit_price() -> None:
    from app.domain.design.entities import ValidCombo

    catalog = load_catalog()
    string_inv = get_inverter("inv_005", catalog)
    active = _build_with_inverter(
        inverter_id="inv_005",
        panel_count=13,
        line_total_php=string_inv.price_php.mid,
        total_investment_php=411_026.0,
    )
    micro_combo = ValidCombo(
        combo_id="panel_020:inv_009:none:13",
        panel_id="panel_020",
        inverter_id="inv_009",
        battery_id=None,
        panel_count=13,
        system_kwp=5.85,
        dc_ac_ratio=1.18,
        inverter_utilisation_pct=99.0,
        fit_score=67.5,
        rejection_log_ref="test",
        estimated_cost_php=600_000.0,
    )
    string_combo = ValidCombo(
        combo_id="panel_020:inv_033:none:13",
        panel_id="panel_020",
        inverter_id="inv_033",
        battery_id=None,
        panel_count=13,
        system_kwp=5.85,
        dc_ac_ratio=1.18,
        inverter_utilisation_pct=78.0,
        fit_score=60.0,
        rejection_log_ref="test",
        estimated_cost_php=390_000.0,
    )

    picked = _pick_cheaper_inverter_combo(
        (micro_combo, string_combo),
        active=active,
        current_inverter_id="inv_005",
    )

    assert picked is not None
    assert picked.inverter_id == "inv_033"
    assert picked.inverter_id != "inv_009"
