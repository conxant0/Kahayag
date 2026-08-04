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
from app.domain.design.solver import _evaluate_combo

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
        message = rejection.message if rejection is not None else "Does not fit this design."
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
                catalog_id=candidate.id,
                selected_id=panel_id,
                combo=combo,
                rejection=rejection,
                appears_in_valid=appears,
                best_fit=best_fit_score,
            )
            brand, model, summary, specs = _option_from_panel(candidate)
            options.append(
                CatalogOption(
                    id=candidate.id,
                    brand=brand,
                    model=model,
                    summary=summary,
                    status=status,
                    reason=reason,
                    specs=specs,
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
                catalog_id=candidate.id,
                selected_id=inverter_id,
                combo=combo,
                rejection=rejection,
                appears_in_valid=appears,
                best_fit=best_fit_score,
            )
            brand, model, summary, specs = _option_from_inverter(candidate)
            options.append(
                CatalogOption(
                    id=candidate.id,
                    brand=brand,
                    model=model,
                    summary=summary,
                    status=status,
                    reason=reason,
                    specs=specs,
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
                catalog_id=candidate.id,
                selected_id=battery_id,
                combo=combo,
                rejection=rejection,
                appears_in_valid=appears,
                best_fit=best_fit_score,
            )
            brand, model, summary, specs = _option_from_battery(candidate)
            options.append(
                CatalogOption(
                    id=candidate.id,
                    brand=brand,
                    model=model,
                    summary=summary,
                    status=status,
                    reason=reason,
                    specs=specs,
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
