// Verifies the analysis step guards, submits once, and offers a way past flux.
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { roofPolygonFixture } from "../../../fixtures/roofPolygonFixture";
import { LoadingPage } from "../../../../src/features/loading/LoadingPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";
import { useFluxCacheStore } from "../../../../src/state/fluxCacheStore";

const { preloadFluxLayersForAssessment, submitState } = vi.hoisted(() => ({
  preloadFluxLayersForAssessment: vi.fn(),
  submitState: {
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null as Error | null,
  },
}));

vi.mock("../../../../src/features/results/preloadFluxLayers", () => ({
  preloadFluxLayersForAssessment,
}));

vi.mock(
  "../../../../src/features/assessment/hooks/useSubmitAssessment",
  () => ({
    useSubmitAssessment: () => submitState,
  }),
);

const PROPERTY = {
  placeId: "place-1",
  name: "A house",
  address: "1 Some Street, Cebu City",
  latitude: 10.3,
  longitude: 123.9,
  source: "search" as const,
};

const ROOF = roofPolygonFixture({
  coordinates: [
    { latitude: 10.3, longitude: 123.9 },
    { latitude: 10.3001, longitude: 123.9 },
    { latitude: 10.3001, longitude: 123.9001 },
    { latitude: 10.3, longitude: 123.9001 },
  ],
  areaSquareMeters: 120,
});

/** A session complete enough for /loading to submit rather than redirect. */
function seedCompleteSession() {
  const store = useAssessmentStore.getState();
  store.setPropertySelection(PROPERTY);
  store.setRoofPolygon(ROOF);
  store.setEnergyInputs({ monthlyBillPhp: 4800 });
}

/**
 * A stored result that needs a flux map: the preload only runs when there is
 * shading data, a traced roof and panels to place.
 */
function seedFluxWorthyResult() {
  useAssessmentStore.getState().setResult({
    ...fixture,
    shading: {
      shading_impact: "moderate",
      sunshine_retention_ratio: "0.84",
      whole_roof_median_sunshine_hours_per_year: "1408.8",
      max_sunshine_hours_per_year: "1677.2",
      data_source: "google_solar_api",
      applied_to_generation: true,
      roof_segments: [],
    },
  } as unknown as StoreAssessmentResult);
}

