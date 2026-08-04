import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockDesignSession, mockDesignSessionWithCustom } from "../../../../src/features/design/fixtures/mockDesignSession";
import { QuotationPage } from "../../../../src/features/quotation/QuotationPage";
import { apiPost } from "../../../../src/shared/api/client";
import type { QuotationDocument } from "../../../../src/shared/api/types";
import { useDesignStore } from "../../../../src/state/designStore";

vi.mock("../../../../src/features/design/useDesignActions", () => ({
  useDesignAgent: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useExplainDesign: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock("../../../../src/shared/api/client", () => ({
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  apiPostBlob: vi.fn(),
}));

const mockedApiPost = vi.mocked(apiPost);

function backendQuoteFor(buildId: string): QuotationDocument {
  const build = mockDesignSession.builds.find((candidate) => candidate.id === buildId)!;
  return {
    build_id: build.id,
    quote_number: "KH-1A2B3C4D",
    quote_date: "2026-08-04",
    validity_days: 30,
    lines: build.components.map((component) => ({
      item: component.summary,
      description: `${component.brand} ${component.model}`,
      brand: component.brand,
      uom: component.unit,
      qty: component.qty,
      unit_price_php: component.unit_price_php,
      amount_php: component.line_total_php,
      price_as_of: component.price_as_of,
    })),
    subtotal_php: build.subtotal_php,
    vat_php: build.vat_php,
    total_php: build.total_investment_php,
    total_low_php: build.total_investment_low_php,
    total_high_php: build.total_investment_high_php,
    payment_terms:
      "50% upon contract signing, 40% upon delivery, 10% upon commissioning",
    warranty_summary:
      "Component warranties per manufacturer; installation workmanship 1 year.",
    is_draft: true,
  };
}

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

beforeEach(() => {
  mockedApiPost.mockReset();
});

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

  it("renders the backend quotation document, VAT, and draft badge", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);
    const build = mockDesignSession.builds[0]!;
    mockedApiPost.mockResolvedValue(backendQuoteFor(build.id));

    renderQuotation();

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Choose build for quotation"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "#KH-1A2B3C4D" }),
    ).toBeInTheDocument();
    expect(screen.getByText("VAT (12%)")).toBeInTheDocument();
    expect(screen.getByText("Estimated total range")).toBeInTheDocument();
    expect(screen.getByText("₱354,928–₱524,636")).toBeInTheDocument();
    expect(screen.getByText("Why this pays")).toBeInTheDocument();
    expect(screen.getByText("Payment terms")).toBeInTheDocument();
    expect(screen.getByText("50% upon contract signing")).toBeInTheDocument();
    expect(
      screen.getByText("installation workmanship 1 year."),
    ).toBeInTheDocument();
  });

  it("switches quotation when another build is chosen", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSessionWithCustom);
    const customBuild = mockDesignSessionWithCustom.builds[1]!;
    mockedApiPost.mockImplementation(async (path) => {
      const buildId = String(path).split("/").pop()!;
      return backendQuoteFor(buildId);
    });

    renderQuotation();

    await screen.findByText("Draft");
    fireEvent.click(screen.getByRole("radio", { name: /Custom build A/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: /Custom build A/i }),
      ).toHaveAttribute("aria-checked", "true"),
    );
    expect(mockedApiPost).toHaveBeenCalledWith(
      expect.stringContaining(customBuild.id),
      expect.any(Object),
    );
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

  it("surfaces a backend failure instead of fabricating a quote", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);
    mockedApiPost.mockRejectedValue(new Error("offline"));

    renderQuotation();

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(screen.queryByText(/^#KE-/)).not.toBeInTheDocument();
    expect(screen.queryByText("Payment terms")).not.toBeInTheDocument();
  });
});
