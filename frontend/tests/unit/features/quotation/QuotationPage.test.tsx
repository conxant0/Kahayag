import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { QuotationPage } from "../../../../src/features/quotation/QuotationPage";
import { useDesignStore } from "../../../../src/state/designStore";

vi.mock("../../../../src/features/design/useDesignActions", () => ({
  useDesignAgent: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useExplainDesign: () => ({ mutate: vi.fn(), isPending: false, error: null }),
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
    expect(
      screen.getByText(`KH-${build.id.slice(0, 8).toUpperCase()}`),
    ).toBeInTheDocument();
    expect(screen.getByText("VAT (12%)")).toBeInTheDocument();
    expect(screen.getByText("₱379,456")).toBeInTheDocument();
    expect(screen.getByText("Why this pays")).toBeInTheDocument();
    expect(screen.getByText("Payment terms")).toBeInTheDocument();
    expect(screen.getByText(/50% upon contract signing/i)).toBeInTheDocument();
  });
});
