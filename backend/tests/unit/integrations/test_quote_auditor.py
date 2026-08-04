# Defines quote auditor extraction unit tests.

from app.integrations.ai.quote_auditor import (
    merge_quote_facts,
    regex_extract_quote_facts,
    regex_extract_quote_lines,
    resolve_panel_count,
    resolve_quote_total_php,
)


def test_regex_extracts_grand_total_quote() -> None:
    text = """
    Quotation 8371
    1 Solar Panels Aiko 655 12 29475 353,700
    7 Lithium Battery Sunwoda 1 230000 230,000
    Grand Total 1,165,700
    """
    facts = regex_extract_quote_facts(text)
    assert facts["total_php"] == 1_165_700
    assert facts["panel_count"] == 12
    lines = regex_extract_quote_lines(text)
    assert any(line.get("slot") == "panel" for line in lines)
    assert any(line.get("slot") == "battery" for line in lines)


def test_regex_extracts_total_bill_and_wattage() -> None:
    text = """
    Solar Panel Jinko 645 Watts
    Installation Labour 645 x 6 = 3,870 Watts
    Total Bill: PKR 415,355
    """
    facts = regex_extract_quote_facts(text)
    assert facts["total_php"] == 415_355
    assert facts["system_kwp"] == 3.87
    assert facts["panel_count"] == 6


def test_merge_quote_facts_prefers_primary_and_fills_gaps() -> None:
    merged = merge_quote_facts(
        {"total_php": None, "system_kwp": 5.5, "panel_count": None},
        {"total_php": 440_000.0, "system_kwp": 5.2, "panel_count": 12},
    )
    assert merged["total_php"] == 440_000.0
    assert merged["system_kwp"] == 5.5
    assert merged["panel_count"] == 12


def test_merge_quote_facts_rejects_implausible_ai_total() -> None:
    merged = merge_quote_facts(
        {"total_php": 1.0, "system_kwp": None, "panel_count": None},
        {"total_php": 1_165_700.0, "system_kwp": 7.86, "panel_count": 12},
    )
    assert merged["total_php"] == 1_165_700.0


def test_merge_quote_facts_drops_implausible_totals_without_fallback() -> None:
    merged = merge_quote_facts(
        {"total_php": 1.0, "system_kwp": None, "panel_count": None},
        {"total_php": None, "system_kwp": None, "panel_count": None},
    )
    assert merged["total_php"] is None


def test_merge_quote_facts_prefers_regex_total_over_bad_ai() -> None:
    merged = merge_quote_facts(
        {"total_php": 1_165_700.0, "system_kwp": 5.0, "panel_count": 12},
        {"total_php": 500_000.0, "system_kwp": 5.0, "panel_count": 1},
    )
    assert merged["total_php"] == 1_165_700.0
    assert merged["panel_count"] == 12


def test_resolve_quote_total_prefers_grand_total_when_lines_are_partial() -> None:
    text = "Grand Total 1,165,700"
    total = resolve_quote_total_php(
        {"total_php": 1_165_700.0},
        [{"line_total_php": 353_700.0}, {"line_total_php": 230_000.0}],
        document_text=text,
    )
    assert total == 1_165_700.0


def test_resolve_quote_total_falls_back_to_line_sum() -> None:
    total = resolve_quote_total_php(
        {"total_php": 1.0},
        [
            {"line_total_php": 353_700.0},
            {"line_total_php": 260_000.0},
            {"line_total_php": 130_000.0},
            {"line_total_php": 230_000.0},
        ],
    )
    assert total == 973_700.0


def test_merge_quote_facts_rejects_implausible_panel_count() -> None:
    merged = merge_quote_facts(
        {"total_php": None, "system_kwp": 5.0, "panel_count": 1},
        {"total_php": None, "system_kwp": 5.0, "panel_count": None},
    )
    assert merged["panel_count"] is None


def test_resolve_panel_count_rejects_single_panel_for_five_kwp() -> None:
    count = resolve_panel_count(
        {"system_kwp": 5.0, "panel_count": 1},
        [{"slot": "inverter", "qty": 1, "line_total_php": 260_000.0}],
    )
    assert count == 9


def test_resolve_panel_count_prefers_panel_line_quantity() -> None:
    count = resolve_panel_count(
        {"system_kwp": 5.0, "panel_count": 1},
        [{"slot": "panel", "qty": 11, "line_total_php": 350_000.0}],
    )
    assert count == 11


def test_resolve_quote_total_falls_back_to_component_sum() -> None:
    class _Component:
        def __init__(self, line_total_php: float) -> None:
            self.line_total_php = line_total_php

    total = resolve_quote_total_php(
        {"total_php": None},
        [],
        (_Component(353_700.0), _Component(260_000.0)),
    )
    assert total == 613_700.0
