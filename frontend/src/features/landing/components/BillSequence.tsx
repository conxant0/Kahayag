import { Chip } from "../../../shared/components/ui";
import { cn } from "../../../shared/lib/cn";
import type { useBillSequence } from "../hooks/useBillSequence";

/**
 * The animated bill card — Figma 2166:2 / 2169:87.
 *
 * Three beats: the cobalt progress line sweeps, the digits type in behind a
 * blinking cobalt caret, then the amber underline draws left to right. Cobalt
 * informs (the engine reading the bill); the underline is amber because it is
 * measuring money.
 *
 * The sequence is owned by StepTwoSection rather than started here, because the
 * payoff figure below the card has to wait for this to finish. The card renders
 * the state; it does not decide when it runs.
 */
const PRESETS = ["₱2,500", "₱4,800", "₱8,000"];

export function BillSequence({
  bill,
}: {
  bill: ReturnType<typeof useBillSequence>;
}) {
  const { phase, typed, fullValue } = bill;

  const started = phase !== "idle";
  const showCaret = phase === "typing";
  const showUnderline = phase === "underline" || phase === "done";

  /**
   * Whether anything has been read off the bill yet — keyed on the text, not
   * the phase. The phase flips to "typing" one tick before the first character
   * actually lands, so keying on it left the field showing a bare ₱ for 130ms
   * between the 0 and the 4.
   */
  const reading = typed.length === 0;

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-(--card-radius) border border-hairline bg-white px-(--card-pad-x) py-(--card-pad-y) lg:gap-4 lg:border-[1.6px]">
      <div className="flex w-full items-center gap-2.5 lg:gap-4">
        <p className="font-sans text-(length:--t-micro) font-semibold tracking-(--t-micro-track) text-cobalt">
          Auto-filling from your bill
        </p>

        <div className="h-0.75 min-w-0 flex-1 overflow-hidden rounded-xs bg-hairline lg:h-[4.8px]">
          <div
            className={cn(
              "h-full rounded-xs bg-cobalt",
              started && "bill-progress-sweep",
            )}
            style={{ width: started ? undefined : 0 }}
          />
        </div>
      </div>

      <p className="font-sans text-(length:--t-micro) font-semibold tracking-(--t-micro-track) text-tertiary-ink">
        Monthly electricity bill
      </p>

      {/* The live value. aria-hidden while typing so the digits are not announced
       * character by character; the settled figure is exposed once done. */}
      <p
        className="flex items-center gap-1 font-serif text-(length:--t-bill) font-medium text-ink lg:gap-[6.4px]"
        aria-hidden={phase !== "done"}
      >
        {/* Until a digit has been read the field reads ₱0 — an empty bill box,
         * the state the card is about to fill in. After that it is only ever
         * the characters actually typed so far.
         *
         * The master (2166:8) previews the remaining digits ghosted at 22%
         * behind the caret. That is dropped deliberately: showing 4,800 before
         * it has been read puts the answer on screen ahead of the question, and
         * the typing reads as a reveal rather than a measurement. */}
        <span>₱{reading ? "0" : typed}</span>

        <span
          className={cn(
            "w-0.75 bg-cobalt lg:w-[4.8px]",
            "h-[calc(var(--t-bill)*0.815)]",
            showCaret ? "bill-caret" : "invisible",
          )}
          aria-hidden="true"
        />
      </p>

      {phase !== "done" ? (
        <span className="sr-only">Reading ₱{fullValue} from your bill</span>
      ) : null}

      {/* Amber underline — money being measured. */}
      <div
        className={cn(
          "h-0.75 bg-sun lg:h-[4.8px]",
          "w-40 lg:w-64",
          showUnderline ? "bill-underline" : "scale-x-0",
        )}
      />

      <div className="flex flex-wrap gap-1.5 pt-1 lg:gap-[9.6px] lg:pt-[6.4px]">
        {PRESETS.map((preset) => (
          <Chip
            key={preset}
            selected={preset === `₱${fullValue}`}
            className="px-2.75 py-1.5 text-[11px] lg:px-[17.6px] lg:py-[9.6px] lg:text-[17.6px]"
          >
            {preset}
          </Chip>
        ))}
      </div>
    </div>
  );
}
