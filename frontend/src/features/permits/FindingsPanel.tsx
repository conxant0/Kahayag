// Defines the findings panel: the AI summary sits above deterministic
// findings, never replaces them (CLOSED-verdict-source.md — rules decide,
// AI only phrases). Mismatch findings quote both strings in their message so
// the user sees exactly what disagrees. Rows expand to show legal basis,
// source excerpt, and what was extracted from the underlying document (item
// 3) — the same `CanvasComponentCard`-style "View details" disclosure used
// in `DocumentChecklist.tsx`.
import { useState } from "react";

import type { FindingSeverity, PermitAssessment, PermitFinding } from "./permitTypes";
import {
  DOCUMENT_CATALOG,
  documentExtractionSummary,
  findingSeverityLabel,
} from "./permitsViewModel";

const SEVERITY_CLASS: Record<FindingSeverity, string> = {
  blocking: "border-ember/30 bg-[#fff5f2] text-ember",
  warning: "border-ember/30 bg-[#fff8ef] text-[#8a5a00]",
  info: "border-hairline bg-[#fcfaf5] text-secondary",
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
    <li className={`rounded-[12px] border p-3 font-sans text-[13px] leading-5 ${SEVERITY_CLASS[finding.severity]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold uppercase tracking-[0.4px] text-[10px]">
          {findingSeverityLabel(finding.severity)}
        </span>
        {document ? (
          <span className="text-[11px] text-secondary">{document.title}</span>
        ) : null}
      </div>
      <p className="mt-1">{finding.message}</p>

      {catalogEntry || document ? (
        <button
          type="button"
          className="mt-1.5 flex items-center gap-1 font-sans text-[12px] font-semibold text-cobalt hover:underline"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Legal basis & what we found"}
          <span aria-hidden="true">{expanded ? "▲" : "▾"}</span>
        </button>
      ) : null}

      {expanded ? (
        <dl className="mt-3 grid gap-2 rounded-[12px] border border-hairline bg-white/60 p-3 text-[12px] leading-5">
          {catalogEntry ? (
            <>
              <div>
                <dt className="font-semibold tracking-[0.4px] text-tertiary uppercase text-[10px]">
                  Legal basis
                </dt>
                <dd className="mt-0.5 text-ink">{catalogEntry.legal_basis}</dd>
              </div>
              <div>
                <dt className="font-semibold tracking-[0.4px] text-tertiary uppercase text-[10px]">
                  Source excerpt
                </dt>
                <dd className="mt-0.5 text-secondary italic">{catalogEntry.source_excerpt}</dd>
              </div>
            </>
          ) : null}
          {document ? (
            <div>
              <dt className="font-semibold tracking-[0.4px] text-tertiary uppercase text-[10px]">
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
    <section
      aria-label="Findings"
      className="rounded-[20px] border border-hairline bg-white p-5 lg:p-6"
    >
      <p className="font-sans text-[11px] font-semibold tracking-[1.4px] text-tertiary-ink uppercase">
        Findings
      </p>
      <h2 className="mt-1 font-serif text-2xl font-medium text-ink">
        What we checked
      </h2>

      <aside className="mt-4 rounded-[14px] border-l-4 border-cobalt bg-cobalt-wash px-4 py-3">
        <p className="font-sans text-[10px] font-semibold tracking-[1px] text-cobalt uppercase">
          AI summary
        </p>
        <p className="mt-1 font-serif text-[15px] leading-6 text-ink italic">
          {assessment.summary}
        </p>
      </aside>

      {assessment.findings.length === 0 ? (
        <p className="mt-4 font-sans text-sm text-secondary">
          No findings — nothing flagged against your documents.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2">
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
