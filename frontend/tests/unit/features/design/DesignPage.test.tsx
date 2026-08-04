import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { DesignPage } from "../../../../src/features/design/DesignPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";
import { useDesignStore } from "../../../../src/state/designStore";

vi.mock("../../../../src/features/design/useDesignActions", () => ({
  useBootstrapDesign: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  useOptimiseDesign: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useDesignAgent: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useExplainDesign: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

afterEach(() => {
  useAssessmentStore.getState().reset();
  useDesignStore.getState().clearDesign();
});

describe("DesignPage", () => {
  it("redirects when assessment result is missing", async () => {
    const router = createMemoryRouter(
      [
        { path: "/design", element: <DesignPage /> },
        { path: "/results", element: <p>Results</p> },
      ],
      { initialEntries: ["/design"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/results"),
    );
  });

  it("renders summary tiles from the active build", () => {
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);
    useDesignStore.getState().setDesignSession(mockDesignSession);

    const router = createMemoryRouter([{ path: "/design", element: <DesignPage /> }], {
      initialEntries: ["/design"],
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByLabelText("Assessment progress")).toBeInTheDocument();
    expect(screen.getByLabelText("Active build summary")).toBeInTheDocument();
    expect(screen.getByText("Energy capture")).toBeInTheDocument();
    expect(screen.getByText("Power converter")).toBeInTheDocument();
    expect(screen.queryByText("Active build")).not.toBeInTheDocument();
    expect(screen.getByText("AI auto-optimise")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply design" })).toBeInTheDocument();
  });
});
