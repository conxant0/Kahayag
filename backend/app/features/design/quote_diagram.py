# Defines uploaded-quote line items mapped into diagram component shapes.

from dataclasses import dataclass
from typing import Literal

from app.domain.design.bom import (
    _component_from_battery,
    _component_from_inverter,
    _component_from_panel,
)
from app.domain.design.catalog import (
    SolarCatalog,
    load_catalog,
)
from app.domain.design.entities import ComponentSlot, DesignComponent
from app.features.design.schemas import DesignComponentSchema

QuoteLineSlot = Literal[
    "panel",
    "inverter",
    "battery",
    "protection",
    "structure",
    "electrical",
    "installation",
]

_SLOT_KEYWORDS: tuple[tuple[QuoteLineSlot, tuple[str, ...]], ...] = (
    ("panel", ("panel", "module", "pv module", "solar panel")),
    ("inverter", ("inverter", "hybrid inverter", "microinverter", "power converter")),
    ("battery", ("battery", "lithium", "storage", "ess", "powerwall")),
    ("structure", ("mount", "rail", "structure", "roof hook", "clamping")),
    ("electrical", ("cable", "wire", "conduit", "dc cable", "ac cable", "connector")),
    ("protection", ("breaker", "spd", "surge", "protection", "mcb", "fuse", "disconnect")),
    ("installation", ("install", "labour", "labor", "permit", "commission", "net meter")),
)


@dataclass(frozen=True)
class ExtractedQuoteLine:
    slot: QuoteLineSlot
    brand: str
    model: str
    summary: str
    qty: float
    unit: str
    line_total_php: float | None


def classify_quote_line(description: str) -> QuoteLineSlot:
    lowered = description.lower()
    for slot, keywords in _SLOT_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return slot
    return "installation"


def _parse_quote_line(raw: dict[str, object]) -> ExtractedQuoteLine | None:
    slot_value = raw.get("slot")
    if not isinstance(slot_value, str):
        return None
    slot = slot_value.strip().lower()
    if slot not in {
        "panel",
        "inverter",
        "battery",
        "protection",
        "structure",
        "electrical",
        "installation",
    }:
        slot = classify_quote_line(str(raw.get("summary") or raw.get("model") or ""))

    brand = str(raw.get("brand") or "Quoted").strip() or "Quoted"
    model = str(raw.get("model") or "—").strip() or "—"
    summary = str(raw.get("summary") or f"{brand} {model}").strip()
    qty_raw = raw.get("qty")
    qty = float(qty_raw) if isinstance(qty_raw, (int, float)) and qty_raw > 0 else 1.0
    unit = str(raw.get("unit") or "pcs").strip() or "pcs"
    total_raw = raw.get("line_total_php")
    line_total = float(total_raw) if isinstance(total_raw, (int, float)) else None
    return ExtractedQuoteLine(
        slot=slot,  # type: ignore[arg-type]
        brand=brand,
        model=model,
        summary=summary,
        qty=qty,
        unit=unit,
        line_total_php=line_total,
    )


def parse_extracted_quote_lines(raw_lines: list[dict[str, object]]) -> tuple[ExtractedQuoteLine, ...]:
    parsed: list[ExtractedQuoteLine] = []
    for raw in raw_lines:
        line = _parse_quote_line(raw)
        if line is not None:
            parsed.append(line)
    return tuple(parsed)


def _catalog_panel_match(
    line: ExtractedQuoteLine,
    catalog: SolarCatalog,
) -> DesignComponent | None:
    brand_lower = line.brand.lower()
    model_lower = line.model.lower()
    for panel in catalog.panels.values():
        if panel.brand.lower() == brand_lower and (
            model_lower in panel.model.lower() or panel.model.lower() in model_lower
        ):
            qty = int(line.qty) if line.qty >= 1 else 1
            return _component_from_panel(panel, qty, badges=("FROM QUOTE",))
    for panel in catalog.panels.values():
        combined = f"{panel.brand} {panel.model}".lower()
        if brand_lower in combined or model_lower in combined:
            qty = int(line.qty) if line.qty >= 1 else 1
            return _component_from_panel(panel, qty, badges=("FROM QUOTE",))
    return None


def _catalog_inverter_match(
    line: ExtractedQuoteLine,
    catalog: SolarCatalog,
) -> DesignComponent | None:
    brand_lower = line.brand.lower()
    model_lower = line.model.lower()
    for inverter in catalog.inverters.values():
        if inverter.brand.lower() == brand_lower and (
            model_lower in inverter.model.lower() or inverter.model.lower() in model_lower
        ):
            return _component_from_inverter(
                inverter,
                badges=("FROM QUOTE",),
                qty=int(line.qty) if line.qty >= 1 else 1,
            )
    for inverter in catalog.inverters.values():
        combined = f"{inverter.brand} {inverter.model}".lower()
        if brand_lower in combined or model_lower in combined:
            return _component_from_inverter(
                inverter,
                badges=("FROM QUOTE",),
                qty=int(line.qty) if line.qty >= 1 else 1,
            )
    return None


def _catalog_battery_match(
    line: ExtractedQuoteLine,
    catalog: SolarCatalog,
) -> DesignComponent | None:
    brand_lower = line.brand.lower()
    model_lower = line.model.lower()
    for battery in catalog.batteries.values():
        if battery.brand.lower() == brand_lower and (
            model_lower in battery.model.lower() or battery.model.lower() in model_lower
        ):
            return _component_from_battery(battery, badges=("FROM QUOTE",))
    for battery in catalog.batteries.values():
        combined = f"{battery.brand} {battery.model}".lower()
        if brand_lower in combined or model_lower in combined:
            return _component_from_battery(battery, badges=("FROM QUOTE",))
    return None


