# Defines catalog option compatibility scoring for the design canvas picker.

from dataclasses import dataclass, replace
from typing import Literal

from app.domain.design.catalog import (
    CatalogBattery,
    CatalogInverter,
    CatalogPanel,
    SolarCatalog,
    get_battery,
    get_inverter,
    get_panel,
    load_catalog,
)
from app.domain.design.entities import SolverConstraints
from app.domain.design.rejection import humanize_catalog_rejection
from app.domain.design.solver import _evaluate_combo, _is_microinverter

CatalogOptionStatus = Literal["selected", "recommended", "compatible", "incompatible"]
CatalogSlot = Literal["panel", "inverter", "battery"]


@dataclass(frozen=True)
class CatalogOption:
    id: str
    brand: str
    model: str
    summary: str
    status: CatalogOptionStatus
    reason: str | None
    specs: dict[str, str | float | int]
    unit_price_php: float = 0.0
    unit_price_low_php: float = 0.0
    unit_price_high_php: float = 0.0
    line_total_php: float = 0.0
    line_total_low_php: float = 0.0
    line_total_high_php: float = 0.0
    qty: float = 1.0


def _picker_qty(
    slot: CatalogSlot,
    *,
    panel_count: int,
    inverter: CatalogInverter | None = None,
    candidate_inverter: CatalogInverter | None = None,
) -> float:
    if slot == "panel":
        return float(max(panel_count, 1))
    if slot == "inverter":
        inv = candidate_inverter or inverter
        if inv is not None and _is_microinverter(inv):
            return float(max(panel_count, 1))
        return 1.0
    return 1.0


def _price_fields(
    price,
    *,
    qty: float,
) -> dict[str, float]:
    return {
        "unit_price_php": price.mid,
        "unit_price_low_php": price.min,
        "unit_price_high_php": price.max,
        "line_total_php": round(price.mid * qty, 2),
        "line_total_low_php": round(price.min * qty, 2),
        "line_total_high_php": round(price.max * qty, 2),
        "qty": qty,
    }


def _option_from_panel(panel: CatalogPanel) -> tuple[str, str, str, dict[str, str | float | int]]:
    return (
        panel.brand,
        panel.model,
        f"{panel.wattage_w}W {panel.brand} panel",
        {
            "wattage_w": panel.wattage_w,
            "efficiency_pct": panel.efficiency_pct,
        },
    )


def _option_from_inverter(
    inverter: CatalogInverter,
) -> tuple[str, str, str, dict[str, str | float | int]]:
    rated_kw = round(inverter.rated_ac_output_w / 1000, 3)
    return (
        inverter.brand,
        inverter.model,
        f"{rated_kw} kW {inverter.brand} inverter",
        {
            "rated_ac_kw": rated_kw,
            "mppt_count": inverter.mppt_count,
        },
    )


def _option_from_battery(
    battery: CatalogBattery,
) -> tuple[str, str, str, dict[str, str | float | int]]:
    return (
        battery.brand,
        battery.model,
        f"{battery.usable_capacity_kwh} kWh {battery.brand} battery",
        {
            "usable_kwh": battery.usable_capacity_kwh,
        },
    )


def _resolve_status(
    *,
    slot: CatalogSlot,
    catalog_id: str,
    selected_id: str | None,
    combo,
    rejection,
    appears_in_valid: bool,
    best_fit: float,
) -> tuple[CatalogOptionStatus, str | None]:
    if selected_id == catalog_id:
        return "selected", None
    if combo is None:
        message = humanize_catalog_rejection(rejection, slot=slot)
        return "incompatible", message
    if appears_in_valid or combo.fit_score >= max(best_fit - 3.0, 75.0):
        return "recommended", None
    return "compatible", None


