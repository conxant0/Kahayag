// Defines the roof figure that opens the project brief.
import type { RoofPolygon, SelectedProperty } from "../../../state/assessmentStore";
import { ResultsMapPane } from "../../results/components/ResultsMapPane";
import { layoutPanelsInPolygon } from "../../results/panelLayoutUtils";

/**
 * The traced roof with its panels over the same satellite map the tracing
 * used, framed as the brief's opening figure.
 *
 * When the map cannot load, the pane falls back to the flat drawing. Either
 * way the caption names the outline as the homeowner's own trace — an
 * installer reading this page needs to know it is not a survey.
 */
export function BriefRoofPhoto({
  locationLabel,
  selectedProperty,
  roofPolygon,
  panelCount,
  panelWidthM,
  panelHeightM,
}: {
  locationLabel: string;
  selectedProperty: SelectedProperty | null;
  roofPolygon: RoofPolygon | null;
  panelCount: number;
  panelWidthM: number;
  panelHeightM: number;
}) {
  const roofCoordinates = roofPolygon?.coordinates ?? [];
  const panels = layoutPanelsInPolygon({
    coordinates: roofCoordinates,
    panelCount,
    panelWidthM,
    panelHeightM,
  });

  return (
    // h-96 matches the map pane's own min-height, so the satellite view is
    // never cropped by the frame.
    <div className="relative h-96 w-full overflow-hidden rounded-3xl">
      <ResultsMapPane
        selectedProperty={selectedProperty}
        roofCoordinates={roofCoordinates}
        panels={panels}
        status={`Roof layout at ${locationLabel}`}
        fitPadding={120}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 py-3">
        <p className="font-sans text-[13px] font-medium text-white">
          Roof layout · {locationLabel}
        </p>
      </div>
    </div>
  );
}
