# Defines typed loaders for the solar components catalog JSON runtime.

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parents[2] / "data" / "solar_components_catalog.json"


@dataclass(frozen=True)
class CatalogPrice:
    min: float
    max: float
    as_of: str

    @property
    def mid(self) -> float:
        return (self.min + self.max) / 2


@dataclass(frozen=True)
class CatalogPanel:
    id: str
    brand: str
    model: str
    wattage_w: int
    voc_v: float
    vmp_v: float
    imp_a: float
    efficiency_pct: float
    dimensions_mm: dict[str, int]
    weight_kg: float
    price_php: CatalogPrice
    certified_compatible_inverters: tuple[str, ...]
    warranty_product_years: int
    product_image: str | None = None


@dataclass(frozen=True)
class CatalogInverter:
    id: str
    brand: str
    model: str
    rated_ac_output_w: int
    max_dc_input_w: int
    mppt_count: int
    mppt_voltage_min_v: float
    mppt_voltage_max_v: float
    max_input_current_per_mppt_a: float
    battery_compatible: bool
    certified_batteries: tuple[str, ...]
    price_php: CatalogPrice
    warranty_years: int
    product_image: str | None = None


@dataclass(frozen=True)
class CatalogBattery:
    id: str
    brand: str
    model: str
    usable_capacity_kwh: float
    max_charge_rate_kw: float
    max_discharge_rate_kw: float
    price_php: CatalogPrice
    warranty_years: int
    recommended_inverter_brands: tuple[str, ...]
    product_image: str | None = None


@dataclass(frozen=True)
class CatalogPackage:
    id: str
    brand: str
    model: str
    category: str
    description: str
    unit: str
    price_php: CatalogPrice | None = None
    price_php_per_kwp: CatalogPrice | None = None
    warranty_years: int = 0
    product_image: str | None = None


@dataclass(frozen=True)
class SolarCatalog:
    panels: dict[str, CatalogPanel]
    inverters: dict[str, CatalogInverter]
    batteries: dict[str, CatalogBattery]
    protections: dict[str, CatalogPackage]
    mounting_kits: dict[str, CatalogPackage]
    cabling: dict[str, CatalogPackage]
    misc_bom_items: dict[str, CatalogPackage]
    schema_version: str
    catalog_metadata: dict[str, str]


def _parse_price(raw: dict[str, Any]) -> CatalogPrice:
    return CatalogPrice(
        min=float(raw["min"]),
        max=float(raw["max"]),
        as_of=str(raw["as_of"]),
    )


def _parse_panel(raw: dict[str, Any]) -> CatalogPanel:
    warranty = raw.get("warranty", {})
    return CatalogPanel(
        id=str(raw["id"]),
        brand=str(raw["brand"]),
        model=str(raw["model"]),
        wattage_w=int(raw["wattage_w"]),
        voc_v=float(raw["voc_v"]),
        vmp_v=float(raw["vmp_v"]),
        imp_a=float(raw["imp_a"]),
        efficiency_pct=float(raw["efficiency_pct"]),
        dimensions_mm=dict(raw["dimensions_mm"]),
        weight_kg=float(raw["weight_kg"]),
        price_php=_parse_price(raw["price_php"]),
        certified_compatible_inverters=tuple(raw.get("certified_compatible_inverters", [])),
        warranty_product_years=int(warranty.get("product_years", 0)),
        product_image=raw.get("product_image"),
    )


def _parse_inverter(raw: dict[str, Any]) -> CatalogInverter:
    mppt_range = raw["mppt_voltage_range_v"]
    warranty = raw.get("warranty", {})
    return CatalogInverter(
        id=str(raw["id"]),
        brand=str(raw["brand"]),
        model=str(raw["model"]),
        rated_ac_output_w=int(raw["rated_ac_output_w"]),
        max_dc_input_w=int(raw["max_dc_input_w"]),
        mppt_count=int(raw["mppt_count"]),
        mppt_voltage_min_v=float(mppt_range["min"]),
        mppt_voltage_max_v=float(mppt_range["max"]),
        max_input_current_per_mppt_a=float(raw["max_input_current_per_mppt_a"]),
        battery_compatible=bool(raw.get("battery_compatible", False)),
        certified_batteries=tuple(raw.get("certified_batteries", [])),
        price_php=_parse_price(raw["price_php"]),
        warranty_years=int(warranty.get("years", 0)),
        product_image=raw.get("product_image"),
    )


