// Uploads outside quotes for AI audit against the active build benchmark.
import { useMutation } from "@tanstack/react-query";

import { apiUploadForm } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { QuoteAuditResponse } from "../../shared/api/types";
import { useDesignStore } from "../../state/designStore";

export type QuoteAuditBatchResult = {
  results: QuoteAuditResponse[];
  failures: string[];
};

async function auditQuoteFile(
  file: File,
  session: NonNullable<ReturnType<typeof useDesignStore.getState>["designSession"]>,
): Promise<QuoteAuditResponse> {
  const formData = new FormData();
  formData.append("session", JSON.stringify(session));
  formData.append("file", file, file.name);
  return apiUploadForm<QuoteAuditResponse>(ENDPOINTS.designsQuoteAudit, formData);
}

export function useQuoteAudit() {
  const designSession = useDesignStore((state) => state.designSession);
  const addQuoteAuditResult = useDesignStore((state) => state.addQuoteAuditResult);

  return useMutation({
    mutationFn: async (files: File[]): Promise<QuoteAuditBatchResult> => {
      if (!designSession) {
        throw new Error("Design session is not ready.");
      }
      if (files.length === 0) {
        throw new Error("Choose at least one quote file.");
      }

      const results: QuoteAuditResponse[] = [];
      const failures: string[] = [];

      for (const file of files) {
        try {
          const result = await auditQuoteFile(file, designSession);
          results.push(result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not audit this quote.";
          failures.push(`${file.name}: ${message}`);
        }
      }

      if (results.length === 0) {
        throw new Error(failures.join(" "));
      }

      return { results, failures };
    },
    onSuccess: ({ results }) => {
      for (const result of results) {
        addQuoteAuditResult(result);
      }
    },
  });
}
