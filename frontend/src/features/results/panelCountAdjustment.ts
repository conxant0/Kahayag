import type { AssessmentResult } from "../../shared/api/types";

export type PanelCountAdjustmentRequest = Pick<
  AssessmentResult,
  "property" | "roof" | "inputs"
> & {
  requested_panel_count: number;
};

export type PanelCountAdjustmentResponse = Pick<
  AssessmentResult,
  "recommendation" | "financials"
>;

export function buildPanelCountAdjustmentPayload(
  result: AssessmentResult,
  requestedPanelCount: number,
): PanelCountAdjustmentRequest {
  return {
    property: result.property,
    roof: result.roof,
    inputs: result.inputs,
    requested_panel_count: requestedPanelCount,
  };
}

export function mergePanelAdjustment(
  result: AssessmentResult,
  adjustment: PanelCountAdjustmentResponse,
): AssessmentResult {
  return {
    ...result,
    recommendation: adjustment.recommendation,
    financials: adjustment.financials,
  };
}
