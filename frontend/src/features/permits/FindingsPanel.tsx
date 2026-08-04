// Defines the findings panel: the AI-phrased summary sits above deterministic
// findings, never replaces them (CLOSED-verdict-source.md — rules decide,
// AI only phrases). The summary renders as the house cobalt-rule serif aside
// (the QuotationPage "Why this pays" idiom); findings are hairline-separated
// rows whose severity is a typographic label — ember interrupts for blocking,
// ink for warnings, tertiary for notes. Mismatch findings quote both strings
// in their message so the user sees exactly what disagrees. Rows expand to
// show legal basis, source excerpt, and what was extracted, behind the same
// cobalt disclosure the checklist uses.
import { useState } from "react";

import { Eyebrow } from "../../shared/components/ui";
import type { FindingSeverity, PermitAssessment, PermitFinding } from "./permitTypes";
import {
  DOCUMENT_CATALOG,
  documentExtractionSummary,
  findingSeverityLabel,
} from "./permitsViewModel";

const SEVERITY_LABEL_CLASS: Record<FindingSeverity, string> = {
  blocking: "text-ember",
  warning: "text-ink",
  info: "text-tertiary-ink",
};

function FindingRow({
  finding,
  assessment,
}: {
  finding: PermitFinding;
  assessment: PermitAssessment;
}) {
  const [expanded, setExpanded] = useState(false);
  const document = assessment.documents.find(
    (candidate) => candidate.document_id === finding.document_id,
  );
  const catalogEntry = finding.document_id ? DOCUMENT_CATALOG[finding.document_id] : undefined;

  return (
    <li className="border-t border-hairline py-4 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`font-sans text-[11px] font-semibold tracking-[0.8px] uppercase ${SEVERITY_LABEL_CLASS[finding.severity]}`}
        >
          {findingSeverityLabel(finding.severity)}
        </span>
        {document ? (
          <span className="font-sans text-xs text-tertiary-ink">
            {document.title}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-1.5 max-w-2xl font-sans text-sm leading-6 ${
          finding.severity === "blocking" ? "text-ink" : "text-secondary"
        }`}
      >
        {finding.message}
      </p>

      {catalogEntry || document ? (
        <button
          type="button"
          className="mt-1.5 flex items-center gap-1.5 font-sans text-[13px] font-semibold text-cobalt hover:underline"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          Legal basis &amp; what we found
          <span
            aria-hidden="true"
            className={`transition-transform duration-150 ease-brand ${expanded ? "rotate-90" : ""}`}
          >
            ›
          </span>
        </button>
      ) : null}

      {expanded ? (
        <dl className="mt-3 flex flex-col gap-2.5 border-l-2 border-hairline pl-4 font-sans text-[13px] leading-5">
          {catalogEntry ? (
            <>
              <div>
                <dt className="text-[10px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase">
                  Legal basis
                </dt>
                <dd className="mt-0.5 text-ink">{catalogEntry.legal_basis}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase">
                  Source excerpt
                </dt>
                <dd className="mt-0.5 font-serif text-[15px] text-secondary italic">
                  {catalogEntry.source_excerpt}
                </dd>
              </div>
            </>
          ) : null}
          {document ? (
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase">
                What we found
              </dt>
              <dd className="mt-0.5 text-ink">
                {documentExtractionSummary(document, assessment.findings)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

export function FindingsPanel({ assessment }: { assessment: PermitAssessment }) {
  return (
    <section aria-label="Findings">
      <Eyebrow>03 · Findings</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-medium text-ink">
        What we checked
      </h2>

      <aside className="mt-4 border-l-2 border-cobalt pl-4">
        <p className="font-sans text-[10px] font-semibold tracking-[1px] text-cobalt uppercase">
          In short
        </p>
        <p className="mt-1 max-w-2xl font-serif text-[17px] leading-6 text-ink italic">
          {assessment.summary}
        </p>
      </aside>

      {assessment.findings.length === 0 ? (
        <p className="mt-4 font-sans text-sm text-secondary">
          No findings — nothing flagged against your documents.
        </p>
      ) : (
        <ul className="mt-4">
          {assessment.findings.map((finding) => (
            <FindingRow
              key={`${finding.document_id ?? "general"}-${finding.category}-${finding.message}`}
              finding={finding}
              assessment={assessment}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
