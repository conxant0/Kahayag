// Defines the hand-off block that closes the page. Must never imply anything
// has been filed — eGov submission is a stub today (CLOSED-egov-output.md).
// Trimmed to heading, body, and a Submit control that only enables once every
// required document is uploaded and verified.
import { Button, Eyebrow } from "../../shared/components/ui";
import type { PermitAssessment } from "./permitTypes";
import { canSubmitPacket, packetStatusCopy } from "./permitsViewModel";

export function PacketStatusCard({
  assessment,
  onSubmit,
  submitAcknowledged = false,
}: {
  assessment: PermitAssessment;
  /** When omitted (e.g. the read-only preview fixture), Submit stays disabled. */
  onSubmit?: () => void;
  submitAcknowledged?: boolean;
}) {
  const { heading, body } = packetStatusCopy(assessment);
  const readyToSubmit = canSubmitPacket(assessment);

  return (
    <section aria-label="Packet status">
      <Eyebrow>04 · Hand-off</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-medium text-ink">{heading}</h2>
      <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-secondary">
        {body}
      </p>

      <Button
        fullWidth
        className="mt-4"
        disabled={!readyToSubmit || submitAcknowledged || !onSubmit}
        onClick={onSubmit}
      >
        {submitAcknowledged ? "Submitted" : "Submit"}
      </Button>
    </section>
  );
}