function renderAtLoading() {
  const router = createMemoryRouter(
    [
      { path: "/loading", element: <LoadingPage /> },
      { path: "/locate", element: <p>Locate</p> },
      { path: "/energy", element: <p>Energy</p> },
      { path: "/results", element: <p>Results</p> },
    ],
    { initialEntries: ["/loading"] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  submitState.mutate = vi.fn();
  submitState.isPending = false;
  submitState.isSuccess = false;
  submitState.error = null;
  preloadFluxLayersForAssessment.mockReset();
  preloadFluxLayersForAssessment.mockResolvedValue({ skipped: false });
});

afterEach(() => {
  useAssessmentStore.getState().reset();
  useFluxCacheStore.getState().clear();
});

describe("LoadingPage", () => {
  it("sends a cold session back to pick a property instead of submitting", async () => {
    const router = renderAtLoading();

    await waitFor(() => expect(router.state.location.pathname).toBe("/locate"));
    // The guard exists to stop exactly this: an effect still runs on the pass
    // that renders the redirect.
    expect(submitState.mutate).not.toHaveBeenCalled();
  });

  it("sends a session with no bill back to the energy step", async () => {
    const store = useAssessmentStore.getState();
    store.setPropertySelection(PROPERTY);
    store.setRoofPolygon(ROOF);

    const router = renderAtLoading();

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
    expect(submitState.mutate).not.toHaveBeenCalled();
  });

  it("submits the assessment once for a complete session", async () => {
    seedCompleteSession();

    renderAtLoading();

    await waitFor(() => expect(submitState.mutate).toHaveBeenCalledTimes(1));
    expect(submitState.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: expect.objectContaining({ monthly_bill_php: 4800 }),
      }),
    );
  });

  it("does not resubmit on its own once the assessment has failed", async () => {
    seedCompleteSession();

    renderAtLoading();
    await waitFor(() => expect(submitState.mutate).toHaveBeenCalledTimes(1));

    // What a failed request leaves behind: nothing pending, nothing succeeded —
    // the same state the page submits from. Anything that re-renders after it
    // would start the request again, and again, for as long as the service is
    // down.
    submitState.isPending = false;
    submitState.error = new Error("The assessment service is unavailable.");
    act(() => {
      useAssessmentStore.getState().setEnergyInputs({ budgetPhp: 300000 });
    });

    expect(
      await screen.findByText("We couldn’t finish the assessment."),
    ).toBeInTheDocument();
    expect(submitState.mutate).toHaveBeenCalledTimes(1);
  });

  it("offers a retry that resends the assessment when submission fails", async () => {
    seedCompleteSession();
    submitState.error = new Error("The assessment service is unavailable.");
    const user = userEvent.setup();

    renderAtLoading();

    expect(
      screen.getByText("The assessment service is unavailable."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We couldn’t finish the assessment."),
    ).toBeInTheDocument();

    const callsBefore = submitState.mutate.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(submitState.mutate.mock.calls.length).toBe(callsBefore + 1);
  });

  it("keeps a way back to the bill when the assessment cannot be finished", () => {
    seedCompleteSession();
    submitState.error = new Error("The assessment service is unavailable.");

    renderAtLoading();

    expect(
      screen.getByRole("link", { name: "Back to your bill" }),
    ).toHaveAttribute("href", "/energy");
    // Flux never started, so its two actions have no business being offered.
    expect(
      screen.queryByRole("button", { name: "Continue without flux map" }),
    ).not.toBeInTheDocument();
  });

  it("goes on to the results once the flux preload finishes", async () => {
    seedCompleteSession();
    seedFluxWorthyResult();
    submitState.isSuccess = true;

    const router = renderAtLoading();

    await waitFor(() =>
      expect(preloadFluxLayersForAssessment).toHaveBeenCalledTimes(1),
    );
    await waitFor(
      () => expect(router.state.location.pathname).toBe("/results"),
      { timeout: 2000 },
    );
  });

  it("lets a failed flux map be retried without losing the assessment", async () => {
    seedCompleteSession();
    seedFluxWorthyResult();
    submitState.isSuccess = true;
    preloadFluxLayersForAssessment.mockRejectedValueOnce(
      new Error("Solar flux is unavailable."),
    );
    const user = userEvent.setup();

    renderAtLoading();

    expect(
      await screen.findByText("Solar flux is unavailable."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We couldn’t prepare the solar flux map."),
    ).toBeInTheDocument();

    preloadFluxLayersForAssessment.mockResolvedValue({ skipped: false });
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(preloadFluxLayersForAssessment).toHaveBeenCalledTimes(2),
    );
  });

  it("offers the results anyway when only the flux map failed", async () => {
    seedCompleteSession();
    seedFluxWorthyResult();
    submitState.isSuccess = true;
    preloadFluxLayersForAssessment.mockRejectedValue(
      new Error("Solar flux is unavailable."),
    );
    const user = userEvent.setup();

    const router = renderAtLoading();

    // The assessment is complete and usable; only the overlay is missing.
    await user.click(
      await screen.findByRole("button", { name: "Continue without flux map" }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/results"),
    );
  });

  it("skips the flux preload entirely when the roof needs no map", async () => {
    seedCompleteSession();
    // No shading data, so there is nothing to place panels against.
    useAssessmentStore
      .getState()
      .setResult({
        ...fixture,
        shading: null,
      } as unknown as StoreAssessmentResult);
    submitState.isSuccess = true;

    const router = renderAtLoading();

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/results"),
    );
    expect(preloadFluxLayersForAssessment).not.toHaveBeenCalled();
  });
});
