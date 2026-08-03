// Defines the framed surface that map and canvas panes are drawn into.
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * The pane behind the locate, trace and results screens.
 *
 * It owns only the frame — border, radius, clipping, and the minimum height
 * that stops an empty pane collapsing. What goes inside it comes from a map
 * adapter under `src/integrations/`, and this component stays unaware of which
 * provider that is.
 *
 * The radius drops on the wide layout, where the pane runs to the edge of the
 * viewport and a rounded corner would float it off the page.
 */
export function MapSurface({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative size-full min-h-56 overflow-hidden border border-hairline bg-paper",
        "rounded-map lg:rounded-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
