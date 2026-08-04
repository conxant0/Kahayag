// Fetches a structured quotation for the active build, falling back to BOM lines.
import { useQuery } from "@tanstack/react-query";

import { apiPost } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { QuotationDocument } from "../../shared/api/types";
import { useDesignStore } from "../../state/designStore";
import { buildQuotationFromBuild } from "./quotationViewModel";

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

      try {
        return await apiPost<QuotationDocument>(
          ENDPOINTS.designsQuotation(buildId),
          { build_id: buildId, session: designSession },
        );
      } catch {
        return buildQuotationFromBuild(build);
      }
    },
    enabled: Boolean(designSession && buildId),
  });
}
