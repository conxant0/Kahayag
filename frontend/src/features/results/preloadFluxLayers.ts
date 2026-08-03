// Preloads optional flux data without changing the assessment result.
import type { AssessmentResult, GeoPoint } from "../../shared/api/types";
import type { RoofPolygon } from "../../state/assessmentStore";
import { useFluxCacheStore } from "../../state/fluxCacheStore";
import { loadSolarFluxLayers } from "../../integrations/solar/geoTiffLoader";
import { renderSolarFluxOverlay } from "../../integrations/solar/fluxRenderer";
import { computeFluxCacheKey, needsFluxForPanelLayout } from "./fluxCacheKey";

export async function preloadFluxLayersForAssessment({
  result,
  selectedProperty,
  roofPolygon,
}: {
  result: AssessmentResult | null;
  selectedProperty: GeoPoint | null;
  roofPolygon: RoofPolygon | null;
}): Promise<{ skipped: boolean }> {
  const roofCoordinates = roofPolygon?.coordinates ?? [];
  const panelCount = result?.recommendation.panel_count ?? 0;
  if (
    !needsFluxForPanelLayout({
      shading: result?.shading,
      roofCoordinates,
      panelCount,
    })
  ) {
    useFluxCacheStore.getState().clear();
    return { skipped: true };
  }

  const key = computeFluxCacheKey({ roofCoordinates, selectedProperty });
  const { flux, mask, fluxRequest } = await loadSolarFluxLayers({
    fluxVisualization: result?.shading?.flux_visualization,
    propertyCoordinates: selectedProperty,
    roofCoordinates,
  });
  const rendered = renderSolarFluxOverlay({ flux, mask, roofCoordinates });
  useFluxCacheStore.getState().setEntry({
    key,
    flux,
    mask,
    fluxRequest,
    fluxRange: { min: rendered.min, max: rendered.max },
    fluxCenteredOnTrace:
      rendered.maskedToTrace || fluxRequest.centeredOn === "trace",
  });
  return { skipped: false };
}
