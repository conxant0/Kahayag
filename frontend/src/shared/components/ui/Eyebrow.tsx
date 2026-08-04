// Defines the tracked uppercase label that sits above a heading.
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type EyebrowTone = "tertiary" | "cobalt" | "ember";
export type EyebrowSize = "ui" | "section";

const toneClasses: Record<EyebrowTone, string> = {
  // The darkened sibling of the brandbook tertiary, which clears AA as text.
  tertiary: "text-tertiary-ink",
  // Cobalt informs — reserved for a label reporting something the engine found.
  cobalt: "text-cobalt",
  // Ember interrupts — reserved for a label over something that blocks the flow.
  ember: "text-ember",
};

/**
 * Two sizes, because the label lives in two type systems.
 *
 * `ui` is the fixed 11px in-app label — "STEP 1 OF 4". `section` joins the
 * editorial scale and grows with it on the wide column, so a landing section
 * keeps its proportion to the heading underneath.
 */
export function Eyebrow({
  children,
  size = "ui",
  tone = "tertiary",
  as: Tag = "p",
  className,
}: {
  children: ReactNode;
  size?: EyebrowSize;
  tone?: EyebrowTone;
  as?: "p" | "span" | "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "font-sans font-semibold uppercase",
        toneClasses[tone],
        size === "ui"
          ? "text-[11px] tracking-[1.4px]"
          : "text-(length:--t-eyebrow) tracking-(--t-eyebrow-track)",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
