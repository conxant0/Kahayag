// Defines the hand-off block that closes the page. Must never imply anything
// has been filed — eGov submission is a stub today (CLOSED-egov-output.md).
// Trimmed to heading, body, and the eGov note per the focus layout settled
// after side-by-side comparison.
import { Eyebrow } from "../../shared/components/ui";
import type { PermitAssessment } from "./permitTypes";
import { packetStatusCopy } from "./permitsViewModel";

export function PacketStatusCard({ assessment }: { assessment: PermitAssessment }) {
  const { heading, body } = packetStatusCopy(assessment);

  return (
    <section aria-label="Packet status">
      <Eyebrow>04 · Hand-off</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-medium text-ink">{heading}</h2>
      <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-secondary">
        {body}
      </p>

      <p className="mt-4 font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase">
        Direct eGov submission — not yet connected
      </p>
    </section>
  );
}
