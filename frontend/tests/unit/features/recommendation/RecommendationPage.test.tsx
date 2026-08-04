import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { RecommendationPage } from "../../../../src/features/recommendation/RecommendationPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";

const backendProjection = {
  system_cost_php: 216000,
  monthly_savings_php: 1800,
  annual_savings_php: 21600,
  co2_tonnes_per_year: "2.1",
  break_even_year: "10.2",
  year_10_net_php: -1200,
  year_25_net_php: 240000,
  lifetime_gross_savings_php: 456000,
  milestones: [
    { year: 6, cumulative_net_php: -90000 },
    { year: 12, cumulative_net_php: 42000 },
    { year: 18, cumulative_net_php: 150000 },
    { year: 25, cumulative_net_php: 240000 },
  ],
  assumptions: {
    analysis_years: 25,
    electricity_escalation_ratio: "0.00",
    annual_panel_degradation_ratio: "0.005",
  },
};

const { mutateAsync } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock(
  "../../../../src/features/recommendation/useInvestmentProjection",
  () => ({
    useInvestmentProjection: () => ({ mutateAsync, isPending: false }),
  }),
);

afterEach(() => {
  useAssessmentStore.getState().reset();
  mutateAsync.mockReset();
});

describe("RecommendationPage", () => {
  it("renders the projection returned by the backend", async () => {
    mutateAsync.mockResolvedValue(backendProjection);
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/invest"]}>
        <RecommendationPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("₱240K+")).toBeInTheDocument();
    expect(screen.getByText("₱21,600")).toBeInTheDocument();
    expect(screen.getByText("Year 10.2")).toBeInTheDocument();
    expect(screen.getByText("2.1 t per year")).toBeInTheDocument();
  });

  it("hides stale backend financials while slider changes are recalculated", async () => {
    mutateAsync.mockResolvedValue(backendProjection);
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/invest"]}>
        <RecommendationPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("₱240K+")).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("slider")[0]!, {
      target: { value: "15" },
    });

    expect(screen.getByText("Calculating projection…")).toBeInTheDocument();
    expect(screen.queryByText("₱240K+")).not.toBeInTheDocument();
  });

  it("shows an error without indefinite loading when projection recomputation fails", async () => {
    mutateAsync.mockRejectedValue(new Error("Projection is unavailable."));
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/invest"]}>
        <RecommendationPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Projection is unavailable.",
    );
    expect(screen.queryByText("Calculating projection…")).not.toBeInTheDocument();
  });

  it("redirects to loading when the stored result is missing", async () => {
    const router = createMemoryRouter(
      [
        { path: "/invest", element: <RecommendationPage /> },
        { path: "/loading", element: <p>Loading</p> },
      ],
      { initialEntries: ["/invest"] },
    );

    render(<RouterProvider router={router} />);

    // /loading recomputes the memory-only result from persisted inputs; its
    // own guard walks further back when those are missing too.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/loading"),
    );
  });
});
