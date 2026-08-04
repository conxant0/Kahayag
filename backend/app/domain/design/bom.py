# Defines BOM expansion from valid combos into design component lines.

from app.domain.design.catalog import (
    CatalogBattery,
    CatalogInverter,
    CatalogPackage,
    CatalogPanel,
    SolarCatalog,
    get_battery,
    get_inverter,
    get_panel,
    load_catalog,
)
from app.domain.design.constants import (
    DEFAULT_CABLING_ID,
    DEFAULT_INSTALL_ID,
    DEFAULT_MOUNTING_KIT_ID,
    DEFAULT_PERMITS_ID,
    GRID_TIE_PROTECTION_ID,
    HYBRID_PROTECTION_ID,
)
from app.domain.design.entities import ComponentSlot, DesignComponent, ValidCombo
from app.domain.design.solver import _is_microinverter


def _component_from_panel(panel: CatalogPanel, qty: int, badges: tuple[str, ...] = ()) -> DesignComponent:
    return DesignComponent(
        slot="panel",
        catalog_id=panel.id,
        brand=panel.brand,
        model=panel.model,
        summary=f"{panel.wattage_w}W {panel.brand} panel",
        qty=qty,
        unit="pcs",
        unit_price_php=panel.price_php.mid,
        price_as_of=panel.price_php.as_of,
        line_total_php=round(panel.price_php.mid * qty, 2),
        warranty_note=f"{panel.warranty_product_years}-year product warranty",
        badges=badges,
        specs={
            "wattage_w": panel.wattage_w,
            "efficiency_pct": panel.efficiency_pct,
            "voc_v": panel.voc_v,
            "vmp_v": panel.vmp_v,
        },
    )


def _component_from_inverter(
    inverter: CatalogInverter,
    badges: tuple[str, ...] = (),
    qty: int = 1,
) -> DesignComponent:
    rated_kw = inverter.rated_ac_output_w / 1000
    return DesignComponent(
        slot="inverter",
        catalog_id=inverter.id,
        brand=inverter.brand,
        model=inverter.model,
        summary=f"{rated_kw:.1f} kW {inverter.brand} inverter",
        qty=qty,
        unit="pcs",
        unit_price_php=inverter.price_php.mid,
        price_as_of=inverter.price_php.as_of,
        line_total_php=round(inverter.price_php.mid * qty, 2),
        warranty_note=f"{inverter.warranty_years}-year warranty",
        badges=badges,
        specs={
            "rated_ac_kw": rated_kw,
            "mppt_count": inverter.mppt_count,
            "battery_compatible": int(inverter.battery_compatible),
        },
    )


def _component_from_battery(
    battery: CatalogBattery, badges: tuple[str, ...] = ()
) -> DesignComponent:
    return DesignComponent(
        slot="battery",
        catalog_id=battery.id,
        brand=battery.brand,
        model=battery.model,
        summary=f"{battery.usable_capacity_kwh} kWh storage",
        qty=1,
        unit="pcs",
        unit_price_php=battery.price_php.mid,
        price_as_of=battery.price_php.as_of,
        line_total_php=round(battery.price_php.mid, 2),
        warranty_note=f"{battery.warranty_years}-year warranty",
        badges=badges,
        specs={"usable_kwh": battery.usable_capacity_kwh},
    )


def _component_from_package(
    package: CatalogPackage,
    slot: ComponentSlot,
    qty: float,
    *,
    badges: tuple[str, ...] = ("INCLUDED",),
) -> DesignComponent:
    if package.price_php_per_kwp is not None:
        unit_price = package.price_php_per_kwp.mid
        line_total = unit_price * qty
        price_as_of = package.price_php_per_kwp.as_of
    else:
        unit_price = package.price_php.mid if package.price_php else 0.0
        line_total = unit_price * qty
        price_as_of = package.price_php.as_of if package.price_php else None

    return DesignComponent(
        slot=slot,
        catalog_id=package.id,
        brand=package.brand,
        model=package.model,
        summary=package.description,
        qty=qty,
        unit=package.unit,
        unit_price_php=unit_price,
        price_as_of=price_as_of,
        line_total_php=round(line_total, 2),
        warranty_note=(
            f"{package.warranty_years}-year warranty"
            if package.warranty_years
            else "As per installer terms"
        ),
        badges=badges,
    )


def expand_combo_to_components(
    combo: ValidCombo,
    *,
    catalog: SolarCatalog | None = None,
    ai_suggested: bool = False,
) -> tuple[DesignComponent, ...]:
    cat = catalog or load_catalog()
    panel = get_panel(combo.panel_id, cat)
    inverter = get_inverter(combo.inverter_id, cat)
    badges = ("AUTO-SUGGESTED",) if ai_suggested else ()

    components: list[DesignComponent] = [
        _component_from_panel(panel, combo.panel_count, badges=badges),
        _component_from_inverter(
            inverter,
            badges=badges,
            qty=combo.panel_count if _is_microinverter(inverter) else 1,
        ),
    ]

    if combo.battery_id:
        battery = get_battery(combo.battery_id, cat)
        components.append(_component_from_battery(battery, badges=badges))

    protection_id = (
        HYBRID_PROTECTION_ID if inverter.battery_compatible else GRID_TIE_PROTECTION_ID
    )
    protection = cat.protections[protection_id]
    components.append(
        _component_from_package(protection, "protection", 1, badges=("INCLUDED",))
    )

    mount = cat.mounting_kits[DEFAULT_MOUNTING_KIT_ID]
    components.append(
        _component_from_package(mount, "structure", combo.system_kwp, badges=("INCLUDED",))
    )

    cable = cat.cabling[DEFAULT_CABLING_ID]
    components.append(
        _component_from_package(cable, "electrical", combo.system_kwp, badges=("INCLUDED",))
    )

    install = cat.misc_bom_items[DEFAULT_INSTALL_ID]
    components.append(
        _component_from_package(install, "installation", combo.system_kwp, badges=("INCLUDED",))
    )

    permits = cat.misc_bom_items[DEFAULT_PERMITS_ID]
    components.append(
        _component_from_package(permits, "installation", 1, badges=("INCLUDED",))
    )

    return tuple(components)


def sum_component_lines(components: tuple[DesignComponent, ...]) -> float:
    return round(sum(component.line_total_php for component in components), 2)
