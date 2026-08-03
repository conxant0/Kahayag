import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { ResultsPage } from "../../../../src/features/results/ResultsPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";

const { preloadFluxLayersForAssessment } = vi.hoisted(() => ({
  preloadFluxLayersForAssessment: vi.fn().mockResolvedValue({ skipped: true }),
}));

vi.mock("../../../../src/features/results/preloadFluxLayers", () => ({
  preloadFluxLayersForAssessment,
}));

afterEach(() => {
  preloadFluxLayersForAssessment.mockClear();
  useAssessmentStore.getState().reset();
});

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

  it("keeps core results available when optional flux loading fails", async () => {
    preloadFluxLayersForAssessment.mockRejectedValueOnce(
      new Error("bad raster"),
    );
    useAssessmentStore.getState().setPropertySelection({
      placeId: null,
      name: "Cebu",
      address: "Cebu",
      latitude: 10.3157,
      longitude: 123.8854,
      source: "manual",
    });
    useAssessmentStore.getState().setRoofPolygon({
      coordinates: [
        { latitude: 10.3157, longitude: 123.8854 },
        { latitude: 10.3158, longitude: 123.8854 },
        { latitude: 10.3158, longitude: 123.8855 },
      ],
      areaSquareMeters: 40,
    });
    useAssessmentStore.getState().setResult({
      ...fixture,
      shading: {
        shading_impact: "low",
        sunshine_retention_ratio: "0.96",
        whole_roof_median_sunshine_hours_per_year: "1612.3",
        max_sunshine_hours_per_year: "1677.2",
        data_source: "google_solar_api",
        applied_to_generation: true,
        roof_segments: [],
      },
    } as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/results"]}>
        <ResultsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/sunshine overlay is unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByText("8 panels")).toBeInTheDocument();
  });
});
