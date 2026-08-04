// Uploads an outside quote for AI audit against the active build benchmark.
import { useMutation } from "@tanstack/react-query";

import { apiUploadForm } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { QuoteAuditResponse } from "../../shared/api/types";
import { useDesignStore } from "../../state/designStore";

export function useQuoteAudit() {
  const designSession = useDesignStore((state) => state.designSession);

  return useMutation({
    mutationFn: async (file: File): Promise<QuoteAuditResponse> => {
      if (!designSession) {
        throw new Error("Design session is not ready.");
      }
      const formData = new FormData();
      formData.append("session", JSON.stringify(designSession));
      formData.append("file", file, file.name);
      return apiUploadForm<QuoteAuditResponse>(ENDPOINTS.designsQuoteAudit, formData);
    },
  });
}
