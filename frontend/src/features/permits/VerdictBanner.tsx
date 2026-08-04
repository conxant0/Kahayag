// Defines the verdict banner. Non-negotiable copy constraint
// (CLOSED-document-scope.md): must state the homeowner's side is complete,
// must never state or imply the permit application itself is complete.
import type { PermitAssessment } from "./permitTypes";
import { verdictBannerCopy } from "./permitsViewModel";

export function VerdictBanner({ assessment }: { assessment: PermitAssessment }) {
  const { ready, heading, body } = verdictBannerCopy(assessment);

  return (
    <section
      role="status"
      aria-label="Verdict"
      className={`rounded-[20px] border p-5 lg:p-6 ${
        ready
          ? "border-green-700/20 bg-[#f2faf4]"
          : "border-ember/30 bg-[#fff5f2]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill font-sans text-xs font-bold ${
            ready ? "bg-green-800 text-white" : "bg-ember text-white"
          }`}
        >
          {ready ? "✓" : "!"}
        </span>
        <div>
          <h2 className="font-serif text-xl font-medium text-ink">{heading}</h2>
          <p className="mt-1.5 font-sans text-[13px] leading-5 text-secondary">
            {body}
          </p>
        </div>
      </div>
    </section>
  );
}
