# Defines BOM expansion from valid combos into design component lines.

from dataclasses import dataclass, replace
from typing import Literal

PriceTier = Literal["min", "max"]

from app.domain.design.catalog import (
    CatalogBattery,
    CatalogInverter,
    CatalogPackage,
    CatalogPanel,
    CatalogPrice,
    SolarCatalog,
    get_battery,
    get_inverter,
    get_panel,
    load_catalog,
)
from app.domain.design.constants import (
    DEFAULT_INSTALL_ID,
    DEFAULT_MOUNTING_KIT_ID,
    DEFAULT_NET_METER_ID,
    DEFAULT_PERMITS_ID,
)
from app.domain.design.entities import ComponentSlot, DesignComponent, ValidCombo

CatalogSection = Literal["protections", "mounting_kits", "cabling", "misc_bom_items"]
QtyBasis = Literal["fixed", "system_kwp"]

_PACKAGE_IMAGE_FOLDERS: dict[CatalogSection, str] = {
    "protections": "protections",
    "mounting_kits": "mounting",
    "cabling": "cabling",
    "misc_bom_items": "misc",
}


@dataclass(frozen=True)
class BomLineTemplate:
    section: CatalogSection
    catalog_id: str
    slot: ComponentSlot
    qty_basis: QtyBasis
    fixed_qty: float = 1.0


GRID_TIE_BOM_LINES: tuple[BomLineTemplate, ...] = (
    BomLineTemplate("protections", "prot_005", "protection", "fixed"),
    BomLineTemplate("protections", "prot_006", "protection", "fixed"),
    BomLineTemplate("protections", "prot_007", "protection", "fixed"),
    BomLineTemplate("protections", "prot_008", "protection", "fixed"),
    BomLineTemplate("protections", "prot_009", "protection", "fixed"),
    BomLineTemplate("protections", "prot_011", "protection", "fixed"),
    BomLineTemplate("protections", "prot_012", "protection", "fixed"),
    BomLineTemplate("misc_bom_items", "misc_007", "protection", "fixed"),
    BomLineTemplate("mounting_kits", DEFAULT_MOUNTING_KIT_ID, "structure", "system_kwp"),
    BomLineTemplate("cabling", "cable_003", "electrical", "system_kwp"),
    BomLineTemplate("cabling", "cable_004", "electrical", "fixed"),
    BomLineTemplate("cabling", "cable_005", "electrical", "fixed"),
    BomLineTemplate("cabling", "cable_006", "electrical", "system_kwp"),
    BomLineTemplate("cabling", "cable_007", "electrical", "fixed"),
    BomLineTemplate("misc_bom_items", "misc_006", "electrical", "fixed"),
    BomLineTemplate("misc_bom_items", DEFAULT_INSTALL_ID, "installation", "system_kwp"),
    BomLineTemplate("misc_bom_items", DEFAULT_PERMITS_ID, "installation", "fixed"),
    BomLineTemplate("misc_bom_items", DEFAULT_NET_METER_ID, "installation", "fixed"),
)

HYBRID_EXTRA_BOM_LINES: tuple[BomLineTemplate, ...] = (
    BomLineTemplate("protections", "prot_010", "protection", "fixed"),
)


def _is_microinverter(inverter: CatalogInverter) -> bool:
    return inverter.rated_ac_output_w < 1000


def _package_product_image(
    package: CatalogPackage,
    section: CatalogSection,
) -> str | None:
    if package.product_image:
        return package.product_image
    folder = _PACKAGE_IMAGE_FOLDERS.get(section)
    if folder is None:
        return None
    return f"https://assets.kahayag.dev/catalog/{folder}/{package.id}.jpg"


def _catalog_packages(
    catalog: SolarCatalog,
    section: CatalogSection,
) -> dict[str, CatalogPackage]:
    if section == "protections":
        return catalog.protections
    if section == "mounting_kits":
        return catalog.mounting_kits
    if section == "cabling":
        return catalog.cabling
    return catalog.misc_bom_items


def _resolve_qty(template: BomLineTemplate, system_kwp: float) -> float:
    if template.qty_basis == "system_kwp":
        return system_kwp
    return template.fixed_qty


def _package_line_cost(package: CatalogPackage, qty: float) -> float:
    if package.price_php_per_kwp is not None:
        return package.price_php_per_kwp.mid * qty
    if package.price_php is not None:
        return package.price_php.mid * qty
    return 0.0


def _bom_line_templates(
    *,
    hybrid: bool,
    mounting_kit_id: str | None = None,
) -> tuple[BomLineTemplate, ...]:
    base = GRID_TIE_BOM_LINES + (HYBRID_EXTRA_BOM_LINES if hybrid else ())
    if mounting_kit_id is None:
        return base
    return tuple(
        replace(template, catalog_id=mounting_kit_id)
        if template.section == "mounting_kits"
        else template
        for template in base
    )


