# Defines quote audit domain unit tests.

from app.features.design.quote_audit import (
    _derive_pros_cons,
    _derive_verdict,
    _missing_bos_findings,
    _pricing_findings,
    _questions_for_installer,
)
from app.features.design.schemas import (
    DesignBuildSchema,
    DesignComponentSchema,
    QuoteAuditFindingSchema,
)


def _component(
    slot: str,
    *,
    brand: str = "Brand",
    model: str = "Model",
    catalog_id: str | None = None,
    line_total: float = 100_000,
    qty: float = 1,
) -> DesignComponentSchema:
    return DesignComponentSchema(
        slot=slot,  # type: ignore[arg-type]
        catalog_id=catalog_id,
        brand=brand,
        model=model,
        summary=f"{brand} {model}",
        qty=qty,
        unit="pcs",
        unit_price_php=line_total / qty,
        line_total_php=line_total,
        warranty_note="test",
    )


def _benchmark(**overrides: object) -> DesignBuildSchema:
    base = {
        "id": "bench-1",
        "label": "AI suggested",
        "tags": ("AI",),
        "combo_id": "combo-1",
        "solve_id": "solve-1",
        "system_kwp": 5.0,
        "panel_count": 10,
        "inverter_kw": 5.0,
        "battery_kwh": None,
        "monthly_savings_php": 3000.0,
        "annual_savings_php": 36000.0,
        "payback_years": 6.0,
        "total_investment_php": 400_000.0,
        "total_investment_low_php": 380_000.0,
        "total_investment_high_php": 420_000.0,
        "subtotal_php": 357_143.0,
        "vat_php": 42_857.0,
        "inverter_utilisation_pct": 85.0,
        "fit_score": 88.0,
        "co2_tonnes_avoided_yearly": 2.5,
        "insight": "Solid build",
        "components": (
            _component("panel", brand="Jinko", model="Tiger", catalog_id="panel-jinko"),
            _component("inverter", brand="Huawei", model="SUN2000", catalog_id="inv-huawei"),
            _component("protection", line_total=15_000),
            _component("installation", line_total=40_000),
        ),
        "source": "ai_suggested",
    }
    base.update(overrides)
    return DesignBuildSchema(**base)  # type: ignore[arg-type]


def test_pricing_findings_flags_quote_above_benchmark() -> None:
    benchmark = _benchmark()
    findings = _pricing_findings(
        extracted={"total_php": 450_000.0, "system_kwp": 5.0, "panel_count": 10},
        benchmark=benchmark,
    )
    assert any(finding.severity == "warning" for finding in findings)
    assert any("higher than" in finding.message for finding in findings)


def test_missing_bos_findings_flags_missing_scope() -> None:
    benchmark = _benchmark()
    quote_components = (
        _component("panel"),
        _component("inverter"),
    )
    findings = _missing_bos_findings(
        benchmark=benchmark,
        quote_components=quote_components,
    )
    assert any(finding.category == "scope" for finding in findings)
    assert any(finding.severity == "warning" for finding in findings)


def test_derive_pros_cons_splits_findings() -> None:
    findings = (
        QuoteAuditFindingSchema(
            category="pricing",
            severity="positive",
            message="Below benchmark",
        ),
        QuoteAuditFindingSchema(
            category="scope",
            severity="warning",
            message="Missing labour line",
        ),
    )
    pros, cons = _derive_pros_cons(findings)
    assert pros == ("Below benchmark",)
    assert cons == ("Missing labour line",)


def test_questions_for_installer_includes_scope_prompt() -> None:
    findings = (
        QuoteAuditFindingSchema(
            category="scope",
            severity="warning",
            message="Missing protection",
        ),
    )
    questions = _questions_for_installer(
        findings,
        extracted={"total_php": 450_000.0},
        benchmark=_benchmark(),
    )
    assert any("wiring" in question.lower() or "mounting" in question.lower() for question in questions)


def test_derive_verdict_needs_review_for_compatibility_warning() -> None:
    findings = (
        QuoteAuditFindingSchema(
            category="compatibility",
            severity="warning",
            message="Incompatible",
        ),
    )
    assert _derive_verdict(findings) == "needs_review"
