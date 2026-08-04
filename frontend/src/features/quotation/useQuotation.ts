// Fetches the structured quotation for the active build from the backend.
// No client-side fallback on failure: a quotation is a contractual document
// the domain composes (quote number, dates, terms) — fabricating one in the
// browser would violate the "domain computes" rule and mint quote numbers no
// backend record matches. Failures surface as errors instead.
import { useQuery } from "@tanstack/react-query";

import { apiPost } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { QuotationDocument } from "../../shared/api/types";
import { useDesignStore } from "../../state/designStore";

export function useQuotation(buildId: string | null) {
  const designSession = useDesignStore((state) => state.designSession);

  return useQuery({
    queryKey: ["quotation", buildId, designSession?.assessment_fingerprint],
    queryFn: async (): Promise<QuotationDocument> => {
      if (!designSession || !buildId) {
        throw new Error("Design session is not ready.");
      }

      const build = designSession.builds.find((candidate) => candidate.id === buildId);
      if (!build) {
        throw new Error("Selected build was not found.");
      }

      return apiPost<QuotationDocument>(ENDPOINTS.designsQuotation(buildId), {
        build_id: buildId,
        session: designSession,
      });
    },
    enabled: Boolean(designSession && buildId),
  });
}
