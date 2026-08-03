import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { WhyPage } from "../../../../src/features/recommendation/WhyPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";

afterEach(() => useAssessmentStore.getState().reset());

describe("WhyPage", () => {
  it("renders confidence from the stored result", () => {
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/why"]}>
        <WhyPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Why/)).toBeInTheDocument();
    expect(screen.getByText("Roof geometry")).toBeInTheDocument();
    expect(screen.getByText("Actual production")).toBeInTheDocument();
  });

  it("redirects to energy when the stored result is missing", async () => {
    const router = createMemoryRouter(
      [
        { path: "/why", element: <WhyPage /> },
        { path: "/energy", element: <p>Energy</p> },
      ],
      { initialEntries: ["/why"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
  });
});
