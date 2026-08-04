// Defines the D6 permit assessment mutation, wired to the real
// POST /permits/assess. Follows usePermitChat.ts's multipart-upload
// convention: request is a JSON form field, slot_ids/files pair positionally
// with every document uploaded so far — the backend has no session store, so
// each call resends the full upload set (same pattern as the chat endpoint).
import { useMutation } from "@tanstack/react-query";

import { apiUploadForm } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { ApplicantFormValues } from "./ApplicantForm";
import type { PermitAssessment } from "./permitTypes";
import { toApiApplicant } from "./permitsViewModel";

export interface AssessPermitInput {
  applicant: ApplicantFormValues;
  systemKwp: number;
  buildId: string | null;
  propertyAddress: string;
  uploads: ReadonlyMap<string, File>;
}

export function useAssessPermit() {
  return useMutation({
    mutationFn: async (input: AssessPermitInput): Promise<PermitAssessment> => {
      const formData = new FormData();
      formData.append(
        "request",
        JSON.stringify({
          applicant: toApiApplicant(input.applicant),
          system_kwp: input.systemKwp,
          build_id: input.buildId,
          property_address: input.propertyAddress,
        }),
      );
      for (const [documentId, file] of input.uploads) {
        formData.append("slot_ids", documentId);
        formData.append("files", file);
      }
      return apiUploadForm<PermitAssessment>(ENDPOINTS.permitsAssess, formData);
    },
  });
}