def list_catalog_options(
    *,
    slot: CatalogSlot,
    constraints: SolverConstraints,
    panel_id: str | None,
    inverter_id: str | None,
    battery_id: str | None,
    panel_count: int,
    valid_combo_ids: set[str],
    best_fit_score: float,
    catalog: SolarCatalog | None = None,
) -> tuple[CatalogOption, ...]:
    cat = catalog or load_catalog()
    if panel_id is None or inverter_id is None or panel_count <= 0:
        return ()

    panel = get_panel(panel_id, cat)
    inverter = get_inverter(inverter_id, cat)
    battery = get_battery(battery_id, cat) if battery_id else None

    options: list[CatalogOption] = []

    if slot == "panel":
        for candidate in cat.panels.values():
            combo, rejection = _evaluate_combo(
                candidate,
                inverter,
                battery,
                panel_count,
                constraints,
                cat,
                "catalog-option",
            )
            appears = any(
                combo_id.startswith(f"{candidate.id}:")
                for combo_id in valid_combo_ids
            )
            status, reason = _resolve_status(
                slot="panel",
                catalog_id=candidate.id,
                selected_id=panel_id,
                combo=combo,
                rejection=rejection,
                appears_in_valid=appears,
                best_fit=best_fit_score,
            )
            brand, model, summary, specs = _option_from_panel(candidate)
            qty = _picker_qty("panel", panel_count=panel_count)
            options.append(
                CatalogOption(
                    id=candidate.id,
                    brand=brand,
                    model=model,
                    summary=summary,
                    status=status,
                    reason=reason,
                    specs=specs,
                    **_price_fields(candidate.price_php, qty=qty),
                ),
            )
    elif slot == "inverter":
        for candidate in cat.inverters.values():
            combo, rejection = _evaluate_combo(
                panel,
                candidate,
                battery,
                panel_count,
                constraints,
                cat,
                "catalog-option",
            )
            appears = any(
                f":{candidate.id}:" in combo_id for combo_id in valid_combo_ids
            )
            status, reason = _resolve_status(
                slot="inverter",
                catalog_id=candidate.id,
                selected_id=inverter_id,
                combo=combo,
                rejection=rejection,
                appears_in_valid=appears,
                best_fit=best_fit_score,
            )
            brand, model, summary, specs = _option_from_inverter(candidate)
            qty = _picker_qty(
                "inverter",
                panel_count=panel_count,
                candidate_inverter=candidate,
            )
            options.append(
                CatalogOption(
                    id=candidate.id,
                    brand=brand,
                    model=model,
                    summary=summary,
                    status=status,
                    reason=reason,
                    specs=specs,
                    **_price_fields(candidate.price_php, qty=qty),
                ),
            )
    else:
        battery_constraints = replace(
            constraints,
            require_battery=True,
            min_battery_kwh=constraints.min_battery_kwh or 3.0,
        )
        for candidate in cat.batteries.values():
            combo, rejection = _evaluate_combo(
                panel,
                inverter,
                candidate,
                panel_count,
                battery_constraints,
                cat,
                "catalog-option",
            )
            appears = any(
                f":{candidate.id}:" in combo_id for combo_id in valid_combo_ids
            )
            status, reason = _resolve_status(
                slot="battery",
                catalog_id=candidate.id,
                selected_id=battery_id,
                combo=combo,
                rejection=rejection,
                appears_in_valid=appears,
                best_fit=best_fit_score,
            )
            brand, model, summary, specs = _option_from_battery(candidate)
            qty = _picker_qty("battery", panel_count=panel_count)
            options.append(
                CatalogOption(
                    id=candidate.id,
                    brand=brand,
                    model=model,
                    summary=summary,
                    status=status,
                    reason=reason,
                    specs=specs,
                    **_price_fields(candidate.price_php, qty=qty),
                ),
            )

    status_rank = {
        "selected": 0,
        "recommended": 1,
        "compatible": 2,
        "incompatible": 3,
    }
    options.sort(key=lambda row: (status_rank[row.status], row.brand, row.model))
    return tuple(options)