def _parse_battery(raw: dict[str, Any]) -> CatalogBattery:
    warranty = raw.get("warranty", {})
    return CatalogBattery(
        id=str(raw["id"]),
        brand=str(raw["brand"]),
        model=str(raw["model"]),
        usable_capacity_kwh=float(raw["usable_capacity_kwh"]),
        max_charge_rate_kw=float(raw["max_charge_rate_kw"]),
        max_discharge_rate_kw=float(raw["max_discharge_rate_kw"]),
        price_php=_parse_price(raw["price_php"]),
        warranty_years=int(warranty.get("years", 0)),
        recommended_inverter_brands=tuple(raw.get("recommended_inverter_brands", [])),
        product_image=raw.get("product_image"),
    )


def _parse_package(raw: dict[str, Any]) -> CatalogPackage:
    warranty = raw.get("warranty", {})
    price = raw.get("price_php")
    price_per_kwp = raw.get("price_php_per_kwp")
    return CatalogPackage(
        id=str(raw["id"]),
        brand=str(raw["brand"]),
        model=str(raw["model"]),
        category=str(raw.get("category", "")),
        description=str(raw.get("description", raw.get("model", ""))),
        unit=str(raw.get("unit", "lot")),
        price_php=_parse_price(price) if price else None,
        price_php_per_kwp=_parse_price(price_per_kwp) if price_per_kwp else None,
        warranty_years=int(warranty.get("years", 0)),
        product_image=raw.get("product_image"),
    )


def _load_raw_catalog() -> dict[str, Any]:
    import json

    return json.loads(CATALOG_PATH.read_text())


@lru_cache(maxsize=1)
def load_catalog() -> SolarCatalog:
    raw = _load_raw_catalog()
    return SolarCatalog(
        panels={item["id"]: _parse_panel(item) for item in raw["panels"]},
        inverters={item["id"]: _parse_inverter(item) for item in raw["inverters"]},
        batteries={item["id"]: _parse_battery(item) for item in raw["batteries"]},
        protections={
            item["id"]: _parse_package(item) for item in raw.get("protections", [])
        },
        mounting_kits={
            item["id"]: _parse_package(item) for item in raw.get("mounting_kits", [])
        },
        cabling={item["id"]: _parse_package(item) for item in raw.get("cabling", [])},
        misc_bom_items={
            item["id"]: _parse_package(item) for item in raw.get("misc_bom_items", [])
        },
        schema_version=str(raw.get("schema_version", "1.0")),
        catalog_metadata=dict(raw.get("catalog_metadata", {})),
    )


def get_panel(panel_id: str, catalog: SolarCatalog | None = None) -> CatalogPanel:
    cat = catalog or load_catalog()
    if panel_id not in cat.panels:
        raise KeyError(f"Unknown panel id: {panel_id}")
    return cat.panels[panel_id]


def get_inverter(
    inverter_id: str, catalog: SolarCatalog | None = None
) -> CatalogInverter:
    cat = catalog or load_catalog()
    if inverter_id not in cat.inverters:
        raise KeyError(f"Unknown inverter id: {inverter_id}")
    return cat.inverters[inverter_id]


def get_battery(
    battery_id: str, catalog: SolarCatalog | None = None
) -> CatalogBattery:
    cat = catalog or load_catalog()
    if battery_id not in cat.batteries:
        raise KeyError(f"Unknown battery id: {battery_id}")
    return cat.batteries[battery_id]


def filter_panels(
    *,
    catalog: SolarCatalog | None = None,
    min_wattage_w: int | None = None,
    brand: str | None = None,
) -> list[CatalogPanel]:
    cat = catalog or load_catalog()
    results = list(cat.panels.values())
    if min_wattage_w is not None:
        results = [panel for panel in results if panel.wattage_w >= min_wattage_w]
    if brand is not None:
        results = [panel for panel in results if panel.brand.lower() == brand.lower()]
    return results


def filter_inverters(
    *,
    catalog: SolarCatalog | None = None,
    battery_compatible: bool | None = None,
    min_ac_w: int | None = None,
) -> list[CatalogInverter]:
    cat = catalog or load_catalog()
    results = list(cat.inverters.values())
    if battery_compatible is not None:
        results = [
            inv for inv in results if inv.battery_compatible == battery_compatible
        ]
    if min_ac_w is not None:
        results = [inv for inv in results if inv.rated_ac_output_w >= min_ac_w]
    return results
