// Defines the six-step progress indicator for the D3 design flow. Permits is
// the last step now that the pipeline runs quotation → brief → permits.
import { Link } from "react-router-dom";

import { ROUTE_PATHS } from "../../../app/routePaths";
import { cn } from "../../lib/cn";

const STEPS = [
  { label: "Roof trace", path: ROUTE_PATHS.trace },
  { label: "Bill input", path: ROUTE_PATHS.energy },
  { label: "Results", path: ROUTE_PATHS.results },
  { label: "AI design", path: ROUTE_PATHS.design },
  { label: "Quotation", path: ROUTE_PATHS.quotation },
  { label: "Permits", path: ROUTE_PATHS.permits },
] as const;

export type DesignFlowStep = 1 | 2 | 3 | 4 | 5 | 6;

function CheckIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One pill holds the whole journey so it reads as a single control, centred
 * over the page. Every step shares the same circle; only its fill says where
 * it sits: sun for done, ink for here, an outline for still to come. The rule
 * between two steps is ink once the step it leads to has been reached.
 */
export function DesignFlowStepper({
  activeStep,
}: {
  activeStep: DesignFlowStep;
}) {
  return (
    <nav aria-label="Assessment progress" className="w-full overflow-x-auto">
      <ol className="mx-auto flex w-max items-center rounded-pill border border-hairline bg-white px-2 py-1.5 shadow-[0_2px_8px_rgba(26,23,18,0.04)] sm:px-3">
        {STEPS.map((step, index) => {
          const stepNumber = (index + 1) as DesignFlowStep;
          const isActive = stepNumber === activeStep;
          const isComplete = stepNumber < activeStep;

          return (
            <li key={step.label} className="flex items-center">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1.5 h-px w-4 sm:mx-2 sm:w-6",
                    isComplete || isActive ? "bg-ink" : "bg-hairline",
                  )}
                />
              ) : null}
              <Link
                to={step.path}
                className={cn(
                  "flex items-center gap-2 rounded-pill py-1 pr-1 pl-1 font-sans text-[12px] font-semibold tracking-[0.4px] sm:pr-2.5",
                  "transition-colors duration-150 ease-brand",
                  isActive && "bg-[#f2eee4] text-ink",
                  isComplete && "text-ink hover:bg-[#f7f4ed]",
                  !isActive &&
                    !isComplete &&
                    "text-tertiary-ink hover:bg-[#f7f4ed] hover:text-ink",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-pill text-[11px]",
                    isActive && "bg-ink text-paper",
                    isComplete && "bg-sun text-ink",
                    !isActive &&
                      !isComplete &&
                      "border border-hairline bg-white text-tertiary-ink",
                  )}
                >
                  {isComplete ? <CheckIcon /> : stepNumber}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
