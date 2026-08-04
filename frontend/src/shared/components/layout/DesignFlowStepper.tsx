// Defines the six-step progress indicator for the D3 design flow (D6 adds
// the permits step after Quotation).
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

export function DesignFlowStepper({ activeStep }: { activeStep: DesignFlowStep }) {
  return (
    <nav aria-label="Assessment progress" className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-center gap-0">
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
                    "mx-2 h-px w-6 sm:mx-3 sm:w-10",
                    isComplete || isActive ? "bg-ink" : "bg-hairline",
                  )}
                />
              ) : null}
              <Link
                to={step.path}
                className={cn(
                  "flex items-center gap-2 font-sans text-[12px] font-semibold tracking-[0.4px]",
                  "transition-colors duration-150 ease-brand",
                  isActive && "text-ink",
                  isComplete && !isActive && "text-ink hover:underline",
                  !isActive && !isComplete && "text-tertiary hover:text-ink",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-pill text-[11px]",
                    isActive && "bg-ink text-paper",
                    isComplete && !isActive && "bg-sun text-ink",
                    !isActive && !isComplete && "bg-[#f2eee4] text-tertiary",
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
