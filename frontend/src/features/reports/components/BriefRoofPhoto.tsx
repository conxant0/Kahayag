// Defines the roof figure that opens the project brief.
import type { RoofPolygon } from "../../../state/assessmentStore";
import { PanelLayoutPreview } from "../../results/components/PanelLayoutPreview";
import { layoutPanelsInPolygon } from "../../results/panelLayoutUtils";

/**
 * The traced roof with its panels, framed as the brief's opening figure.
 *
 * It is a drawing, not an aerial photo, and the caption says so — an installer
 * reading this page needs to know the outline is the homeowner's own trace
 * rather than a survey, and a screen-reader user announced "aerial photo" would
 * have no way to tell.
 */
export function BriefRoofPhoto({
  locationLabel,
  roofPolygon,
  panelCount,
  panelWidthM,
  panelHeightM,
}: {
  locationLabel: string;
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
    <div className="relative h-40 w-full overflow-hidden rounded-3xl lg:h-48">
      <PanelLayoutPreview
        roofCoordinates={roofCoordinates}
        panels={panels}
        status={`Roof layout at ${locationLabel}`}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 py-3">
        <p className="font-sans text-[13px] font-medium text-white">
          Roof layout · {locationLabel}
        </p>
      </div>
    </div>
  );
}