def estimate_balance_of_system_cost_php(
    system_kwp: float,
    *,
    hybrid: bool,
    catalog: SolarCatalog | None = None,
    mounting_kit_id: str | None = None,
) -> float:
    cat = catalog or load_catalog()
    total = 0.0
    for template in _bom_line_templates(hybrid=hybrid, mounting_kit_id=mounting_kit_id):
        package = _catalog_packages(cat, template.section)[template.catalog_id]
        qty = _resolve_qty(template, system_kwp)
        total += _package_line_cost(package, qty)
    return total


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
        product_image=panel.product_image,
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
        product_image=inverter.product_image,
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
        product_image=battery.product_image,
    )


def _component_from_package(
    package: CatalogPackage,
    slot: ComponentSlot,
    qty: float,
    *,
    badges: tuple[str, ...] = ("INCLUDED",),
    section: CatalogSection | None = None,
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
        product_image=_package_product_image(package, section) if section else None,
    )


def _expand_balance_of_system_lines(
    *,
    system_kwp: float,
    hybrid: bool,
    catalog: SolarCatalog,
    badges: tuple[str, ...],
    mounting_kit_id: str | None = None,
) -> list[DesignComponent]:
    lines: list[DesignComponent] = []
    for template in _bom_line_templates(hybrid=hybrid, mounting_kit_id=mounting_kit_id):
        package = _catalog_packages(catalog, template.section)[template.catalog_id]
        qty = _resolve_qty(template, system_kwp)
        lines.append(
            _component_from_package(
                package,
                template.slot,
                qty,
                badges=badges,
                section=template.section,
            ),
        )
    return lines


def expand_combo_to_components(
    combo: ValidCombo,
    *,
    catalog: SolarCatalog | None = None,
    ai_suggested: bool = False,
    mounting_kit_id: str | None = None,
) -> tuple[DesignComponent, ...]:
    cat = catalog or load_catalog()
    panel = get_panel(combo.panel_id, cat)
    inverter = get_inverter(combo.inverter_id, cat)
    badges = ("AUTO-SUGGESTED",) if ai_suggested else ()
    included_badges = ("INCLUDED",)

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

    components.extend(
        _expand_balance_of_system_lines(
            system_kwp=combo.system_kwp,
            hybrid=inverter.battery_compatible,
            catalog=cat,
            badges=included_badges,
            mounting_kit_id=mounting_kit_id,
        ),
    )

    return tuple(components)


def sum_component_lines(components: tuple[DesignComponent, ...]) -> float:
    return round(sum(component.line_total_php for component in components), 2)


def _find_package(catalog_id: str, catalog: SolarCatalog) -> CatalogPackage | None:
    for section in (
        catalog.protections,
        catalog.mounting_kits,
        catalog.cabling,
        catalog.misc_bom_items,
    ):
        if catalog_id in section:
            return section[catalog_id]
    return None


def _unit_price_at_tier(price: CatalogPrice, tier: PriceTier) -> float:
    return price.min if tier == "min" else price.max


def _package_line_total_at_tier(
    package: CatalogPackage,
    qty: float,
    tier: PriceTier,
) -> float:
    if package.price_php_per_kwp is not None:
        unit_price = _unit_price_at_tier(package.price_php_per_kwp, tier)
        return round(unit_price * qty, 2)
    if package.price_php is not None:
        unit_price = _unit_price_at_tier(package.price_php, tier)
        return round(unit_price * qty, 2)
    return 0.0


def _line_total_at_tier(
    component: DesignComponent,
    tier: PriceTier,
    catalog: SolarCatalog,
) -> float:
    if component.catalog_id is None:
        return component.line_total_php

    catalog_id = component.catalog_id
    qty = component.qty

    if component.slot == "panel":
        price = get_panel(catalog_id, catalog).price_php
        return round(_unit_price_at_tier(price, tier) * qty, 2)
    if component.slot == "inverter":
        price = get_inverter(catalog_id, catalog).price_php
        return round(_unit_price_at_tier(price, tier) * qty, 2)
    if component.slot == "battery":
        price = get_battery(catalog_id, catalog).price_php
        return round(_unit_price_at_tier(price, tier) * qty, 2)

    package = _find_package(catalog_id, catalog)
    if package is None:
        return component.line_total_php
    return _package_line_total_at_tier(package, qty, tier)


def sum_component_lines_at_tier(
    components: tuple[DesignComponent, ...],
    tier: PriceTier,
    *,
    catalog: SolarCatalog | None = None,
) -> float:
    cat = catalog or load_catalog()
    return round(
        sum(_line_total_at_tier(component, tier, cat) for component in components),
        2,
    )
