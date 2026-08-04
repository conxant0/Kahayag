// Defines the optional budget and tariff fields on the electricity-use step.
import { useId, useState } from "react";

import { DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH } from "../../../state/assessmentStore";

/** Digits only — the peso sign and separators are presentation, not input. */
const digitsOf = (value: string) => value.replace(/\D/g, "");

/** A tariff has centavos, so one decimal point survives; everything else goes. */
function rateDigitsOf(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

function parsePositive(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** An unset rate shows an empty field against the default as placeholder. */
function rateDraftOf(rate: number | null): string {
  return rate == null ? "" : String(rate);
}

/**
 * The two answers most homeowners do not have, kept out of the way.
 *
 * Both are optional and both change the result, so they are on the page rather
 * than assumed — but the bill is the question this step is asking, and putting
 * three fields of equal weight in front of someone would make the one they can
 * answer look like the one they cannot. A closed disclosure is the compromise:
 * present, labelled, and not competing.
 */
export function RefineInputs({
  budgetPhp,
  electricityRatePhpPerKwh,
  onChange,
}: {
  budgetPhp: number | null;
  electricityRatePhpPerKwh: number | null;
  onChange: (changes: {
    budgetPhp?: number | null;
    electricityRatePhpPerKwh?: number | null;
  }) => void;
}) {
  const budgetFieldId = useId();
  const rateFieldId = useId();

  // The rate is held as a draft while it is being typed and committed when the
  // field is left. Every prefix of a rate is also a rate: "1" on the way to
  // "12.5" is a positive number, and nothing in "1" says whether the homeowner
  // is finished. Committing per keystroke would walk the store through ₱1 and
  // ₱12 — recomputing every figure on the screen from each — so the store is
  // told once, when the answer is done.
  const [rateDraft, setRateDraft] = useState(() =>
    rateDraftOf(electricityRatePhpPerKwh),
  );
  const [lastSeenRate, setLastSeenRate] = useState(electricityRatePhpPerKwh);

  // A reset elsewhere puts the default back in the store, and the field has to
  // follow rather than keep showing what was typed into the old session.
  //
  // Adjusted during render rather than in an effect, and only when the draft
  // does not already mean this value — otherwise committing "12.50" would come
  // back as the string "12.5" and rewrite the field under the cursor.
  if (lastSeenRate !== electricityRatePhpPerKwh) {
    setLastSeenRate(electricityRatePhpPerKwh);
    if (parsePositive(rateDraft) !== electricityRatePhpPerKwh) {
      setRateDraft(rateDraftOf(electricityRatePhpPerKwh));
    }
  }

  const budgetDigits = budgetPhp != null ? String(Math.round(budgetPhp)) : "";
  const formattedBudget = budgetDigits
    ? Number(budgetDigits).toLocaleString("en-PH")
    : "";

  const updateBudget = (nextDigits: string) => {
    // An empty field is "no ceiling", which is not the same as a ceiling of
    // zero — the backend treats the absent field as no limit at all.
    onChange({ budgetPhp: nextDigits ? Number(nextDigits) : null });
  };

  const commitRate = () => {
    const parsed = parsePositive(rateDraft);

    // An emptied field is "use the published rate", the same shape as an empty
    // budget meaning no ceiling. A bare "." is the same nothing, reached from
    // the other direction.
    if (parsed == null) {
      setRateDraft("");
      if (electricityRatePhpPerKwh != null) {
        onChange({ electricityRatePhpPerKwh: null });
      }
      return;
    }

    // Tidied to what was actually committed, so "9." does not sit in the field
    // looking like an answer the store never received.
    setRateDraft(String(parsed));

    if (parsed !== electricityRatePhpPerKwh) {
      onChange({ electricityRatePhpPerKwh: parsed });
    }
  };

  const fieldClassName =
    "w-full rounded-xs border border-hairline bg-white px-3 py-2 font-sans text-[15px] text-ink tabular-nums outline-none transition-colors duration-150 ease-brand placeholder:text-tertiary-ink focus-visible:border-cobalt";

  return (
    <details className="group w-full">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-sans text-[13px] font-semibold text-cobalt marker:content-none hover:underline [&::-webkit-details-marker]:hidden">
        Add a budget or your own rate
        <span
          aria-hidden="true"
          className="transition-transform duration-150 ease-brand group-open:rotate-90"
        >
          ›
        </span>
      </summary>

      <div className="flex flex-col gap-3 pt-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={budgetFieldId}
            className="font-sans text-xs text-secondary"
          >
            Budget (optional)
          </label>
          <input
            id={budgetFieldId}
            inputMode="numeric"
            autoComplete="off"
            value={formattedBudget}
            onChange={(event) => updateBudget(digitsOf(event.target.value))}
            placeholder="No limit"
            className={fieldClassName}
          />
          <p className="font-sans text-xs text-tertiary-ink">
            Caps the system at what you can spend. Leave empty for no ceiling.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={rateFieldId}
            className="font-sans text-xs text-secondary"
          >
            Electricity rate (₱/kWh)
          </label>
          <input
            id={rateFieldId}
            inputMode="decimal"
            autoComplete="off"
            value={rateDraft}
            onChange={(event) => setRateDraft(rateDigitsOf(event.target.value))}
            onBlur={commitRate}
            placeholder={String(DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH)}
            className={fieldClassName}
          />
          <p className="font-sans text-xs text-tertiary-ink">
            Leave empty for ₱{DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH}. Your bill
            shows the rate you actually pay.
          </p>
        </div>
      </div>
    </details>
  );
}
