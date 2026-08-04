# Defines uploaded-quote extraction and benchmark comparison for the compare page.

from app.features.design.schemas import (
    DesignBuildSchema,
    DesignSessionSchema,
    QuoteAuditFindingSchema,
    QuoteAuditResponseSchema,
)
from app.integrations.ai.quote_auditor import QuoteAuditorClient
from app.integrations.quote_parsing.document_reader import (
    QuoteImageTranscriber,
    read_quote_document,
)


def _deterministic_findings(
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
        direction = (
            "equal to"
            if delta == 0
            else f"₱{abs(delta):,.0f} above"
            if delta > 0
            else f"₱{abs(delta):,.0f} below"
        )
        findings.append(
            QuoteAuditFindingSchema(
                category="pricing",
                severity=severity,
                message=(
                    f"Uploaded quote total ₱{extracted_total:,.0f} is {direction} "
                    f"the Kahayag benchmark of ₱{benchmark.total_investment_php:,.0f} "
                    f"({pct:+.1f}%)."
                ),
            ),
        )
    extracted_kwp = extracted.get("system_kwp")
    if isinstance(extracted_kwp, (int, float)):
        delta_kwp = float(extracted_kwp) - benchmark.system_kwp
        severity = "info" if abs(delta_kwp) <= 0.3 else "warning"
        findings.append(
            QuoteAuditFindingSchema(
                category="capacity",
                severity=severity,
                message=(
                    f"Uploaded quote lists {extracted_kwp:.2f} kWp versus the "
                    f"benchmark {benchmark.system_kwp:.2f} kWp "
                    f"({delta_kwp:+.2f} kWp)."
                ),
            ),
        )
    extracted_panels = extracted.get("panel_count")
    if isinstance(extracted_panels, int):
        delta_panels = extracted_panels - benchmark.panel_count
        severity = "info" if abs(delta_panels) <= 2 else "warning"
        findings.append(
            QuoteAuditFindingSchema(
                category="equipment",
                severity=severity,
                message=(
                    f"Uploaded quote lists {extracted_panels} panels versus the "
                    f"benchmark {benchmark.panel_count} panels "
                    f"({delta_panels:+d})."
                ),
            ),
        )
    if not findings:
        findings.append(
            QuoteAuditFindingSchema(
                category="pricing",
                severity="info",
                message=(
                    "Could not read a clear total or system size from the upload. "
                    f"Benchmark this roof at ₱{benchmark.total_investment_php:,.0f} "
                    f"for {benchmark.system_kwp:.2f} kWp ({benchmark.panel_count} panels)."
                ),
            ),
        )
    return findings


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
    findings = tuple(_deterministic_findings(extracted=extracted, benchmark=benchmark))
    benchmark_facts = {
        "total_investment_php": benchmark.total_investment_php,
        "system_kwp": benchmark.system_kwp,
        "panel_count": benchmark.panel_count,
    }
    summary = client.summarize_audit(
        benchmark=benchmark_facts,
        extracted=extracted,
        findings=tuple(finding.message for finding in findings),
    )

    total = extracted.get("total_php")
    kwp = extracted.get("system_kwp")
    panel_count = extracted.get("panel_count")
    return QuoteAuditResponseSchema(
        filename=filename,
        extracted_total_php=float(total) if isinstance(total, (int, float)) else None,
        extracted_system_kwp=float(kwp) if isinstance(kwp, (int, float)) else None,
        extracted_panel_count=int(panel_count) if isinstance(panel_count, int) else None,
        benchmark_total_php=benchmark.total_investment_php,
        benchmark_system_kwp=benchmark.system_kwp,
        findings=findings,
        summary=summary,
    )
