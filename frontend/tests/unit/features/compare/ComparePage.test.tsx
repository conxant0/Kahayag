import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { ComparePage } from "../../../../src/features/compare/ComparePage";
import { useDesignStore } from "../../../../src/state/designStore";

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

  it("shows two builds and toggles technical specs", () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);

    const router = createMemoryRouter([{ path: "/compare", element: <ComparePage /> }], {
      initialEntries: ["/compare"],
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByText("After AI design · Compare builds")).toBeInTheDocument();
    expect(screen.getByText("AI suggested")).toBeInTheDocument();
    expect(screen.getByText("Custom build A")).toBeInTheDocument();
    expect(screen.getByText("BEST ALL-ROUND")).toBeInTheDocument();
    expect(screen.getAllByText("dc_ac_oversizing").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Technical specs" })[0]!);
    expect(screen.getAllByText("System size").length).toBeGreaterThan(0);
  });

  it("selects a build and navigates to quotation", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);

    const router = createMemoryRouter(
      [
        { path: "/compare", element: <ComparePage /> },
        { path: "/quotation", element: <p>Quotation</p> },
      ],
      { initialEntries: ["/compare"] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Select" })[1]!);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/quotation"),
    );
    expect(useDesignStore.getState().designSession?.active_build_id).toBe(
      mockDesignSession.builds[1]!.id,
    );
  });
});
