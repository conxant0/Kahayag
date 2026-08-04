import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { QuotationPage } from "../../../../src/features/quotation/QuotationPage";
import { quoteNumberForBuild } from "../../../../src/features/quotation/quotationViewModel";
import { useDesignStore } from "../../../../src/state/designStore";

vi.mock("../../../../src/features/design/useDesignActions", () => ({
  useDesignAgent: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useExplainDesign: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock("../../../../src/shared/api/client", () => ({
  apiPost: vi.fn().mockRejectedValue(new Error("offline")),
  apiGet: vi.fn(),
  apiPostBlob: vi.fn(),
}));

function renderQuotation(initialPath = "/quotation") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/quotation", element: <QuotationPage /> },
      { path: "/compare", element: <p>Compare</p> },
    ],
    { initialEntries: [initialPath] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  useDesignStore.getState().clearDesign();
});

describe("QuotationPage", () => {
  it("redirects when design session is missing", async () => {
    const queryClient = new QueryClient();
    const router = createMemoryRouter(
      [
        { path: "/quotation", element: <QuotationPage /> },
        { path: "/compare", element: <p>Compare</p> },
      ],
      { initialEntries: ["/quotation"] },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/compare"),
    );
  });

  it("renders BOM line items, VAT, and draft badge from the active build", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);
    const build = mockDesignSession.builds[0]!;

    renderQuotation();

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByLabelText("Choose build for quotation")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: `#${quoteNumberForBuild(build.id)}`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("VAT (12%)")).toBeInTheDocument();
    expect(screen.getByText("Estimated total range")).toBeInTheDocument();
    expect(screen.getByText("₱354,928–₱524,636")).toBeInTheDocument();
    expect(screen.getByText("Why this pays")).toBeInTheDocument();
    expect(screen.getByText("Payment terms")).toBeInTheDocument();
    expect(
      screen.getByText(/50% downpayment to lock the build/i),
    ).toBeInTheDocument();
  });

  it("switches quotation when another build is chosen", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);
    const customBuild = mockDesignSession.builds[1]!;

    renderQuotation();

    await screen.findByText("Draft");
    fireEvent.click(screen.getByRole("radio", { name: /Custom build A/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: `#${quoteNumberForBuild(customBuild.id)}`,
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("radio", { name: /Custom build A/i }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("renders an uploaded quote when one is selected", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);
    useDesignStore.getState().addQuoteAuditResult({
      filename: "installer.pdf",
      extracted_total_php: 465_000,
      extracted_system_kwp: 5.2,
      extracted_panel_count: 12,
      benchmark_total_php: 440_000,
      benchmark_system_kwp: 5.85,
      findings: [],
      summary: "Uploaded quote summary.",
      diagram_components: mockDesignSession.builds[0]!.components.slice(0, 4),
    });
    useDesignStore.getState().selectQuoteAudit("installer.pdf");

    renderQuotation();

    expect(
      await screen.findByRole("heading", { name: "#UP-INSTALLE" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Quoted total").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₱465,000").length).toBeGreaterThan(0);
    expect(screen.queryByText("Estimated total range")).not.toBeInTheDocument();
    expect(screen.getByText("Uploaded quote summary.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose build for quotation")).not.toBeInTheDocument();
  });
});
