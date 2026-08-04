// Verifies the energy step guards its session and only estimates once it can.
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { roofPolygonFixture } from "../../../fixtures/roofPolygonFixture";
import { AssessmentPage } from "../../../../src/features/assessment/AssessmentPage";
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

/** Everything the energy step needs behind it, so only the bill is missing. */
function seedTracedRoof() {
  const store = useAssessmentStore.getState();
  store.setPropertySelection(PROPERTY);
  store.setRoofPolygon(ROOF);
}

function renderAtEnergy() {
  const router = createMemoryRouter(
    [
      { path: "/energy", element: <AssessmentPage /> },
      { path: "/locate", element: <p>Locate</p> },
      { path: "/trace", element: <p>Trace</p> },
    ],
    { initialEntries: ["/energy"] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

const billField = () =>
  screen.getByLabelText("Monthly electricity bill in pesos");

afterEach(() => {
  useAssessmentStore.getState().reset();
});

describe("AssessmentPage", () => {
  it("sends a cold session back to pick a property", async () => {
    const router = renderAtEnergy();

    await waitFor(() => expect(router.state.location.pathname).toBe("/locate"));
  });

  it("sends a session with a property but no roof back to the trace step", async () => {
    useAssessmentStore.getState().setPropertySelection(PROPERTY);

    const router = renderAtEnergy();

    await waitFor(() => expect(router.state.location.pathname).toBe("/trace"));
  });

  it("stays put once the roof behind it is traced", async () => {
    seedTracedRoof();

    const router = renderAtEnergy();

    expect(router.state.location.pathname).toBe("/energy");
    expect(billField()).toBeInTheDocument();
  });

  it("holds the way on shut until there is a bill to submit", async () => {
    seedTracedRoof();
    const user = userEvent.setup();
    renderAtEnergy();

    const next = screen.getByRole("link", { name: "Next: Your plans" });
    expect(next).toHaveAttribute("aria-disabled", "true");

    await user.type(billField(), "4800");

    expect(next).not.toHaveAttribute("aria-disabled");
  });

  it("commits the typed bill to the session", async () => {
    seedTracedRoof();
    const user = userEvent.setup();
    renderAtEnergy();

    await user.type(billField(), "4800");

    expect(billField()).toHaveValue("4,800");
    expect(useAssessmentStore.getState().energyInputs.monthlyBillPhp).toBe(
      4800,
    );
  });

  it("fills the bill from a quick pick rather than replacing the field", async () => {
    seedTracedRoof();
    const user = userEvent.setup();
    renderAtEnergy();

    await user.click(screen.getByRole("button", { name: "₱8,000" }));

    expect(billField()).toHaveValue("8,000");
    expect(useAssessmentStore.getState().energyInputs.monthlyBillPhp).toBe(
      8000,
    );
  });

  it("leaves the estimate blank until there is a number to estimate from", async () => {
    seedTracedRoof();
    const user = userEvent.setup();
    renderAtEnergy();

    const estimate = screen.getByLabelText("Live estimate");
    expect(estimate).toHaveTextContent("— kWp");
    expect(estimate).toHaveTextContent("— yrs");

    await user.type(billField(), "4800");

    expect(estimate).not.toHaveTextContent("— kWp");
    expect(estimate).not.toHaveTextContent("— yrs");
  });

  it("estimates straight away for a session restored with a bill already in it", () => {
    // What a refresh looks like from here: the answers come back from storage,
    // so the estimate has everything it needs before anyone types.
    seedTracedRoof();
    useAssessmentStore.getState().setEnergyInputs({ monthlyBillPhp: 4800 });

    render(
      <MemoryRouter initialEntries={["/energy"]}>
        <AssessmentPage />
      </MemoryRouter>,
    );

    const estimate = screen.getByLabelText("Live estimate");
    expect(estimate).not.toHaveTextContent("—");
    expect(
      screen.getByLabelText("Monthly electricity bill in pesos"),
    ).toHaveValue("4,800");
  });
});