def _placeholder_component(line: ExtractedQuoteLine) -> DesignComponent:
    unit_price = 0.0
    line_total = line.line_total_php or 0.0
    if line.line_total_php is not None and line.qty > 0:
        unit_price = round(line.line_total_php / line.qty, 2)
    return DesignComponent(
        slot=line.slot,
        catalog_id=None,
        brand=line.brand,
        model=line.model,
        summary=line.summary,
        qty=line.qty,
        unit=line.unit,
        unit_price_php=unit_price,
        price_as_of=None,
        line_total_php=line_total,
        warranty_note="From uploaded quote",
        badges=("FROM QUOTE",),
        specs={},
    )


def _line_to_component(line: ExtractedQuoteLine, catalog: SolarCatalog) -> DesignComponent:
    if line.slot == "panel":
        matched = _catalog_panel_match(line, catalog)
    elif line.slot == "inverter":
        matched = _catalog_inverter_match(line, catalog)
    elif line.slot == "battery":
        matched = _catalog_battery_match(line, catalog)
    else:
        matched = None

    if matched is not None:
        if line.line_total_php is not None:
            return DesignComponent(
                slot=matched.slot,
                catalog_id=matched.catalog_id,
                brand=matched.brand,
                model=matched.model,
                summary=matched.summary,
                qty=matched.qty,
                unit=matched.unit,
                unit_price_php=round(line.line_total_php / matched.qty, 2)
                if matched.qty > 0
                else matched.unit_price_php,
                price_as_of=matched.price_as_of,
                line_total_php=line.line_total_php,
                warranty_note=matched.warranty_note,
                badges=matched.badges,
                specs=matched.specs,
                product_image=matched.product_image,
            )
        return matched
    return _placeholder_component(line)


def _fallback_panel(
    *,
    panel_count: int | None,
    system_kwp: float | None,
    catalog: SolarCatalog,
) -> DesignComponent | None:
    if not isinstance(panel_count, int) or panel_count <= 0:
        return None
    default_panel = next(iter(catalog.panels.values()))
    component = _component_from_panel(default_panel, panel_count, badges=("FROM QUOTE",))
    if isinstance(system_kwp, (int, float)) and system_kwp > 0:
        wattage = round(system_kwp * 1000 / panel_count)
        return DesignComponent(
            slot=component.slot,
            catalog_id=None,
            brand="Quoted",
            model=f"{panel_count} panels",
            summary=f"{system_kwp:.2f} kWp quoted array",
            qty=panel_count,
            unit="pcs",
            unit_price_php=0.0,
            price_as_of=None,
            line_total_php=0.0,
            warranty_note="From uploaded quote",
            badges=("FROM QUOTE",),
            specs={"wattage_w": wattage},
        )
    return component


def _fallback_inverter(
    *,
    system_kwp: float | None,
    catalog: SolarCatalog,
) -> DesignComponent | None:
    if not isinstance(system_kwp, (int, float)) or system_kwp <= 0:
        return None
    target_w = int(system_kwp * 1000)
    candidates = sorted(
        catalog.inverters.values(),
        key=lambda inv: abs(inv.rated_ac_output_w - target_w),
    )
    if not candidates:
        return None
    inverter = candidates[0]
    return _component_from_inverter(inverter, badges=("FROM QUOTE",))


def build_quote_diagram_components(
    *,
    extracted: dict[str, float | int | None],
    raw_lines: list[dict[str, object]],
    catalog: SolarCatalog | None = None,
) -> tuple[DesignComponent, ...]:
    cat = catalog or load_catalog()
    lines = parse_extracted_quote_lines(raw_lines)
    primary: dict[ComponentSlot, DesignComponent] = {}
    bos: list[DesignComponent] = []

    for line in lines:
        component = _line_to_component(line, cat)
        if component.slot in {"panel", "inverter", "battery"}:
            primary[component.slot] = component
        else:
            bos.append(component)

    panel_count = extracted.get("panel_count")
    system_kwp = extracted.get("system_kwp")
    if "panel" not in primary:
        fallback = _fallback_panel(
            panel_count=int(panel_count) if isinstance(panel_count, int) else None,
            system_kwp=float(system_kwp) if isinstance(system_kwp, (int, float)) else None,
            catalog=cat,
        )
        if fallback is not None:
            primary["panel"] = fallback

    if "inverter" not in primary:
        fallback = _fallback_inverter(
            system_kwp=float(system_kwp) if isinstance(system_kwp, (int, float)) else None,
            catalog=cat,
        )
        if fallback is not None:
            primary["inverter"] = fallback

    primary_slots: tuple[ComponentSlot, ...] = ("panel", "inverter", "battery")
    components: list[DesignComponent] = []
    for slot in primary_slots:
        component = primary.get(slot)
        if component is None:
            continue
        if slot == "battery" and component.qty <= 0:
            continue
        components.append(component)

    slot_order: tuple[ComponentSlot, ...] = (
        "protection",
        "structure",
        "electrical",
        "installation",
    )
    for slot in slot_order:
        components.extend(
            sorted(
                (component for component in bos if component.slot == slot),
                key=lambda item: item.summary,
            ),
        )

    return tuple(components)


def to_component_schema(component: DesignComponent) -> DesignComponentSchema:
    return DesignComponentSchema(
        slot=component.slot,
        catalog_id=component.catalog_id,
        brand=component.brand,
        model=component.model,
        summary=component.summary,
        qty=component.qty,
        unit=component.unit,
        unit_price_php=component.unit_price_php,
        price_as_of=component.price_as_of,
        line_total_php=component.line_total_php,
        warranty_note=component.warranty_note,
        badges=component.badges,
        specs=component.specs,
        product_image=component.product_image,
    )
