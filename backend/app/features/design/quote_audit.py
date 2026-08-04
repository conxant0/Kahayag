# Defines uploaded-quote extraction and benchmark comparison for the compare page.

from app.domain.design.catalog import (
    SolarCatalog,
    get_battery,
    get_inverter,
    get_panel,
    load_catalog,
)
from app.domain.design.entities import SolverConstraints
from app.domain.design.rejection import humanize_catalog_rejection
from app.domain.design.solver import _evaluate_combo
from app.features.design.quote_diagram import (
    build_quote_diagram_components,
    to_component_schema,
)
from app.features.design.schemas import (
    DesignBuildSchema,
    DesignComponentSchema,
    DesignSessionSchema,
    QuoteAuditFindingSchema,
    QuoteAuditResponseSchema,
    QuoteAuditVerdict,
    SolverConstraintsSchema,
)
from app.integrations.ai.quote_auditor import (
    QuoteAuditorClient,
    resolve_panel_count,
    resolve_quote_total_php,
)
from app.integrations.quote_parsing.document_reader import (
    QuoteImageTranscriber,
    read_quote_document,
)

QuoteAuditVerdictValue = QuoteAuditVerdict

_PRIMARY_SLOTS = ("panel", "inverter", "battery")
_BOS_SLOTS = ("protection", "structure", "electrical", "installation")
_LINE_INFLATION_THRESHOLD = 0.25
_COST_PER_WATT_WARNING_THRESHOLD = 0.15
_UNREADABLE_PHRASE = "couldn't read a clear price"

_PART_LABELS = {
    "panel": "solar panels",
    "inverter": "inverter",
    "battery": "home battery",
}
_SCOPE_LABELS = {
    "protection": "safety switches and surge protection",
    "structure": "roof mounting hardware",
    "electrical": "wiring and cables",
    "installation": "labour and setup",
}


def _part_label(slot: str) -> str:
    return _PART_LABELS.get(slot, slot.replace("_", " "))


def _system_size_phrase(kwp: float, panel_count: int | None = None) -> str:
    size = f"{kwp:.1f} kW solar system"
    if isinstance(panel_count, int) and panel_count > 0:
        return f"{size} ({panel_count} panels)"
    return size


def _expected_price_phrase(benchmark: DesignBuildSchema) -> str:
    return (
        f"what we'd expect for your roof — "
        f"{_system_size_phrase(benchmark.system_kwp, benchmark.panel_count)}, "
        f"around ₱{benchmark.total_investment_php:,.0f}"
    )


def _component_by_slot(
    components: tuple[DesignComponentSchema, ...],
    slot: str,
) -> DesignComponentSchema | None:
    return next((component for component in components if component.slot == slot), None)


def _slots_present(components: tuple[DesignComponentSchema, ...]) -> set[str]:
    return {component.slot for component in components}


