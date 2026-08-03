import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { ResultsPage } from "../../../../src/features/results/ResultsPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";

afterEach(() => useAssessmentStore.getState().reset());

describe("ResultsPage", () => {
  it("renders recommendation and financial values from the stored result", () => {
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/results"]}>
        <ResultsPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("₱1,892")).toHaveLength(2);
    expect(screen.getByText("3.6 kW")).toBeInTheDocument();
    expect(screen.getByText("8 panels")).toBeInTheDocument();
    expect(screen.getByText("9.5 years")).toBeInTheDocument();
  });

  it("redirects to energy when the stored result is missing", async () => {
    const router = createMemoryRouter(
      [
        { path: "/results", element: <ResultsPage /> },
        { path: "/energy", element: <p>Energy</p> },
      ],
      { initialEntries: ["/results"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
  });
});
