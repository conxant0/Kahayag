// Defines the hand-off block that closes the page. Must never imply anything
// has been filed — eGov submission is a stub today (CLOSED-egov-output.md).
// Trimmed to heading, body, and the eGov note per the focus layout settled
// after side-by-side comparison. The "Submit to eGov" button is decorative:
// there is no backend to call yet, so a click only relabels itself "Coming
// soon" rather than doing anything.
import { useState } from "react";

import { Button, Eyebrow } from "../../shared/components/ui";
import type { PermitAssessment } from "./permitTypes";
import { packetStatusCopy } from "./permitsViewModel";

export function PacketStatusCard({ assessment }: { assessment: PermitAssessment }) {
  const { heading, body } = packetStatusCopy(assessment);
  const [clicked, setClicked] = useState(false);

  return (
    <section aria-label="Packet status">
      <Eyebrow>03 · Hand-off</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-medium text-ink">{heading}</h2>
      <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-secondary">
        {body}
      </p>

      <p className="mt-4 font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase">
        Direct eGov submission — not yet connected
      </p>

      {assessment.packet_status === "ready" ? (
        <Button
          variant="secondary"
          className="mt-4 h-10 gap-1.5 px-4 text-[13px]"
          onClick={() => setClicked(true)}
        >
          {clicked ? "Coming soon" : "Submit to eGov"}
        </Button>
      ) : null}
    </section>
  );
}
