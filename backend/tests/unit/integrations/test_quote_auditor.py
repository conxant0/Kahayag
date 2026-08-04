# Defines quote auditor extraction unit tests.

from app.integrations.ai.quote_auditor import (
    merge_quote_facts,
    regex_extract_quote_facts,
    regex_extract_quote_lines,
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
