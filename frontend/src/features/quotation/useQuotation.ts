// Fetches a structured quotation for the active build, falling back to BOM lines.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiPost } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { QuotationDocument, QuoteAuditResponse } from "../../shared/api/types";
import { useDesignStore } from "../../state/designStore";
import { getActiveBuild } from "../design/designViewModel";
import {
  buildQuotationFromBuild,
  buildQuotationFromQuoteAudit,
} from "./quotationViewModel";

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

export function useActiveQuotation(): {
  data: QuotationDocument | undefined;
  isLoading: boolean;
  error: Error | null;
  mode: "build" | "quote";
  activeQuote: QuoteAuditResponse | null;
} {
  const designSession = useDesignStore((state) => state.designSession);
  const activeQuoteFilename = useDesignStore((state) => state.activeQuoteFilename);
  const quoteAuditResults = useDesignStore((state) => state.quoteAuditResults);
  const activeBuild = getActiveBuild(designSession);
  const activeQuote = useMemo(
    () =>
      activeQuoteFilename
        ? (quoteAuditResults.find((result) => result.filename === activeQuoteFilename) ??
          null)
        : null,
    [activeQuoteFilename, quoteAuditResults],
  );
  const buildQuery = useQuotation(activeQuote ? null : (activeBuild?.id ?? null));
  const uploadedQuote = useMemo(
    () => (activeQuote ? buildQuotationFromQuoteAudit(activeQuote) : undefined),
    [activeQuote],
  );

  if (activeQuote) {
    return {
      data: uploadedQuote,
      isLoading: false,
      error: null,
      mode: "quote",
      activeQuote,
    };
  }

  return {
    data: buildQuery.data,
    isLoading: buildQuery.isLoading,
    error: buildQuery.error,
    mode: "build",
    activeQuote: null,
  };
}
