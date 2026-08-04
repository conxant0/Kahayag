import type { RefObject } from "react";

import { InfoPill } from "../../../shared/components/ui";
import type { SelectedProperty } from "../../../state/assessmentStore";

export function RoofTracePane({
  mapContainerRef,
  selectedProperty,
  isTracing,
}: {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  selectedProperty: SelectedProperty | null;
  isTracing: boolean;
}) {
  return (
    <div className="absolute inset-0 min-h-56">
      <div
        ref={mapContainerRef}
        aria-label="Roof tracing satellite map"
        className="absolute inset-0"
      >
        {!selectedProperty && (
          <div className="flex size-full items-center justify-center bg-paper p-6 font-sans text-sm text-secondary">
            Select a property first to trace your roof on the satellite map.
          </div>
        )}
      </div>

      {/* The mode has to be visible on the map itself: while it is on, every
          click drops a corner, and the one mistake worth designing against is
          not realising that. The pill floats clear of pointer events so it
          never eats the click it is describing. */}
      {isTracing && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
        >
          <InfoPill tone="ink">
            <span
              aria-hidden
              className="size-2 animate-pulse rounded-full bg-sun"
            />
            Tracing — each click adds a corner
          </InfoPill>
        </div>
      )}
    </div>
  );
}
