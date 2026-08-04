// Defines the three-input applicant form (CLOSED-applicant-inputs.md).
// Property address is shown read-only, confirmed from step 1, never typed.
// Field styling follows RefineInputs: xs secondary labels, hairline inputs
// that focus cobalt, tertiary-ink helper lines. The answered form rests as a
// one-line summary behind an "Edit details" disclosure (the focus layout,
// settled after side-by-side comparison) — the full form renders only while
// editing.
import { useState } from "react";

import { Button, Eyebrow, SegmentedToggle } from "../../shared/components/ui";
import type { SolarInOriginalPermitAnswer } from "./permitTypes";
import { resolveTrack } from "./permitsViewModel";

const YES_NO_NOT_SURE = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
  { value: "not_sure" as const, label: "Not sure" },
];

const YES_NO = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
];

const fieldClassName =
  "w-full rounded-xs border border-hairline bg-white px-3 py-2 font-sans text-[15px] text-ink outline-none transition-colors duration-150 ease-brand placeholder:text-tertiary-ink focus-visible:border-cobalt";

export interface ApplicantFormValues {
  solarInOriginalPermit: SolarInOriginalPermitAnswer;
  fullName: string;
  isRegisteredOwner: "yes" | "no";
  registeredOwnerName: string;
  /** Set only via the chat's `set_delegation_answer` tool, not this form
   * (CLOSED-ai-surface.md). Carried here so it round-trips through
   * toApiApplicant/fromApiApplicant across a re-assess. */
  delegatesFilingToRepresentative: boolean;
}

function canSubmitApplicant(values: ApplicantFormValues): boolean {
  if (values.fullName.trim() === "") {
    return false;
  }
  if (values.isRegisteredOwner === "no" && values.registeredOwnerName.trim() === "") {
    return false;
  }
  return true;
}

export function ApplicantForm({
  values,
  onChange,
  onSubmit,
  propertyAddress,
}: {
  values: ApplicantFormValues;
  onChange: (values: ApplicantFormValues) => void;
  /** Fires when the homeowner clicks Submit. Optional so callers that don't
   * gate a request behind a submit step (e.g. the read-only preview fixture)
   * can render the form without wiring one up. */
  onSubmit?: () => void;
  propertyAddress: string;
}) {
  // Incomplete answers start expanded so the homeowner sees what to fill in;
  // pre-filled fixture/preview data starts collapsed as the one-line summary.
  const [editing, setEditing] = useState(() => !canSubmitApplicant(values));
  const track = resolveTrack(values.solarInOriginalPermit);

  if (!editing) {
    return (
      <section aria-label="Applicant details">
        <Eyebrow>01 · Applicant details</Eyebrow>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-6 text-ink">
          <span className="font-semibold">{values.fullName || "—"}</span>
          {" · "}
          {values.isRegisteredOwner === "yes"
            ? "registered owner"
            : `filing for ${values.registeredOwnerName.trim() || "the registered owner"}`}
          {" · "}
          {track === "streamlined" ? "streamlined track" : "retrofit track"}
        </p>
        <p className="mt-1 font-sans text-xs text-tertiary-ink">
          {propertyAddress}
        </p>
        <button
          type="button"
          className="mt-2 flex items-center gap-1.5 font-sans text-[13px] font-semibold text-cobalt hover:underline"
          onClick={() => setEditing(true)}
          aria-expanded={false}
        >
          Edit details
          <span aria-hidden="true">›</span>
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Applicant details">
      <Eyebrow>01 · Applicant details</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-medium text-ink">
        Tell us who is filing
      </h2>
      <button
        type="button"
        className="mt-2 flex items-center gap-1.5 font-sans text-[13px] font-semibold text-cobalt hover:underline"
        onClick={() => setEditing(false)}
        aria-expanded={true}
      >
        Done editing
        <span aria-hidden="true" className="rotate-90 inline-block">
          ›
        </span>
      </button>

      <div className="mt-5 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs text-secondary">Property address</p>
          <p className="font-sans text-[15px] text-ink">{propertyAddress}</p>
          <p className="font-sans text-xs text-tertiary-ink">
            Confirmed from the property you traced earlier. Not editable here.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs text-secondary">
            Was solar part of your house&apos;s original building permit?
          </p>
          <SegmentedToggle
            className="self-start"
            ariaLabel="Was solar part of your house's original building permit?"
            value={values.solarInOriginalPermit}
            options={YES_NO_NOT_SURE}
            onChange={(solarInOriginalPermit) =>
              onChange({ ...values, solarInOriginalPermit })
            }
          />
          <p className="font-sans text-xs text-tertiary-ink">
            &ldquo;Not sure&rdquo; puts you on the fuller retrofit track, the
            safer direction to be wrong in.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="applicant-full-name"
            className="font-sans text-xs text-secondary"
          >
            Your full name
          </label>
          <input
            id="applicant-full-name"
            type="text"
            value={values.fullName}
            onChange={(event) =>
              onChange({ ...values, fullName: event.target.value })
            }
            placeholder="As it appears on your ID"
            className={fieldClassName}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs text-secondary">
            Are you the registered owner on the title?
          </p>
          <SegmentedToggle
            className="self-start"
            ariaLabel="Are you the registered owner on the title?"
            value={values.isRegisteredOwner}
            options={YES_NO}
            onChange={(isRegisteredOwner) =>
              onChange({ ...values, isRegisteredOwner })
            }
          />
          {values.isRegisteredOwner === "no" ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <label
                htmlFor="registered-owner-name"
                className="font-sans text-xs text-secondary"
              >
                Registered owner&apos;s name
              </label>
              <input
                id="registered-owner-name"
                type="text"
                value={values.registeredOwnerName}
                onChange={(event) =>
                  onChange({
                    ...values,
                    registeredOwnerName: event.target.value,
                  })
                }
                placeholder="As it appears on the title"
                className={fieldClassName}
              />
              <p className="font-sans text-xs text-tertiary-ink">
                Because you&apos;re not the registered owner, a notarized
                authorization from them becomes a required document below.
              </p>
            </div>
          ) : null}
        </div>

        <Button
          variant="secondary"
          onClick={onSubmit}
          disabled={!canSubmitApplicant(values)}
        >
          Submit
        </Button>
      </div>
    </section>
  );
}
