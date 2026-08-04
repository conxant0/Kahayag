// Defines the three-input applicant form (CLOSED-applicant-inputs.md).
// Property address is shown read-only, confirmed from step 1, never typed.
import { SegmentedToggle } from "../../shared/components/ui";
import type { SolarInOriginalPermitAnswer } from "./permitTypes";

const YES_NO_NOT_SURE = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
  { value: "not_sure" as const, label: "Not sure" },
];

const YES_NO = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
];

export interface ApplicantFormValues {
  solarInOriginalPermit: SolarInOriginalPermitAnswer;
  fullName: string;
  isRegisteredOwner: "yes" | "no";
  registeredOwnerName: string;
}

export function ApplicantForm({
  values,
  onChange,
  propertyAddress,
}: {
  values: ApplicantFormValues;
  onChange: (values: ApplicantFormValues) => void;
  propertyAddress: string;
}) {
  return (
    <section
      aria-label="Applicant details"
      className="rounded-[20px] border border-hairline bg-white p-5 lg:p-6"
    >
      <p className="font-sans text-[11px] font-semibold tracking-[1.4px] text-tertiary-ink uppercase">
        Applicant details
      </p>
      <h2 className="mt-1 font-serif text-2xl font-medium text-ink">
        Tell us who is filing
      </h2>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <label className="font-sans text-[10px] font-semibold tracking-[0.8px] text-secondary uppercase">
            Property address
          </label>
          <p className="mt-1.5 rounded-[12px] border border-hairline bg-[#fcfaf5] px-3.5 py-3 font-sans text-sm text-ink">
            {propertyAddress}
          </p>
          <p className="mt-1 font-sans text-[11px] text-tertiary">
            Confirmed from the property you traced earlier. Not editable here.
          </p>
        </div>

        <div>
          <p className="font-sans text-[10px] font-semibold tracking-[0.8px] text-secondary uppercase">
            Was solar part of your house&apos;s original building permit?
          </p>
          <SegmentedToggle
            className="mt-2"
            ariaLabel="Was solar part of your house's original building permit?"
            value={values.solarInOriginalPermit}
            options={YES_NO_NOT_SURE}
            onChange={(solarInOriginalPermit) =>
              onChange({ ...values, solarInOriginalPermit })
            }
          />
          <p className="mt-1.5 font-sans text-[11px] text-tertiary">
            &ldquo;Not sure&rdquo; puts you on the fuller retrofit track, the
            safer direction to be wrong in.
          </p>
        </div>

        <div>
          <label
            htmlFor="applicant-full-name"
            className="font-sans text-[10px] font-semibold tracking-[0.8px] text-secondary uppercase"
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
            className="mt-1.5 w-full rounded-[12px] border border-hairline bg-white px-3.5 py-3 font-sans text-sm text-ink outline-none focus:border-cobalt"
          />
        </div>

        <div>
          <p className="font-sans text-[10px] font-semibold tracking-[0.8px] text-secondary uppercase">
            Are you the registered owner on the title?
          </p>
          <SegmentedToggle
            className="mt-2"
            ariaLabel="Are you the registered owner on the title?"
            value={values.isRegisteredOwner}
            options={YES_NO}
            onChange={(isRegisteredOwner) =>
              onChange({ ...values, isRegisteredOwner })
            }
          />
          {values.isRegisteredOwner === "no" ? (
            <div className="mt-3">
              <label
                htmlFor="registered-owner-name"
                className="font-sans text-[10px] font-semibold tracking-[0.8px] text-secondary uppercase"
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
                className="mt-1.5 w-full rounded-[12px] border border-hairline bg-white px-3.5 py-3 font-sans text-sm text-ink outline-none focus:border-cobalt"
              />
              <p className="mt-1.5 font-sans text-[11px] text-tertiary">
                Because you&apos;re not the registered owner, a notarized
                authorization from them becomes a required document below.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
