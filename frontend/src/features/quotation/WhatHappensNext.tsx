// Defines the numbered post-acceptance stepper on the quotation screen.
import { NEXT_STEPS } from "./quotationViewModel";

export function WhatHappensNext() {
  return (
    <section
      className="rounded-[20px] border border-hairline bg-white p-5 print:hidden"
      aria-label="What happens next"
    >
      <h2 className="font-sans text-sm font-semibold text-ink">
        What happens next
      </h2>
      <ol className="mt-4 flex flex-col gap-4">
        {NEXT_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-sun font-sans text-xs font-semibold text-ink">
              {index + 1}
            </span>
            <div>
              <p className="font-sans text-sm font-semibold text-ink">
                {step.title}
              </p>
              <p className="mt-0.5 font-sans text-[13px] leading-5 text-secondary">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
