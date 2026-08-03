// Defines the label/value rows that carry assessment figures, plus the bare rule.
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type HairlineRowSize = "md" | "lg";

/**
 * A description list, not a stack of divs: the pairing between a label and its
 * figure is the whole point of the component, and `dl` is what carries that
 * pairing to a screen reader.
 */
export function HairlineList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <dl className={cn("w-full", className)}>{children}</dl>;
}

/**
 * One row. `size="lg"` is the long-form variant the brief and investment
 * screens use, where the same row runs at 21px on the wide column.
 *
 * The first row drops its top border so a list never opens on a stray rule.
 */
export function HairlineRow({
  label,
  value,
  size = "md",
  valueClassName,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  size?: HairlineRowSize;
  /** Lets a row mark its figure as engine output, per the colour rule. */
  valueClassName?: string;
  className?: string;
}) {
  const large = size === "lg";

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-t border-hairline py-3.25 first:border-t-0",
        large && "gap-4 py-3.5 lg:gap-4.5 lg:py-[16.5px]",
        className,
      )}
    >
      <dt
        className={cn(
          "min-w-0 flex-1 font-sans text-secondary",
          large ? "text-[16px] lg:text-[21px]" : "text-sm",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "shrink-0 font-sans font-semibold text-ink",
          large ? "text-[16px] lg:text-[21px]" : "text-base",
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The bare separator between editorial blocks. Its height is a token so it can
 * thicken with the rest of the scale on the desktop column.
 */
export function Rule({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={cn("h-(--rule-h) w-full shrink-0 bg-hairline", className)}
    />
  );
}
