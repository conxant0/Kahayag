import { useMemo, useRef } from "react";

import { FlowLayout } from "../../shared/components/layout";
import { MapSurface } from "../../shared/components/ui";
import { ROUTE_PATHS } from "../../app/routePaths";
import { useAssessmentStore } from "../../state/assessmentStore";
import { RoofTraceControls } from "./components/RoofTraceControls";
import { RoofTraceHint } from "./components/RoofTraceHint";
import { RoofTracePane } from "./components/RoofTracePane";
import { useRoofTracing } from "./hooks/useRoofTracing";
import { resolveRoofTraceStage } from "./roofTraceStage";
import { isValidRoofTrace } from "./roofUtils";

/**
 * /trace — Figma 2170:57 (desktop) and 2132:55 (mobile).
 *
 * The pane shows a satellite map for roof tracing once a property has been
 * selected on the previous step.
 *
 * Laid out like /locate on a phone: the map fills the screen and the controls
 * float over it. Tracing is a task performed *on* the map, so any layout that
 * pushes the map into a slot below the copy is working against the step.
 */
export function RoofPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const storedRoofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const roofTracing = useRoofTracing(mapContainerRef, selectedProperty);
  const canContinue = useMemo(() => {
    if (isValidRoofTrace(storedRoofPolygon?.coordinates)) {
      return true;
    }

    return isValidRoofTrace(roofTracing.roofCoordinates);
  }, [roofTracing.roofCoordinates, storedRoofPolygon?.coordinates]);

  const stage = resolveRoofTraceStage({
    mapStatus: roofTracing.googleStatus,
    hasProperty: Boolean(selectedProperty),
    isTracingRoof: roofTracing.isTracingRoof,
    isFittingOutline: roofTracing.isFittingOutline,
    vertexCount: roofTracing.roofCoordinates.length,
    hasConfirmedPolygon: Boolean(storedRoofPolygon),
  });

  return (
    <FlowLayout
      step="Step 2 of 5"
      title="Trace your roof."
      backHref={ROUTE_PATHS.locate}
      backLabel="Back to location"
      nextHref={ROUTE_PATHS.energy}
      nextLabel="Next: Your bill"
      nextDisabled={!canContinue}
      mobilePaneBehind
      pane={
        <MapSurface className="relative min-h-0 rounded-none border-0 lg:rounded-none lg:border">
          <RoofTracePane
            mapContainerRef={mapContainerRef}
            selectedProperty={selectedProperty}
          />
        </MapSurface>
      }
      lead={<RoofTraceHint stage={stage} />}
    >
      <RoofTraceControls
        stage={stage}
        vertexCount={roofTracing.roofCoordinates.length}
        roofMetrics={roofTracing.roofMetrics}
        validationMessage={roofTracing.validationMessage}
        startRoofTracing={() => void roofTracing.startRoofTracing()}
        finishRoofTracing={roofTracing.finishRoofTracing}
        resetRoofTracing={roofTracing.resetRoofTracing}
        redrawRoofTracing={() => void roofTracing.redrawRoofTracing()}
      />
    </FlowLayout>
  );
}
