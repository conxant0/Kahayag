# Defines financial rollup for design builds from BOM lines.

from decimal import Decimal

from app.domain.design.bom import sum_component_lines
from app.domain.design.constants import VAT_RATE
from app.domain.design.entities import DesignBuild, DesignComponent, ValidCombo


def calculate_vat_php(subtotal_php: float) -> float:
    return round(subtotal_php * VAT_RATE, 2)


def calculate_total_php(subtotal_php: float) -> float:
    return round(subtotal_php + calculate_vat_php(subtotal_php), 2)


def compute_savings(
    *,
    system_kwp: float,
    annual_consumption_kwh: float,
    annual_yield_per_kwp_kwh: float,
    resolved_tariff_php_per_kwh: float,
) -> tuple[float, float]:
    annual_generation = system_kwp * annual_yield_per_kwp_kwh
    billable = min(annual_generation, annual_consumption_kwh)
    annual_savings = billable * resolved_tariff_php_per_kwh
    monthly_savings = annual_savings / 12
    return round(monthly_savings, 2), round(annual_savings, 2)


def compute_payback_years(total_investment_php: float, annual_savings_php: float) -> float | None:
    if annual_savings_php <= 0:
        return None
    return round(total_investment_php / annual_savings_php, 1)


def compute_co2_tonnes(system_kwp: float, annual_yield_per_kwp_kwh: float) -> float:
    annual_kwh = system_kwp * annual_yield_per_kwp_kwh
    return round(annual_kwh * 0.0007, 2)


def build_insight(combo: ValidCombo, payback_years: float | None) -> str:
    payback_text = f"{payback_years} years" if payback_years else "N/A"
    return (
        f"{combo.system_kwp} kWp system with DC:AC {combo.dc_ac_ratio} "
        f"and {combo.inverter_utilisation_pct}% inverter utilisation. "
        f"Estimated payback {payback_text}."
    )


def build_design_build(
    *,
    build_id: str,
    label: str,
    tags: tuple[str, ...],
    combo: ValidCombo,
    solve_id: str,
    components: tuple[DesignComponent, ...],
    source: str,
    annual_consumption_kwh: float,
    annual_yield_per_kwp_kwh: float,
    resolved_tariff_php_per_kwh: float,
) -> DesignBuild:
    from app.domain.design.catalog import get_inverter, load_catalog

    cat = load_catalog()
    inverter = get_inverter(combo.inverter_id, cat)
    subtotal = sum_component_lines(components)
    vat = calculate_vat_php(subtotal)
    total = calculate_total_php(subtotal)
    monthly_savings, annual_savings = compute_savings(
        system_kwp=combo.system_kwp,
        annual_consumption_kwh=annual_consumption_kwh,
        annual_yield_per_kwp_kwh=annual_yield_per_kwp_kwh,
        resolved_tariff_php_per_kwh=resolved_tariff_php_per_kwh,
    )
    payback = compute_payback_years(total, annual_savings)
    battery_kwh = None
    if combo.battery_id:
        battery_kwh = cat.batteries[combo.battery_id].usable_capacity_kwh

    return DesignBuild(
        id=build_id,
        label=label,
        tags=tags,
        combo_id=combo.combo_id,
        solve_id=solve_id,
        system_kwp=combo.system_kwp,
        panel_count=combo.panel_count,
        inverter_kw=round(inverter.rated_ac_output_w / 1000, 2),
        battery_kwh=battery_kwh,
        monthly_savings_php=monthly_savings,
        annual_savings_php=annual_savings,
        payback_years=payback,
        total_investment_php=total,
        subtotal_php=subtotal,
        vat_php=vat,
        inverter_utilisation_pct=combo.inverter_utilisation_pct,
        fit_score=combo.fit_score,
        co2_tonnes_avoided_yearly=compute_co2_tonnes(
            combo.system_kwp, annual_yield_per_kwp_kwh
        ),
        insight=build_insight(combo, payback),
        components=components,
        source=source,  # type: ignore[arg-type]
    )


def annual_consumption_from_assessment(assessment: dict[str, object]) -> float:
    monthly = assessment.get("estimated_monthly_consumption_kwh")
    if monthly is not None:
        return float(Decimal(str(monthly))) * 12
    inputs = assessment.get("inputs")
    if isinstance(inputs, dict) and inputs.get("monthly_consumption_kwh"):
        return float(Decimal(str(inputs["monthly_consumption_kwh"]))) * 12
    return 6000.0
