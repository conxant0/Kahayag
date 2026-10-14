// Defines the page header for the design-flow steps (design, quotation, brief).
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Eyebrow } from "../ui";
import { cn } from "../../lib/cn";

/**
 * The same back link, eyebrow and serif headline the assessment screens open
 * with (see `FlowLayout`), laid out as a full-width row so the step's actions
 * can sit on the right instead of being pinned under a narrow column.
 */
export function StepPageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  lead,
  actions,
  className,
}: {
  backHref?: string;
  backLabel?: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between",
        className,
      )}
    >
      <header className="flex flex-col items-start gap-4">
        {backHref && backLabel ? (
          <Link
            to={backHref}
            className="w-fit font-sans text-sm font-semibold text-cobalt hover:underline print:hidden"
          >
            ← {backLabel}
          </Link>
        ) : null}

        <Eyebrow>{eyebrow}</Eyebrow>

        <h1 className="font-serif text-[32px] leading-tight font-medium text-balance text-ink lg:text-[40px]">
          {title}
        </h1>

        {lead ? (
          <div className="-mt-1 max-w-[620px] font-sans text-[15px] leading-6 text-secondary">
            {lead}
          </div>
        ) : null}
      </header>

      {actions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center print:hidden">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
