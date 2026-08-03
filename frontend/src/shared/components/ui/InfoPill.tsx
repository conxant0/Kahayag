// Defines the small captioning pill that labels a figure or a map overlay.
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type InfoPillTone = "cobalt" | "ink";

/**
 * Cobalt informs: this is the engine annotating something, never an action, so
 * it is never sun and never a button.
 *
 * `tone="ink"` is for pills that sit over the traced roof, where a cobalt fill
 * would compete with the cobalt outline underneath it.
 */
export function InfoPill({
  children,
  tone = "cobalt",
  className,
}: {
  children: ReactNode;
  tone?: InfoPillTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-pill px-3.5 py-[9px]",
        "font-sans text-[11px] font-semibold whitespace-nowrap",
        tone === "cobalt"
          ? "bg-cobalt-veil text-info-pill-text"
          : "bg-ink-veil text-paper",
        className,
      )}
    >
      {children}
    </span>
  );
}
