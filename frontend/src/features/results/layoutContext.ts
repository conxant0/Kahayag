import type { AssessmentResult, GeoPoint } from "../../shared/api/types";
import type { RoofPolygon as AssessmentStoreRoofPolygon } from "../../state/assessmentStore";
import { layoutPanelsInPolygon } from "./panelLayoutUtils";

export interface LayoutContext {
  coordinates: GeoPoint[];
  panelWidthM: number;
  panelHeightM: number;
  currentPanelCount: number;
  recommendedPanelCount: number;
  maxPanels: number;
}

function positiveNumber(value: number | string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveLayoutContext({
  result,
  roofPolygon,
}: {
  result: AssessmentResult;
  roofPolygon: AssessmentStoreRoofPolygon | null;
}): LayoutContext {
  const coordinates = roofPolygon?.coordinates ?? [];
  const panelWidthM = positiveNumber(result.assumptions.panel_width_m, 1.13);
  const panelHeightM = positiveNumber(result.assumptions.panel_height_m, 1.76);
  const currentPanelCount = result.recommendation.panel_count;

  // The scan ceiling is what the traced area could hold if packing were
  // perfect (area ÷ panel area) — per the PRD, roof capacity is what
  // establishes the maximum panel count, so no fixed constant can clamp a
  // large roof short. The placement scan then reports how many actually fit.
  const panelAreaSqm = panelWidthM * panelHeightM;
  const scanCeiling = Math.max(
    1,
    Math.ceil(positiveNumber(roofPolygon?.areaSquareMeters, 0) / panelAreaSqm),
  );
  const maxPanels = coordinates.length
    ? layoutPanelsInPolygon({
        coordinates,
        panelCount: scanCeiling,
        panelWidthM,
        panelHeightM,
      }).length
    : 0;

  return {
    coordinates,
    panelWidthM,
    panelHeightM,
    currentPanelCount,
    recommendedPanelCount: currentPanelCount,
    maxPanels,
  };
}
