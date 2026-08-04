// Defines the packet-status card. Must never imply anything has been filed —
// eGov submission is a stub today (CLOSED-egov-output.md).
import type { PermitAssessment } from "./permitTypes";
import { packetStatusCopy } from "./permitsViewModel";

export function PacketStatusCard({ assessment }: { assessment: PermitAssessment }) {
  const { heading, body } = packetStatusCopy(assessment);

  return (
    <section
      aria-label="Packet status"
      className="rounded-[20px] border border-hairline bg-[#fbf8f1] p-5 lg:p-6"
    >
      <p className="font-sans text-[11px] font-semibold tracking-[1.4px] text-tertiary-ink uppercase">
        Packet status
      </p>
      <h2 className="mt-1 font-serif text-xl font-medium text-ink">{heading}</h2>
      <p className="mt-1.5 font-sans text-[13px] leading-5 text-secondary">{body}</p>
      <p className="mt-3 font-sans text-[11px] font-semibold tracking-[0.4px] text-tertiary uppercase">
        Direct eGov submission — not yet connected
      </p>
    </section>
  );
}
