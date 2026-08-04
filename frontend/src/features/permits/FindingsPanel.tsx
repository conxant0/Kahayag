// Defines the findings panel: the AI summary sits above deterministic
// findings, never replaces them (CLOSED-verdict-source.md — rules decide,
// AI only phrases). Mismatch findings quote both strings in their message so
// the user sees exactly what disagrees.
import type { FindingSeverity, PermitAssessment } from "./permitTypes";
import { findingSeverityLabel } from "./permitsViewModel";

const SEVERITY_CLASS: Record<FindingSeverity, string> = {
  blocking: "border-ember/30 bg-[#fff5f2] text-ember",
  warning: "border-ember/30 bg-[#fff8ef] text-[#8a5a00]",
  info: "border-hairline bg-[#fcfaf5] text-secondary",
};

export function FindingsPanel({ assessment }: { assessment: PermitAssessment }) {
  const documentTitle = (documentId: string | null) =>
    assessment.documents.find((document) => document.document_id === documentId)
      ?.title ?? null;

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
            <li
              key={`${finding.document_id ?? "general"}-${finding.category}-${finding.message}`}
              className={`rounded-[12px] border p-3 font-sans text-[13px] leading-5 ${SEVERITY_CLASS[finding.severity]}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold uppercase tracking-[0.4px] text-[10px]">
                  {findingSeverityLabel(finding.severity)}
                </span>
                {finding.document_id ? (
                  <span className="text-[11px] text-secondary">
                    {documentTitle(finding.document_id) ?? finding.document_id}
                  </span>
                ) : null}
              </div>
              <p className="mt-1">{finding.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
