// Verifies the analysis step survives the remount StrictMode performs.
//
// Separate from LoadingPage.test.tsx because that suite replaces
// `useSubmitAssessment` with a plain object. The bug this covers lives in the
// real hook: the request is started before StrictMode's remount and its result
// lands on the observer that remount threw away, so a screen that holds its
// second pass back waits forever on an answer that already arrived. Only the
// real mutation can show that, so this file stubs the HTTP client instead.
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture } from "../../../fixtures/assessmentFixture";
import { roofPolygonFixture } from "../../../fixtures/roofPolygonFixture";
import { LoadingPage } from "../../../../src/features/loading/LoadingPage";
import { useAssessmentStore } from "../../../../src/state/assessmentStore";
import { useFluxCacheStore } from "../../../../src/state/fluxCacheStore";

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }));

vi.mock("../../../../src/shared/api/client", () => ({
  apiPost,
  apiGet: vi.fn(),
  apiPostBlob: vi.fn(),
  formatErrorDetail: (detail: unknown) => String(detail),
}));

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

function renderAtLoading() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/loading", element: <LoadingPage /> },
      { path: "/locate", element: <p>Locate</p> },
      { path: "/energy", element: <p>Energy</p> },
      { path: "/results", element: <p>Results</p> },
    ],
    { initialEntries: ["/loading"] },
  );

  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return router;
}

afterEach(() => {
  apiPost.mockReset();
  useAssessmentStore.getState().reset();
  useFluxCacheStore.getState().clear();
});

describe("LoadingPage under StrictMode", () => {
  it("reaches the results when the assessment lands", async () => {
    const store = useAssessmentStore.getState();
    store.setPropertySelection(PROPERTY);
    store.setRoofPolygon(ROOF);
    store.setEnergyInputs({ monthlyBillPhp: 4800 });
    apiPost.mockResolvedValue(assessmentFixture);

    const router = renderAtLoading();

    // The fixture carries no shading, so there is no flux map to prepare and
    // nothing between the answer and the results.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/results"),
    );
    expect(useAssessmentStore.getState().result).not.toBeNull();
  });

  it("stops asking once the assessment has failed", async () => {
    const store = useAssessmentStore.getState();
    store.setPropertySelection(PROPERTY);
    store.setRoofPolygon(ROOF);
    store.setEnergyInputs({ monthlyBillPhp: 4800 });
    apiPost.mockRejectedValue(new Error("The assessment service is down."));

    renderAtLoading();

    await waitFor(() => expect(apiPost).toHaveBeenCalled());

    // StrictMode's second pass is allowed to re-ask, and does; what must not
    // happen is the screen asking again every render after the failure.
    const settled = apiPost.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(apiPost.mock.calls.length).toBe(settled);
  });
});
