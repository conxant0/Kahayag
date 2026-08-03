// Defines the selectable pill used for quick-pick values.
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

export type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

/**
 * Cobalt informs, so a chosen chip paints cobalt rather than sun: picking one
 * tells the engine what to work with, it does not advance the flow.
 *
 * Passing no `onClick` gives the read-only variant — disabled, and with no
 * `aria-pressed`, so assistive tech is not told about a toggle that isn't there.
 */
export function Chip({
  children,
  selected = false,
  onClick,
  className,
  ...rest
}: ChipProps) {
  const interactive = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={interactive ? selected : undefined}
      className={cn(
        "rounded-pill px-3.5 py-2 font-sans text-[13px]",
        "transition-[background-color,border-color,color] duration-150 ease-brand",
        selected
          ? "bg-cobalt font-semibold text-paper"
          : "border border-hairline bg-white font-medium text-secondary",
        // 33px painted box; the invisible strip lifts the pointer target to 44px
        // without shifting a single pixel of the chip itself.
        interactive &&
          "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
        interactive && !selected && "hover:border-tertiary hover:text-ink",
        // The read-only variant is disabled for semantics, not to look inert.
        !interactive && "disabled:opacity-100",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
