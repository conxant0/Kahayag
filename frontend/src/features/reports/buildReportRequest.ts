// Builds the exact PDF report request payload from assessment and roof state.
import { layoutPanelsInPolygon } from "../results/panelLayoutUtils";
import type {
  AssessmentResult,
  DesignBuild,
  GeoPoint,
  RoofPolygon,
} from "../../shared/api/types";

export interface PanelPolygon {
  corners: [GeoPoint, GeoPoint, GeoPoint, GeoPoint];
}

export interface ReportPdfRequest {
  assessment: AssessmentResult;
  roof_polygon: GeoPoint[];
  panel_polygons: PanelPolygon[];
  // The chosen D3 build, when the homeowner went through that flow. The
  // backend recomposes the quotation from it and prints both in the PDF.
  design_build?: DesignBuild;
}

export function buildReportRequest({
  result,
  roofPolygon,
  designBuild = null,
}: {
  result: AssessmentResult | null;
  roofPolygon: RoofPolygon | null;
  designBuild?: DesignBuild | null;
}): ReportPdfRequest {
  const roof = roofPolygon?.coordinates ?? [];
  if (!result || roof.length < 3) {
    throw new Error(
      "Complete the assessment and roof trace before downloading the report.",
    );
  }
  const panels = layoutPanelsInPolygon({
    coordinates: roof,
    panelCount: result.recommendation.panel_count,
    panelWidthM: Number(result.assumptions.panel_width_m),
    panelHeightM: Number(result.assumptions.panel_height_m),
  });
  if (panels.length !== result.recommendation.panel_count) {
    throw new Error(
      "Could not fit the selected panel count inside the roof trace.",
    );
  }
  return {
    assessment: result,
    roof_polygon: roof,
    panel_polygons: panels.map((panel) => ({
      corners: panel.corners,
    })),
    ...(designBuild ? { design_build: designBuild } : {}),
  };
}
