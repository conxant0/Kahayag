// Defines the five-step progress indicator for the D3 design flow.
import { Link } from "react-router-dom";

import { ROUTE_PATHS } from "../../../app/routePaths";
import { cn } from "../../lib/cn";

const STEPS = [
  { label: "Roof trace", path: ROUTE_PATHS.trace },
  { label: "Bill input", path: ROUTE_PATHS.energy },
  { label: "Results", path: ROUTE_PATHS.results },
  { label: "AI design", path: ROUTE_PATHS.design },
  { label: "Quotation", path: ROUTE_PATHS.quotation },
] as const;

export type DesignFlowStep = 1 | 2 | 3 | 4 | 5;

export function DesignFlowStepper({ activeStep }: { activeStep: DesignFlowStep }) {
  return (
    <nav aria-label="Assessment progress" className="w-full">
      <ol className="flex flex-wrap gap-x-2 gap-y-1">
        {STEPS.map((step, index) => {
          const stepNumber = (index + 1) as DesignFlowStep;
          const isActive = stepNumber === activeStep;
          const isComplete = stepNumber < activeStep;

          return (
            <li key={step.label} className="flex items-center gap-2">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-sans text-[11px] text-tertiary-ink",
                    isComplete || isActive ? "text-cobalt" : undefined,
                  )}
                >
                  →
                </span>
              ) : null}
              <Link
                to={step.path}
                className={cn(
                  "rounded-pill px-2 py-1 font-sans text-[11px] font-semibold tracking-[0.6px] uppercase",
                  "transition-colors duration-150 ease-brand",
                  isActive && "bg-sun text-ink",
                  isComplete && !isActive && "text-cobalt hover:underline",
                  !isActive && !isComplete && "text-tertiary-ink hover:text-ink",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
