import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { mockPermitAssessmentComplete } from "../../../../src/features/permits/fixtures/mockPermitAssessments";
import { PermitsPage } from "../../../../src/features/permits/PermitsPage";
import { useAssessmentStore, type SelectedProperty } from "../../../../src/state/assessmentStore";
import { useDesignStore } from "../../../../src/state/designStore";

const mockMutate = vi.fn();

vi.mock("../../../../src/features/permits/useAssessPermit", () => ({
  useAssessPermit: () => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  }),
}));

const PROPERTY: SelectedProperty = {
  placeId: "place-1",
  name: "Demo Street",
  address: "123 Demo Street, Cebu City, Philippines",
  latitude: 10.3157,
  longitude: 123.8854,
  source: "search",
};

function renderPermits(initialPath = "/permits") {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/permits", element: <PermitsPage /> },
      { path: "/compare", element: <p>Compare</p> },
      { path: "/locate", element: <p>Locate</p> },
      { path: "/", element: <p>Landing</p> },
    ],
    { initialEntries: [initialPath] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router };
}

function seedSession() {
  // Property must be set before the design session: setting a property clears
  // the design store so a trace is never carried to a different address.
  useAssessmentStore.getState().setPropertySelection(PROPERTY);
  useDesignStore.getState().setDesignSession(mockDesignSession);
}

afterEach(() => {
  useAssessmentStore.getState().reset();
  useDesignStore.getState().clearDesign();
  mockMutate.mockReset();
});

describe("PermitsPage", () => {
  it("redirects when design session is missing", async () => {
    const { router } = renderPermits();

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/compare"),
    );
  });

  it("redirects when property selection is missing", async () => {
    useDesignStore.getState().setDesignSession(mockDesignSession);

    const { router } = renderPermits();

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/locate"),
    );
  });

  it("does not assess on every keystroke, only on explicit submit", async () => {
    const user = userEvent.setup();
    seedSession();

    renderPermits();

    await user.type(screen.getByLabelText("Your full name"), "Maria");

    expect(mockMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  });

  it("stubs Submit and reveals start-over after acknowledgement", async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_vars, options) => {
      options?.onSuccess?.(mockPermitAssessmentComplete);
    });
    seedSession();

    const { router } = renderPermits();

    const applicantSection = screen.getByRole("region", { name: "Applicant details" });
    await user.type(screen.getByLabelText("Your full name"), "Maria Santos");
    await user.click(within(applicantSection).getByRole("button", { name: "Submit" }));

    const handOffSection = await screen.findByRole("region", { name: "Packet status" });
    const submitButton = within(handOffSection).getByRole("button", {
      name: "Submit",
    });
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    const startOverButton = await screen.findByRole("button", {
      name: "Start another assessment",
    });
    expect(startOverButton).toBeInTheDocument();

    await user.click(startOverButton);

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    const session = useAssessmentStore.getState();
    expect(session.result).toBeNull();
    expect(session.selectedProperty).toBeNull();
    expect(session.roofPolygon).toBeNull();
    expect(session.energyInputs.monthlyBillPhp).toBeNull();
  });
});
