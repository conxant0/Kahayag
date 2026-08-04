// Defines the verdict block. Non-negotiable copy constraint
// (CLOSED-document-scope.md): must state the homeowner's side is complete,
// must never state or imply the permit application itself is complete.
//
// Flat and typographic per the brandbook — the serif heading carries the
// verdict, the eyebrow carries the tone: ember interrupts when the packet
// still needs the homeowner, cobalt informs once their side is done.
import { Eyebrow } from "../../shared/components/ui";
import type { PermitAssessment } from "./permitTypes";
import {
  outstandingDocumentTitles,
  progressSummary,
  verdictBannerCopy,
} from "./permitsViewModel";

export function VerdictBanner({ assessment }: { assessment: PermitAssessment }) {
  const { ready, heading, body } = verdictBannerCopy(assessment);
  const progress = progressSummary(assessment);
  const outstanding = outstandingDocumentTitles(assessment);

  return (
    <section role="status" aria-label="Verdict">
      <Eyebrow tone={ready ? "cobalt" : "ember"}>Verdict</Eyebrow>
      <h2 className="mt-2 font-serif text-[26px] leading-tight font-medium text-balance text-ink lg:text-[30px]">
        {heading}
      </h2>
      <p className="mt-3 max-w-2xl font-sans text-sm leading-6 text-ink">{body}</p>
      <p className="mt-3 max-w-2xl font-sans text-[13px] leading-5 font-semibold text-tertiary-ink">
        {ready ? (
          <>All {progress.total} documents resolved.</>
        ) : (
          <>
            {progress.resolved} of {progress.total} resolved · Still needs you:{" "}
            <span className="text-ink">{outstanding.join(", ")}</span>
          </>
        )}
      </p>
    </section>
  );
}
