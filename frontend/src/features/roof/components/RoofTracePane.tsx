import type { RefObject } from "react";

import type { SelectedProperty } from "../../../state/assessmentStore";

export function RoofTracePane({
  mapContainerRef,
  selectedProperty,
}: {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  selectedProperty: SelectedProperty | null;
}) {
  return (
    <div
      ref={mapContainerRef}
      aria-label="Roof tracing satellite map"
      className="absolute inset-0 min-h-56"
    >
      {!selectedProperty && (
        <div className="flex size-full items-center justify-center bg-paper p-6 font-sans text-sm text-secondary">
          Select a property first to trace your roof on the satellite map.
        </div>
      )}
    </div>
  );
}
