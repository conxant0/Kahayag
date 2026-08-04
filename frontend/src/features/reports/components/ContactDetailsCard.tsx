// Defines the optional contact fields offered before the proposal download.
import { useId } from "react";

import type { ContactDetails } from "../../../state/assessmentStore";

const FIELD_CLASS_NAME =
  "w-full rounded-xs border border-hairline bg-white px-3 py-2 font-sans text-[15px] text-ink outline-none transition-colors duration-150 ease-brand placeholder:text-tertiary-ink focus-visible:border-cobalt";

/**
 * Asked here and nowhere earlier on purpose: a name and number belong to the
 * moment someone decides the result is worth keeping, and asking before the
 * result exists is how a helpful flow turns into a lead form.
 *
 * Every field is optional, and the caption says exactly where the answers go
 * — this device, with the session — because for the demo that is the truth.
 */
export function ContactDetailsCard({
  contact,
  onChange,
}: {
  contact: ContactDetails;
  onChange: (changes: Partial<ContactDetails>) => void;
}) {
  const nameId = useId();
  const emailId = useId();
  const mobileId = useId();

  return (
    <section
      aria-label="Your contact details"
      className="flex w-full flex-col gap-4 rounded-3xl border-[1.5px] border-hairline bg-white px-6 py-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[20px] font-medium text-ink">
          Where should a proposal reach you?
        </h2>
        <p className="font-sans text-[13px] text-tertiary-ink">
          Optional. Kept on this device with your session — nothing is sent
          anywhere yet.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="font-sans text-xs text-secondary">
            Full name
          </label>
          <input
            id={nameId}
            autoComplete="name"
            value={contact.fullName}
            onChange={(event) => onChange({ fullName: event.target.value })}
            placeholder="Juana dela Cruz"
            className={FIELD_CLASS_NAME}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="font-sans text-xs text-secondary">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={contact.email}
            onChange={(event) => onChange({ email: event.target.value })}
            placeholder="you@example.com"
            className={FIELD_CLASS_NAME}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={mobileId}
            className="font-sans text-xs text-secondary"
          >
            Mobile number
          </label>
          <input
            id={mobileId}
            autoComplete="tel"
            inputMode="tel"
            value={contact.mobile}
            onChange={(event) => onChange({ mobile: event.target.value })}
            placeholder="0917 123 4567"
            className={FIELD_CLASS_NAME}
          />
        </div>
      </div>
    </section>
  );
}