def _pricing_findings(
    *,
    extracted: dict[str, float | int | None],
    benchmark: DesignBuildSchema,
) -> list[QuoteAuditFindingSchema]:
    findings: list[QuoteAuditFindingSchema] = []
    extracted_total = extracted.get("total_php")
    if isinstance(extracted_total, (int, float)):
        delta = float(extracted_total) - benchmark.total_investment_php
        pct = (
            (delta / benchmark.total_investment_php) * 100
            if benchmark.total_investment_php
            else 0.0
        )
        severity = "warning" if delta > 0 else "positive" if delta < 0 else "info"
        if delta == 0:
            price_message = (
                f"This quote totals ₱{extracted_total:,.0f} — about the same as "
                f"{_expected_price_phrase(benchmark)}."
            )
        elif delta > 0:
            price_message = (
                f"This quote totals ₱{extracted_total:,.0f} — "
                f"₱{abs(delta):,.0f} higher than {_expected_price_phrase(benchmark)} "
                f"({pct:+.1f}%)."
            )
        else:
            price_message = (
                f"This quote totals ₱{extracted_total:,.0f} — "
                f"₱{abs(delta):,.0f} lower than {_expected_price_phrase(benchmark)} "
                f"({pct:+.1f}%)."
            )
        findings.append(
            QuoteAuditFindingSchema(
                category="pricing",
                severity=severity,
                message=price_message,
            ),
        )

        extracted_kwp = extracted.get("system_kwp")
        if (
            isinstance(extracted_kwp, (int, float))
            and extracted_kwp > 0
            and benchmark.system_kwp > 0
        ):
            quote_cpw = extracted_total / (extracted_kwp * 1000)
            bench_cpw = benchmark.total_investment_php / (benchmark.system_kwp * 1000)
            cpw_delta = (quote_cpw - bench_cpw) / bench_cpw
            if cpw_delta >= _COST_PER_WATT_WARNING_THRESHOLD:
                findings.append(
                    QuoteAuditFindingSchema(
                        category="pricing",
                        severity="warning",
                        message=(
                            f"You're paying about ₱{quote_cpw:,.0f} per watt of solar — "
                            f"roughly {cpw_delta * 100:.0f}% more than the typical "
                            f"₱{bench_cpw:,.0f}/W for a system this size."
                        ),
                    ),
                )
            elif cpw_delta <= -_COST_PER_WATT_WARNING_THRESHOLD:
                findings.append(
                    QuoteAuditFindingSchema(
                        category="pricing",
                        severity="positive",
                        message=(
                            f"You're paying about ₱{quote_cpw:,.0f} per watt of solar — "
                            f"roughly {abs(cpw_delta) * 100:.0f}% less than the typical "
                            f"₱{bench_cpw:,.0f}/W for a system this size."
                        ),
                    ),
                )

    extracted_kwp = extracted.get("system_kwp")
    if isinstance(extracted_kwp, (int, float)):
        delta_kwp = float(extracted_kwp) - benchmark.system_kwp
        severity = "info" if abs(delta_kwp) <= 0.3 else "warning"
        if abs(delta_kwp) <= 0.3:
            size_message = (
                f"The quoted system size ({extracted_kwp:.1f} kW) is close to what "
                f"we'd recommend for your roof ({benchmark.system_kwp:.1f} kW)."
            )
        elif delta_kwp > 0:
            size_message = (
                f"The quote is for a larger system ({extracted_kwp:.1f} kW) than we'd "
                f"recommend ({benchmark.system_kwp:.1f} kW)."
            )
        else:
            size_message = (
                f"The quote is for a smaller system ({extracted_kwp:.1f} kW) than we'd "
                f"recommend ({benchmark.system_kwp:.1f} kW)."
            )
        findings.append(
            QuoteAuditFindingSchema(
                category="capacity",
                severity=severity,
                message=size_message,
            ),
        )

    extracted_panels = extracted.get("panel_count")
    if isinstance(extracted_panels, int):
        delta_panels = extracted_panels - benchmark.panel_count
        severity = "info" if abs(delta_panels) <= 2 else "warning"
        if abs(delta_panels) <= 2:
            panel_message = (
                f"The quote lists {extracted_panels} solar panels — close to the "
                f"{benchmark.panel_count} we'd expect for your roof."
            )
        elif delta_panels > 0:
            panel_message = (
                f"The quote lists {extracted_panels} solar panels — "
                f"{delta_panels} more than the {benchmark.panel_count} we'd expect."
            )
        else:
            panel_message = (
                f"The quote lists {extracted_panels} solar panels — "
                f"{abs(delta_panels)} fewer than the {benchmark.panel_count} we'd expect."
            )
        findings.append(
            QuoteAuditFindingSchema(
                category="equipment",
                severity=severity,
                message=panel_message,
            ),
        )

    if not findings:
        findings.append(
            QuoteAuditFindingSchema(
                category="pricing",
                severity="info",
                message=(
                    f"We couldn't read a clear price or system size from this upload. "
                    f"For your roof we'd expect "
                    f"{_system_size_phrase(benchmark.system_kwp, benchmark.panel_count)} "
                    f"at around ₱{benchmark.total_investment_php:,.0f}."
                ),
            ),
        )
    return findings


