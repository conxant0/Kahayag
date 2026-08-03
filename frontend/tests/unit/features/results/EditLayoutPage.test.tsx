import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { EditLayoutPage } from "../../../../src/features/results/EditLayoutPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../../../src/state/assessmentStore";

const cebuRoof = [
  { latitude: 10.3157, longitude: 123.8854 },
  { latitude: 10.3159, longitude: 123.8854 },
  { latitude: 10.3159, longitude: 123.8856 },
  { latitude: 10.3157, longitude: 123.8856 },
];

const { mutateAsync } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("../../../../src/features/results/hooks/useAdjustPanelCount", () => ({
  useAdjustPanelCount: () => ({ mutateAsync, isPending: false }),
}));

afterEach(() => {
  mutateAsync.mockReset();
  useAssessmentStore.getState().reset();
});

describe("EditLayoutPage", () => {
  it("keeps the stored result unchanged until a successful save", async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({
      recommendation: { ...fixture.recommendation, panel_count: 10 },
      financials: { ...fixture.financials, estimated_base_cost_php: 270000 },
    });
    useAssessmentStore.getState().setRoofPolygon({
      coordinates: cebuRoof,
      areaSquareMeters: 40,
    });
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/results/layout"]}>
        <EditLayoutPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("slider"), { target: { value: "10" } });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(
      (useAssessmentStore.getState().result as unknown as typeof fixture).recommendation
        .panel_count,
    ).toBe(8);

    await user.click(screen.getByRole("button", { name: /save layout/i }));

    await waitFor(() =>
      expect(
        (useAssessmentStore.getState().result as unknown as typeof fixture).recommendation
          .panel_count,
      ).toBe(10),
    );
  });

  it("shows an adjustment error and preserves the stored result", async () => {
    mutateAsync.mockRejectedValue(new Error("Panel count is over budget."));
    useAssessmentStore.getState().setRoofPolygon({
      coordinates: cebuRoof,
      areaSquareMeters: 40,
    });
    useAssessmentStore
      .getState()
      .setResult(fixture as unknown as StoreAssessmentResult);

    render(
      <MemoryRouter initialEntries={["/results/layout"]}>
        <EditLayoutPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("slider"), { target: { value: "10" } });

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Panel count is over budget.");
    expect(
      (useAssessmentStore.getState().result as unknown as typeof fixture).recommendation
        .panel_count,
    ).toBe(8);
  });

  it("redirects to energy when the stored result is missing", async () => {
    const router = createMemoryRouter(
      [
        { path: "/results/layout", element: <EditLayoutPage /> },
        { path: "/energy", element: <p>Energy</p> },
      ],
      { initialEntries: ["/results/layout"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
  });
});
