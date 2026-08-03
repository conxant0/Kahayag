import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDownloadReport } from "../../../../src/features/reports/hooks/useDownloadReport";
import * as client from "../../../../src/shared/api/client";
import type { ReportPdfRequest } from "../../../../src/features/reports/buildReportRequest";

const REQUEST: ReportPdfRequest = {
  assessment: {} as ReportPdfRequest["assessment"],
  roof_polygon: [],
  panel_polygons: [],
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useDownloadReport", () => {
  let createObjectURL: ReturnType<
    typeof vi.fn<(obj: Blob | MediaSource) => string>
  >;
  let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads the blob under the returned filename and cleans up the object URL", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    vi.spyOn(client, "apiPostBlob").mockResolvedValue({
      blob,
      filename: "kahayag-solar-report-2026-07-28.pdf",
    });

    const { result } = renderHook(() => useDownloadReport(), { wrapper });

    result.current.mutate(REQUEST);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("propagates request errors without downloading anything", async () => {
    vi.spyOn(client, "apiPostBlob").mockRejectedValue(
      new Error("Request failed: 422"),
    );

    const { result } = renderHook(() => useDownloadReport(), { wrapper });

    result.current.mutate(REQUEST);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Request failed: 422");
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
