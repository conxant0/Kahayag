// Downloads the generated PDF report as a browser file.
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { apiPostBlob } from "../../../shared/api/client";
import { ENDPOINTS } from "../../../shared/api/endpoints";
import type { ReportPdfRequest } from "../buildReportRequest";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useDownloadReport(): UseMutationResult<
  void,
  Error,
  ReportPdfRequest
> {
  return useMutation({
    mutationFn: async (payload: ReportPdfRequest) => {
      const { blob, filename } = await apiPostBlob(
        ENDPOINTS.reportsPdf,
        payload,
      );
      downloadBlob(blob, filename);
    },
  });
}