def _component_diff_findings(
    *,
    benchmark: DesignBuildSchema,
    quote_components: tuple[DesignComponentSchema, ...],
) -> list[QuoteAuditFindingSchema]:
    findings: list[QuoteAuditFindingSchema] = []
    for slot in _PRIMARY_SLOTS:
        bench_component = _component_by_slot(benchmark.components, slot)
        quote_component = _component_by_slot(quote_components, slot)

        if bench_component is None:
            continue

        bench_label = f"{bench_component.brand} {bench_component.model}".strip()
        if quote_component is None:
            if slot == "battery" and (bench_component.qty <= 0 or bench_component.line_total_php <= 0):
                continue
            findings.append(
                QuoteAuditFindingSchema(
                    category="equipment",
                    severity="warning",
                    message=(
                        f"The quote doesn't clearly list {_part_label(slot)}. "
                        f"Our recommended design includes {bench_label}."
                    ),
                ),
            )
            continue

        quote_label = f"{quote_component.brand} {quote_component.model}".strip()
        same_catalog = (
            bench_component.catalog_id is not None
            and quote_component.catalog_id is not None
            and bench_component.catalog_id == quote_component.catalog_id
        )
        same_identity = (
            bench_component.brand.lower() == quote_component.brand.lower()
            and bench_component.model.lower() == quote_component.model.lower()
        )
        if same_catalog or same_identity:
            findings.append(
                QuoteAuditFindingSchema(
                    category="equipment",
                    severity="positive",
                    message=(
                        f"The quoted {_part_label(slot)} ({quote_label}) matches "
                        "our recommended design."
                    ),
                ),
            )
            continue

        findings.append(
            QuoteAuditFindingSchema(
                category="equipment",
                severity="info",
                message=(
                    f"The quoted {_part_label(slot)} ({quote_label}) is different from "
                    f"our recommendation ({bench_label}). That isn't always bad — "
                    "ask your installer why they chose this model."
                ),
            ),
        )
    return findings


def _missing_bos_findings(
    *,
    benchmark: DesignBuildSchema,
    quote_components: tuple[DesignComponentSchema, ...],
) -> list[QuoteAuditFindingSchema]:
    findings: list[QuoteAuditFindingSchema] = []
    bench_slots = _slots_present(benchmark.components)
    quote_slots = _slots_present(quote_components)
    missing = [slot for slot in _BOS_SLOTS if slot in bench_slots and slot not in quote_slots]
    if missing:
        labels = ", ".join(_SCOPE_LABELS.get(slot, slot) for slot in missing)
        findings.append(
            QuoteAuditFindingSchema(
                category="scope",
                severity="warning",
                message=(
                    f"The quote doesn't break out costs for {labels}. "
                    "Ask whether these are included in the total or billed separately."
                ),
            ),
        )
    elif any(slot in quote_slots for slot in _BOS_SLOTS):
        findings.append(
            QuoteAuditFindingSchema(
                category="scope",
                severity="positive",
                message=(
                    "The quote lists wiring, mounting, safety gear, or labour — "
                    "not just panels and an inverter."
                ),
            ),
        )
    return findings


def _catalog_price_findings(
    quote_components: tuple[DesignComponentSchema, ...],
    *,
    catalog: SolarCatalog | None = None,
) -> list[QuoteAuditFindingSchema]:
    cat = catalog or load_catalog()
    findings: list[QuoteAuditFindingSchema] = []
    for component in quote_components:
        if component.catalog_id is None or component.line_total_php <= 0:
            continue
        try:
            if component.slot == "panel":
                item = get_panel(component.catalog_id, cat)
                catalog_max = item.price_php.max * component.qty
            elif component.slot == "inverter":
                item = get_inverter(component.catalog_id, cat)
                catalog_max = item.price_php.max * component.qty
            elif component.slot == "battery":
                item = get_battery(component.catalog_id, cat)
                catalog_max = item.price_php.max * component.qty
            else:
                continue
        except KeyError:
            continue

        if catalog_max <= 0:
            continue
        inflation = (component.line_total_php - catalog_max) / catalog_max
        label = f"{component.brand} {component.model}".strip()
        if inflation >= _LINE_INFLATION_THRESHOLD:
            findings.append(
                QuoteAuditFindingSchema(
                    category="pricing",
                    severity="warning",
                    message=(
                        f"{label} is priced at ₱{component.line_total_php:,.0f} — "
                        f"about {inflation * 100:.0f}% above typical market rates "
                        f"(around ₱{catalog_max:,.0f})."
                    ),
                ),
            )
        elif inflation <= -0.1:
            findings.append(
                QuoteAuditFindingSchema(
                    category="pricing",
                    severity="positive",
                    message=(
                        f"{label} is priced at ₱{component.line_total_php:,.0f} — "
                        "below what we'd normally expect for this part."
                    ),
                ),
            )
    return findings


