import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDesignSession, mockDesignSessionWithCustom } from "../../../../src/features/design/fixtures/mockDesignSession";
import { ComparePage } from "../../../../src/features/compare/ComparePage";
import { useDesignStore } from "../../../../src/state/designStore";

vi.mock("../../../../src/features/compare/useQuoteAudit", () => ({
  useQuoteAudit: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../../../src/features/design/useDesignActions", () => ({
  useMutateDesign: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

afterEach(() => {
  useDesignStore.getState().clearDesign();
});

describe("ComparePage", () => {
  it("redirects when design session is missing", async () => {
    const router = createMemoryRouter(
      [
        { path: "/compare", element: <ComparePage /> },
        { path: "/design", element: <p>Design</p> },
      ],
      { initialEntries: ["/compare"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/design"),
    );
  });

  it("shows only AI suggested before a custom build exists", () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);

    const router = createMemoryRouter([{ path: "/compare", element: <ComparePage /> }], {
      initialEntries: ["/compare"],
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByText("After AI design · Compare builds")).toBeInTheDocument();
    expect(screen.getAllByText("AI suggested").length).toBeGreaterThan(0);
    expect(screen.queryByText("Custom build A")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Compare custom")).toBeInTheDocument();
  });

  it("shows two builds and flips a card to technical specs", () => {
    useDesignStore.getState().setDesignSession(mockDesignSessionWithCustom);

    const router = createMemoryRouter([{ path: "/compare", element: <ComparePage /> }], {
      initialEntries: ["/compare"],
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByText("After AI design · Compare builds")).toBeInTheDocument();
    expect(screen.getByLabelText("Side-by-side build comparison")).toBeInTheDocument();
    expect(screen.getByLabelText("Choose builds to compare")).toBeInTheDocument();
    expect(screen.getByText("2 builds")).toBeInTheDocument();
    expect(screen.getAllByText("AI suggested").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Custom build A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("System size").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Cards" }));

    const suggestedCard = screen.getByRole("button", {
      name: "AI suggested build overview. Press to show technical specs.",
    });
    expect(suggestedCard).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(suggestedCard);

    expect(suggestedCard).toHaveAttribute("aria-pressed", "true");
    expect(suggestedCard).toHaveAccessibleName(
      "AI suggested technical specs. Press to show overview.",
    );
  });

  it("renders a flip card for each uploaded quote", () => {
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

    const router = createMemoryRouter([{ path: "/compare", element: <ComparePage /> }], {
      initialEntries: ["/compare"],
    });

    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("tab", { name: "Cards" }));

    const quoteCard = screen.getByRole("button", {
      name: "installer.pdf quote overview. Press to show technical specs.",
    });
    expect(quoteCard).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(quoteCard);

    expect(quoteCard).toHaveAttribute("aria-pressed", "true");
    expect(quoteCard).toHaveAccessibleName(
      "installer.pdf technical specs. Press to show overview.",
    );
  });

  it("selects a build and navigates to quotation", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSessionWithCustom);

    const router = createMemoryRouter(
      [
        { path: "/compare", element: <ComparePage /> },
        { path: "/quotation", element: <p>Quotation</p> },
      ],
      { initialEntries: ["/compare"] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Use for quotation" })[1]!);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/quotation"),
    );
    expect(useDesignStore.getState().designSession?.active_build_id).toBe(
      mockDesignSessionWithCustom.builds[1]!.id,
    );
  });

  it("selects an uploaded quote and navigates to quotation", async () => {
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

    const router = createMemoryRouter(
      [
        { path: "/compare", element: <ComparePage /> },
        { path: "/quotation", element: <p>Quotation</p> },
      ],
      { initialEntries: ["/compare"] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "Use this quotation" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/quotation"),
    );
    expect(useDesignStore.getState().activeQuoteFilename).toBe("installer.pdf");
  });
});
