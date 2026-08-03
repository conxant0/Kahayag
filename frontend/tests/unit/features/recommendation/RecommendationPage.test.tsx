import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { RecommendationPage } from "../../../../src/features/recommendation/RecommendationPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";

afterEach(() => useAssessmentStore.getState().reset());

describe("RecommendationPage", () => {
  it("renders the projection from the stored result", () => {
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/invest"]}>
        <RecommendationPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Your solar investment.")).toBeInTheDocument();
    expect(screen.getByText("0% electricity escalation")).toBeInTheDocument();
    expect(screen.getByText("0.5% annual panel degradation")).toBeInTheDocument();
  });

  it("redirects to energy when the stored result is missing", async () => {
    const router = createMemoryRouter(
      [
        { path: "/invest", element: <RecommendationPage /> },
        { path: "/energy", element: <p>Energy</p> },
      ],
      { initialEntries: ["/invest"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
  });
});