def _schema_to_solver_constraints(schema: SolverConstraintsSchema) -> SolverConstraints:
    return SolverConstraints(
        target_kwp=schema.target_kwp,
        max_panel_count=schema.max_panel_count,
        usable_roof_area_m2=schema.usable_roof_area_m2,
        budget_php=schema.budget_php,
        require_battery=schema.require_battery,
        min_battery_kwh=schema.min_battery_kwh,
        goal=schema.goal,
    )


def _compatibility_findings(
    *,
    quote_components: tuple[DesignComponentSchema, ...],
    panel_count: int | None,
    constraints: SolverConstraintsSchema | None,
) -> list[QuoteAuditFindingSchema]:
    if constraints is None or not isinstance(panel_count, int) or panel_count <= 0:
        return []

    panel_component = _component_by_slot(quote_components, "panel")
    inverter_component = _component_by_slot(quote_components, "inverter")
    battery_component = _component_by_slot(quote_components, "battery")
    if panel_component is None or inverter_component is None:
        return []
    if panel_component.catalog_id is None or inverter_component.catalog_id is None:
        return []

    cat = load_catalog()
    try:
        panel = get_panel(panel_component.catalog_id, cat)
        inverter = get_inverter(inverter_component.catalog_id, cat)
        battery = (
            get_battery(battery_component.catalog_id, cat)
            if battery_component is not None and battery_component.catalog_id
            else None
        )
    except KeyError:
        return []

    combo, rejection = _evaluate_combo(
        panel,
        inverter,
        battery,
        panel_count,
        _schema_to_solver_constraints(constraints),
        cat,
        "quote-audit",
    )
    if combo is not None:
        findings = [
            QuoteAuditFindingSchema(
                category="compatibility",
                severity="positive",
                message=(
                    f"The panels, inverter, and wiring look like a good match for "
                    f"{panel_count} panels "
                    f"({_system_size_phrase(combo.system_kwp, panel_count)})."
                ),
            ),
        ]
        if battery is not None and combo.battery_id:
            findings.append(
                QuoteAuditFindingSchema(
                    category="compatibility",
                    severity="positive",
                    message=(
                        "The home battery listed can work with the quoted inverter."
                    ),
                ),
            )
        return findings

    message = humanize_catalog_rejection(rejection, slot="inverter")
    return [
        QuoteAuditFindingSchema(
            category="compatibility",
            severity="warning",
            message=(
                "The parts listed may not work well together: "
                f"{message}"
            ),
        ),
    ]


