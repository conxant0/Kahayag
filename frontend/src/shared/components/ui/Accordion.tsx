// Defines a collapsible section list built on native <details>/<summary>, so
// keyboard and screen-reader open/close state comes free instead of hand-rolled.
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

/** A stack of collapsible sections, ruled top and bottom like a HairlineList. */
export function Accordion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col divide-y divide-hairline border-t border-b border-hairline",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * One section. The label reuses the app's section-heading style (tracked
 * cobalt caps) so a panel reads the same open or closed.
 */
export function AccordionItem({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={cn("group py-4 first:pt-0 last:pb-0", className)}
      open={defaultOpen}
    >
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 font-sans text-sm font-semibold tracking-[1.2px] text-cobalt uppercase marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
        <span
          aria-hidden
          className="shrink-0 text-[10px] text-tertiary-ink transition-transform duration-200 group-open:rotate-180"
        >
          ▼
        </span>
      </summary>
      <div className="flex flex-col gap-4 pt-3.5">{children}</div>
    </details>
  );
}
