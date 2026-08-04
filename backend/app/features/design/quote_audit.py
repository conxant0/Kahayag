# Defines uploaded-quote extraction and benchmark comparison for the compare page.

from app.features.design.schemas import (
    DesignBuildSchema,
    DesignSessionSchema,
    QuoteAuditFindingSchema,
    QuoteAuditResponseSchema,
)
from app.integrations.ai.quote_auditor import QuoteAuditorClient
from app.integrations.pdf.document_text import extract_document_text


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
) -> QuoteAuditResponseSchema:
    benchmark = next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0] if session.builds else None,
    )
    if benchmark is None:
        raise ValueError("Design session has no builds to benchmark against.")

    document_text = extract_document_text(filename, content)
    if not document_text.strip():
        raise ValueError(
            "Could not read text from the upload. Try a text-based PDF or paste a .txt quote."
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
    return QuoteAuditResponseSchema(
        filename=filename,
        extracted_total_php=float(total) if isinstance(total, (int, float)) else None,
        extracted_system_kwp=float(kwp) if isinstance(kwp, (int, float)) else None,
        benchmark_total_php=benchmark.total_investment_php,
        benchmark_system_kwp=benchmark.system_kwp,
        findings=findings,
        summary=summary,
    )
