import type { ReactNode } from "react";

import { Eyebrow } from "../../../shared/components/ui";
import { cn } from "../../../shared/lib/cn";

/**
 * The shared shape of every scroll section: full-bleed on mobile, a centred
 * 656px editorial column on desktop, gutters from --gutter (24px -> 38.4px).
 *
 * Sections pass their own vertical rhythm via `className`; everything else —
 * measure, gutter, heading semantics — is fixed here so the eight sections
 * cannot drift apart.
 */
export function EditorialSection({
  eyebrow,
  title,
  titleSize = "step",
  titleId,
  children,
  className,
  align = "start",
  gap = "tight",
  accent = true,
}: {
  eyebrow?: string;
  title?: ReactNode;
  /** Maps to the per-section heading sizes in the type scale. */
  titleSize?: "gap" | "step" | "step2" | "who" | "closing";
  titleId?: string;
  children?: ReactNode;
  className?: string;
  align?: "start" | "center";
  /** Row rhythm as drawn: 10px, 12px, 16px, or 18px on mobile (x1.6 on desktop). */
  gap?: "prose" | "tight" | "roomy" | "closing";
  /** The amber tick under the eyebrow. Off for sections with no eyebrow. */
  accent?: boolean;
}) {
  const headingSize = {
    gap: "text-(length:--t-gap-title)",
    step: "text-(length:--t-step-title)",
    step2: "text-(length:--t-step2-title)",
    who: "text-(length:--t-who-title)",
    closing: "text-(length:--t-closing-title)",
  }[titleSize];

  const rowGap = {
    prose: "gap-3 lg:gap-4",
    tight: "gap-4 lg:gap-[19.2px]",
    roomy: "gap-5 lg:gap-[25.6px]",
    closing: "gap-[18px] lg:gap-[28.8px]",
  }[gap];

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "mx-auto flex w-full flex-col px-(--gutter) lg:w-220",
        rowGap,
        align === "center" ? "items-center text-center" : "items-start",
        className,
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            "flex items-center gap-3",
            align === "center" && "justify-center",
          )}
        >
          {/* The brandbook's amber underline, used as a tick that marks the top
           * of every section — the one repeated note of colour on a page that
           * is otherwise ink on paper. */}
          {accent ? (
            <span
              aria-hidden="true"
              className="h-(--rule-h) w-6 shrink-0 rounded-full bg-sun lg:w-9"
            />
          ) : null}

          <Eyebrow size="section">{eyebrow}</Eyebrow>
        </span>
      ) : null}

      {title ? (
        <h2
          id={titleId}
          className={cn(
            "w-full font-serif font-medium text-balance text-ink",
            headingSize,
          )}
        >
          {title}
        </h2>
      ) : null}

      {children}
    </section>
  );
}
