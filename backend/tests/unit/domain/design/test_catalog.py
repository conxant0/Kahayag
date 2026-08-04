# Defines catalog loader unit tests.

from app.domain.design.catalog import get_panel, load_catalog


def test_load_catalog_has_core_categories() -> None:
    catalog = load_catalog()
    assert len(catalog.panels) >= 5
    assert len(catalog.inverters) >= 5
    assert len(catalog.batteries) >= 3
    assert len(catalog.protections) >= 1
    assert len(catalog.mounting_kits) >= 1
    assert len(catalog.cabling) >= 1
    assert catalog.schema_version


def test_panel_has_required_fields_and_price_as_of() -> None:
    catalog = load_catalog()
    panel = get_panel("panel_001", catalog)
    assert panel.brand
    assert panel.wattage_w > 0
    assert panel.price_php.as_of == "2026-07-01"
    assert panel.price_php.min <= panel.price_php.mid <= panel.price_php.max
