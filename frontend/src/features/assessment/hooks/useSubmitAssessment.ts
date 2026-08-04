// Defines the assessment-submission orchestration hook.
import { useMutation } from "@tanstack/react-query";

import { apiPost } from "../../../shared/api/client";
import { ENDPOINTS } from "../../../shared/api/endpoints";
import {
  useAssessmentStore,
  type CompletedAssessment,
} from "../../../state/assessmentStore";
import type { AssessmentRequest } from "../buildAssessmentPayload";

/**
 * Submits the assessment and parks the response in session state.
 *
 * The result is stored opaquely: the store's job is to say whether one exists,
 * and the results feature narrows it where the fields are read.
 */
export function useSubmitAssessment() {
  const setResult = useAssessmentStore((state) => state.setResult);

  return useMutation({
    mutationFn: (payload: AssessmentRequest) =>
      apiPost<CompletedAssessment>(ENDPOINTS.assessments, payload),
    onSuccess: (result) => setResult(result),
  });
}
