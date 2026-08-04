// Verifies the plans step guards its session, gates on its two required
// answers, and commits every choice to the session.
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { roofPolygonFixture } from "../../../fixtures/roofPolygonFixture";
import { PlansPage } from "../../../../src/features/assessment/PlansPage";
import { useAssessmentStore } from "../../../../src/state/assessmentStore";

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

/** Everything the plans step needs behind it. */
function seedBilledSession() {
  const store = useAssessmentStore.getState();
  store.setPropertySelection(PROPERTY);
  store.setRoofPolygon(ROOF);
  store.setEnergyInputs({ monthlyBillPhp: 4800 });
}

function renderAtPlans() {
  const router = createMemoryRouter(
    [
      { path: "/plans", element: <PlansPage /> },
      { path: "/locate", element: <p>Locate</p> },
      { path: "/energy", element: <p>Energy</p> },
    ],
    { initialEntries: ["/plans"] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

const nextLink = () => screen.getByRole("link", { name: "See my results" });

afterEach(() => {
  useAssessmentStore.getState().reset();
});

describe("PlansPage", () => {
  it("sends a cold session back to pick a property", async () => {
    const router = renderAtPlans();

    await waitFor(() => expect(router.state.location.pathname).toBe("/locate"));
  });

  it("sends a session without a bill back to the energy step", async () => {
    const store = useAssessmentStore.getState();
    store.setPropertySelection(PROPERTY);
    store.setRoofPolygon(ROOF);

    const router = renderAtPlans();

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
  });

  it("holds the way on shut until both required answers are picked", async () => {
    seedBilledSession();
    const user = userEvent.setup();
    renderAtPlans();

    expect(nextLink()).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Reduce my bill" }));
    expect(nextLink()).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Mostly daytime" }));
    expect(nextLink()).not.toHaveAttribute("aria-disabled");
  });

  it("commits each choice to the session", async () => {
    seedBilledSession();
    const user = userEvent.setup();
    renderAtPlans();

    await user.click(screen.getByRole("button", { name: "Backup for outages" }));
    await user.click(screen.getByRole("button", { name: "About the same" }));
    await user.click(screen.getByRole("button", { name: "Metal" }));
    await user.click(screen.getByRole("button", { name: "Within a year" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));

    expect(useAssessmentStore.getState().plans).toMatchObject({
      primaryGoal: "backup-outages",
      usagePattern: "balanced",
      roofMaterial: "metal",
      timeline: "one-year",
      ownsProperty: true,
    });
  });

  it("picking the same chip again un-answers the question", async () => {
    seedBilledSession();
    const user = userEvent.setup();
    renderAtPlans();

    const chip = screen.getByRole("button", { name: "Tile" });
    await user.click(chip);
    expect(useAssessmentStore.getState().plans.roofMaterial).toBe("tile");

    await user.click(chip);
    expect(useAssessmentStore.getState().plans.roofMaterial).toBeNull();
  });

  it("keeps 'none planned' apart from leaving the question alone", async () => {
    seedBilledSession();
    const user = userEvent.setup();
    renderAtPlans();

    expect(useAssessmentStore.getState().plans.futureLoads).toBeNull();

    await user.click(screen.getByRole("button", { name: "None" }));
    expect(useAssessmentStore.getState().plans.futureLoads).toEqual([]);

    // Picking a load is an answer that contradicts "none", so it replaces it.
    await user.click(screen.getByRole("button", { name: "Electric vehicle" }));
    await user.click(screen.getByRole("button", { name: "Water pump" }));
    expect(useAssessmentStore.getState().plans.futureLoads).toEqual([
      "ev",
      "water-pump",
    ]);

    // Deselecting the last load walks back to "not answered", not to "none".
    await user.click(screen.getByRole("button", { name: "Electric vehicle" }));
    await user.click(screen.getByRole("button", { name: "Water pump" }));
    expect(useAssessmentStore.getState().plans.futureLoads).toBeNull();
  });
});
