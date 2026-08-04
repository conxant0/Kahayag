# Defines quote diagram assembly unit tests.

from app.features.design.quote_diagram import build_quote_diagram_components


def test_build_quote_diagram_from_table_rows() -> None:
    text_lines = [
        {
            "slot": "panel",
            "brand": "Aiko",
            "model": "655",
            "qty": 12,
            "unit": "pcs",
            "line_total_php": 353_700.0,
            "summary": "Solar Panels Aiko 655",
        },
        {
            "slot": "battery",
            "brand": "Sunwoda",
            "model": "Battery",
            "qty": 1,
            "unit": "pcs",
            "line_total_php": 230_000.0,
            "summary": "Lithium Battery Sunwoda",
        },
    ]
    components = build_quote_diagram_components(
        extracted={"total_php": 1_165_700, "system_kwp": 7.86, "panel_count": 12},
        raw_lines=text_lines,
    )

    slots = [component.slot for component in components]
    assert slots[0] == "panel"
    assert slots[1] == "inverter"
    assert "battery" in slots
    assert components[0].qty == 12
    assert components[0].badges == ("FROM QUOTE",)


def test_build_quote_diagram_falls_back_to_extracted_capacity() -> None:
    components = build_quote_diagram_components(
        extracted={"total_php": 415_355, "system_kwp": 3.87, "panel_count": 6},
        raw_lines=[],
    )

    assert len(components) >= 2
    panel = next(component for component in components if component.slot == "panel")
    inverter = next(component for component in components if component.slot == "inverter")

    assert panel.qty == 6
    assert panel.specs.get("wattage_w") == 645
    assert inverter.slot == "inverter"
    assert all(component.slot != "battery" for component in components)