def _derive_pros_cons(
    findings: tuple[QuoteAuditFindingSchema, ...],
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    pros = tuple(
        finding.message
        for finding in findings
        if finding.severity == "positive"
    )
    cons = tuple(
        finding.message
        for finding in findings
        if finding.severity == "warning"
    )
    return pros, cons


def _questions_for_installer(
    findings: tuple[QuoteAuditFindingSchema, ...],
    *,
    extracted: dict[str, float | int | None],
    benchmark: DesignBuildSchema,
) -> tuple[str, ...]:
    questions: list[str] = []
    categories = {finding.category for finding in findings}
    severities = {finding.severity for finding in findings}

    if "scope" in categories:
        questions.append(
            "Is wiring, roof mounting, safety gear, and installation labour "
            "included in this price, or will those cost extra?"
        )
    if "compatibility" in categories and any(
        finding.severity == "warning" for finding in findings if finding.category == "compatibility"
    ):
        questions.append(
            "Can you confirm the panel count, inverter, and any battery are "
            "the right match and wired safely?"
        )
    if "pricing" in categories and "warning" in severities:
        questions.append(
            "Which parts of this quote make it more expensive than usual "
            "for a system this size?"
        )
    if isinstance(extracted.get("total_php"), (int, float)):
        extracted_total = float(extracted["total_php"])
        if extracted_total > benchmark.total_investment_php:
            questions.append(
                "What extra warranty, support, or services explain why this quote is "
                f"₱{extracted_total - benchmark.total_investment_php:,.0f} "
                "higher than we'd expect?"
            )
    if any(finding.category == "equipment" and finding.severity == "warning" for finding in findings):
        questions.append(
            "Can you list the exact brands and models for the panels, inverter, "
            "and battery — not just a generic description?"
        )

    if not questions:
        questions.append(
            "What is the payment schedule, and how long from deposit to turn-on?"
        )
        questions.append(
            "Are permits, net-metering paperwork, and after-install support included?"
        )

    return tuple(list(dict.fromkeys(questions))[:5])


def _derive_verdict(
    findings: tuple[QuoteAuditFindingSchema, ...],
) -> QuoteAuditVerdictValue:
    warnings = sum(1 for finding in findings if finding.severity == "warning")
    positives = sum(1 for finding in findings if finding.severity == "positive")
    has_compatibility_warning = any(
        finding.category == "compatibility" and finding.severity == "warning"
        for finding in findings
    )
    has_unreadable = any(
        _UNREADABLE_PHRASE in finding.message.lower()
        for finding in findings
    )

    if has_unreadable or has_compatibility_warning or warnings >= 3:
        return "needs_review"
    if warnings == 0 and positives >= 2:
        return "favorable"
    if warnings <= 1 and positives >= 1:
        return "favorable"
    return "caution"


def audit_uploaded_quote(
    *,
    filename: str,
    content: bytes,
    session: DesignSessionSchema,
    client: QuoteAuditorClient,
    image_transcriber: QuoteImageTranscriber | None = None,
) -> QuoteAuditResponseSchema:
    benchmark = next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0] if session.builds else None,
    )
    if benchmark is None:
        raise ValueError("Design session has no builds to benchmark against.")

    document_text = read_quote_document(
        filename,
        content,
        transcriber=image_transcriber or client,
    )

    extracted = client.extract_quote_facts(document_text=document_text)
    quote_lines = client.extract_quote_lines(document_text=document_text)
    extracted = {
        **extracted,
        "panel_count": resolve_panel_count(extracted, quote_lines),
    }
    diagram_component_models = build_quote_diagram_components(
        extracted=extracted,
        raw_lines=quote_lines,
    )
    resolved_total = resolve_quote_total_php(
        extracted,
        quote_lines,
        diagram_component_models,
        document_text=document_text,
    )
    extracted = {**extracted, "total_php": resolved_total}
    diagram_components = tuple(
        to_component_schema(component)
        for component in diagram_component_models
    )

    panel_count = extracted.get("panel_count")
    constraints = session.last_solve.constraints if session.last_solve else None
    all_findings = [
        *_pricing_findings(extracted=extracted, benchmark=benchmark),
        *_component_diff_findings(benchmark=benchmark, quote_components=diagram_components),
        *_missing_bos_findings(benchmark=benchmark, quote_components=diagram_components),
        *_catalog_price_findings(diagram_components),
        *_compatibility_findings(
            quote_components=diagram_components,
            panel_count=int(panel_count) if isinstance(panel_count, int) else None,
            constraints=constraints,
        ),
    ]
    findings = tuple(all_findings)
    pros, cons = _derive_pros_cons(findings)
    questions = _questions_for_installer(
        findings,
        extracted=extracted,
        benchmark=benchmark,
    )
    verdict = _derive_verdict(findings)

    benchmark_facts = {
        "total_investment_php": benchmark.total_investment_php,
        "system_kwp": benchmark.system_kwp,
        "panel_count": benchmark.panel_count,
    }
    summary = client.summarize_audit(
        benchmark=benchmark_facts,
        extracted=extracted,
        findings=tuple(finding.message for finding in findings),
        pros=pros,
        cons=cons,
        verdict=verdict,
    )

    total = extracted.get("total_php")
    kwp = extracted.get("system_kwp")
    return QuoteAuditResponseSchema(
        filename=filename,
        extracted_total_php=float(total) if isinstance(total, (int, float)) else None,
        extracted_system_kwp=float(kwp) if isinstance(kwp, (int, float)) else None,
        extracted_panel_count=int(panel_count) if isinstance(panel_count, int) else None,
        benchmark_total_php=benchmark.total_investment_php,
        benchmark_system_kwp=benchmark.system_kwp,
        findings=findings,
        summary=summary,
        diagram_components=diagram_components,
        pros=pros,
        cons=cons,
        questions_for_installer=questions,
        verdict=verdict,
    )
