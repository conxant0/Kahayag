import { useMutation } from "@tanstack/react-query";

import { apiPost } from "../../../shared/api/client";
import { ENDPOINTS } from "../../../shared/api/endpoints";
import type { AssessmentResult } from "../../../shared/api/types";
import {
  buildPanelCountAdjustmentPayload,
  type PanelCountAdjustmentResponse,
} from "../panelCountAdjustment";

export interface AdjustPanelCountVariables {
  result: AssessmentResult;
  requestedPanelCount: number;
}

export function useAdjustPanelCount() {
  return useMutation({
    mutationFn: ({ result, requestedPanelCount }: AdjustPanelCountVariables) =>
      apiPost<PanelCountAdjustmentResponse>(
        ENDPOINTS.panelCountAdjustment,
        buildPanelCountAdjustmentPayload(result, requestedPanelCount),
      ),
  });
}
