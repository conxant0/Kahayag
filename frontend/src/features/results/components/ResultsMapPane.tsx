// The results pane: the recommended layout drawn over the same satellite
// map roof tracing used, rather than a flattened stand-in for it.
import { useRef } from "react";

import type { GeoPoint } from "../../../shared/api/types";
import { MapSurface } from "../../../shared/components/ui";
import type { GeoTiffRaster } from "../../../integrations/solar/geoTiffLoader";
import type { SelectedProperty } from "../../../state/assessmentStore";
import type { LayoutPanel } from "../panelLayoutUtils";
import { useResultsMap } from "../hooks/useResultsMap";

export function ResultsMapPane({
  selectedProperty,
  roofCoordinates,
  panels,
  status,
  flux = null,
  mask = null,
}: {
  selectedProperty: SelectedProperty | null;
  roofCoordinates: readonly GeoPoint[];
  panels: readonly LayoutPanel[];
  status?: string;
  flux?: GeoTiffRaster | null;
  mask?: GeoTiffRaster | null;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const { fluxRange } = useResultsMap(
    mapContainerRef,
    selectedProperty,
    roofCoordinates,
    panels,
    flux,
    mask,
  );

  return (
    <MapSurface className="relative min-h-0">
      <div
        ref={mapContainerRef}
        aria-label={`Recommended layout: ${panels.length} panels over the traced roof`}
        className="absolute inset-0 min-h-96"
      >
        {/* The map still shows the property pin without a roof trace; only
            the layout it can't draw yet needs saying. */}
        {!selectedProperty ? (
          <div className="flex size-full items-center justify-center bg-paper p-6 font-sans text-sm text-secondary">
            Layout preview unavailable until a property is selected.
          </div>
        ) : roofCoordinates.length < 3 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-paper/90 p-3 text-center font-sans text-sm text-secondary">
            Panel layout unavailable until the roof is traced.
          </div>
        ) : null}
      </div>
      {fluxRange ? (
        <div className="absolute right-3 bottom-3 rounded bg-paper/90 px-2 py-1.5 font-sans text-[10px] text-secondary">
          <p>
            Sunshine: {Math.round(fluxRange.min)}–{Math.round(fluxRange.max)}{" "}
            kWh/kW/yr
          </p>
          <div
            className="mt-1 flex items-center gap-1.5"
            aria-label="Low to high sunshine legend"
          >
            <span>Low</span>
            <span
              className="h-1.5 w-16 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #2b0057, #7a1f9a, #d45c2a, #f08c00, #fff3a3)",
              }}
            />
            <span>High</span>
          </div>
        </div>
      ) : null}
      <p className="sr-only">
        {panels.length} panels shown in the recommended layout.
        {status ? ` ${status}` : ""}
      </p>
    </MapSurface>
  );
}
