// Defines the scroll-triggered fade and rise applied to editorial blocks.
import type { CSSProperties, ElementType, ReactNode } from "react";

import { useInView } from "../../hooks/useInView";
import { cn } from "../../lib/cn";

/**
 * Flips `.reveal` to `.reveal-in` the first time the block reaches the viewport.
 *
 * The transition itself lives in the stylesheet so reduced motion can neutralise
 * it without JavaScript ever running. This component only decides *when*.
 *
 * The thresholds are deliberately looser than the hook's defaults: a reveal that
 * never fires leaves real content at `opacity: 0`, so the bar for triggering is
 * "any part of it is on screen" rather than a fifth of it clearing a dead band.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  /** Stagger in ms. A section usually steps its children by 60–80. */
  delay?: number;
  as?: "div" | "section" | "li" | "p";
  className?: string;
}) {
  const [ref, hasEntered] = useInView<HTMLElement>({
    threshold: 0,
    rootMargin: "0px 0px -2% 0px",
  });

  // Each tag in the `as` union carries a different ref type; widening once here
  // keeps every call site free of a per-tag generic.
  const Component = Tag as ElementType;

  return (
    <Component
      ref={ref}
      style={
        delay
          ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties)
          : undefined
      }
      className={cn("reveal", hasEntered && "reveal-in", className)}
    >
      {children}
    </Component>
  );
}
