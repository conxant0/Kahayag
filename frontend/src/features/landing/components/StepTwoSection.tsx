import { Eyebrow } from "../../../shared/components/ui";
import { useInView } from "../../../shared/hooks/useInView";
import { useBillSequence } from "../hooks/useBillSequence";
import { useCountUp } from "../hooks/useCountUp";

import { BillSequence } from "./BillSequence";
import { EditorialSection } from "./EditorialSection";

const MONTHLY_SAVING = 4850;

/**
 * Step 02 — Figma 2140:16 / 2169:84. The one section that moves on its own.
 *
 * The sequence is owned here rather than inside the card, because the two halves
 * of the section are one sentence: the bill is read, *and then* it becomes
 * ₱4,850. The payoff waits for the card to finish so the causality is legible —
 * running both from the in-view trigger had the answer arriving while the
 * question was still being typed.
 */
export function StepTwoSection() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.25 });
  const bill = useBillSequence(inView);
  const counted = useCountUp(MONTHLY_SAVING, bill.phase === "done");

  return (
    <EditorialSection
      eyebrow="Step 02"
      title="Tell us your bill. Watch the numbers move."
      titleSize="step2"
      titleId="step-02"
      gap="roomy"
      className="pt-10 pb-8 lg:pt-[76.8px] lg:pb-8"
    >
      <div ref={ref} className="flex w-full flex-col gap-4 lg:gap-[25.6px]">
        <BillSequence bill={bill} />

        <p className="font-serif text-(length:--t-aside) text-secondary italic">
          …and watch it become
        </p>

        {/* The payoff. Counts up from zero on scroll-in. A paragraph takes no
         * aria-label, so the settled figure is carried by visually hidden text
         * while the ticking number is hidden from assistive tech. */}
        <p className="font-serif text-(length:--t-payoff) leading-none font-medium text-ink">
          <span aria-hidden="true">₱{counted.toLocaleString("en-PH")}</span>
          <span className="sr-only">
            ₱{MONTHLY_SAVING.toLocaleString("en-PH")}
          </span>
        </p>

        <p className="flex items-center gap-1.75 lg:gap-[11.2px]">
          <span
            aria-hidden="true"
            className="size-3.25 shrink-0 rounded-full bg-sun lg:size-[20.8px]"
          />
          <span className="font-sans text-(length:--t-saved) font-medium text-secondary">
            saved monthly · Pajo, Lapu-Lapu City
          </span>
        </p>

        <Eyebrow size="section" tone="cobalt">
          92% prediction confidence
        </Eyebrow>
      </div>
    </EditorialSection>
  );
}
