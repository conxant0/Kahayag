import type { ReactNode } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { roofPolygonFixture } from "../../../fixtures/roofPolygonFixture";
import { BriefPage } from "../../../../src/features/reports/BriefPage";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
  type SelectedProperty,
} from "../../../../src/state/assessmentStore";

const PROPERTY: SelectedProperty = {
  placeId: "place-1",
  name: "Demo Street",
  address: "123 Demo Street, Cebu City, Philippines",
  latitude: 10.3157,
  longitude: 123.8854,
  source: "search",
};

const ROOF = roofPolygonFixture({
  coordinates: [
    { latitude: 10.3157, longitude: 123.8854 },
    { latitude: 10.31585, longitude: 123.8854 },
    { latitude: 10.31585, longitude: 123.88555 },
    { latitude: 10.3157, longitude: 123.88555 },
  ],
  areaSquareMeters: 40,
});

/**
 * The store clears `result` on every input change, so the assessment has to be
 * set last or the inputs that precede it would wipe it.
 */
function seedSession() {
  const store = useAssessmentStore.getState();
  store.setPropertySelection(PROPERTY);
  store.setRoofPolygon(ROOF);
  store.setEnergyInputs({ monthlyBillPhp: 6000 });
  useAssessmentStore
    .getState()
    .setResult(fixture as unknown as StoreAssessmentResult);
}

/**
 * BriefPage pulls the quotation for a chosen design through react-query, so
 * every render needs the client the hook expects — even with no design
 * session, when the query stays disabled.
 */
function withQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  useAssessmentStore.getState().reset();
});

describe("BriefPage", () => {
  it("renders the system and financial specs from the stored result", () => {
    seedSession();

    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/brief"]}>
          <BriefPage />
        </MemoryRouter>,
      ),
    );

    expect(
      screen.getByRole("heading", { name: "Your project brief." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "System" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Financials" }),
    ).toBeInTheDocument();
    // Cobalt informs: the confidence figure is engine output, not copy.
    expect(screen.getByText(/% confidence/)).toBeInTheDocument();
  });

  it("marks the engine's own panel class as the one in force", () => {
    seedSession();

    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/brief"]}>
          <BriefPage />
        </MemoryRouter>,
      ),
    );

    // The fixture recommends standard-450.
    expect(
      screen.getByRole("button", { name: /Standard/, pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /High Output/, pressed: false }),
    ).toBeInTheDocument();
  });

  it("re-sizes the brief when another panel class is chosen", async () => {
    const user = userEvent.setup();
    seedSession();

    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/brief"]}>
          <BriefPage />
        </MemoryRouter>,
      ),
    );

    const specsBefore = screen.getByRole("region", {
      name: "System",
    }).textContent;

    await user.click(screen.getByRole("button", { name: /High Output/ }));

    expect(
      screen.getByRole("button", { name: /High Output/, pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Standard/, pressed: false }),
    ).toBeInTheDocument();
    // The choice has to reach the figures, not just the pill.
    expect(screen.getByRole("region", { name: "System" }).textContent).not.toBe(
      specsBefore,
    );
  });

  it("describes the roof figure as a layout, not a photograph", () => {
    seedSession();

    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/brief"]}>
          <BriefPage />
        </MemoryRouter>,
      ),
    );

    expect(screen.getByText(/^Roof layout ·/)).toBeInTheDocument();
  });

  it("says nothing when the share sheet is dismissed", async () => {
    const user = userEvent.setup();
    const abort = Object.assign(new Error("Share canceled"), {
      name: "AbortError",
    });
    vi.stubGlobal("navigator", {
      ...navigator,
      share: vi.fn().mockRejectedValue(abort),
    });
    seedSession();

    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/brief"]}>
          <BriefPage />
        </MemoryRouter>,
      ),
    );

    await user.click(
      screen.getByRole("button", { name: "Share with installer" }),
    );

    // Declining is not a failure, and reporting one for a choice the homeowner
    // made on purpose would be noise.
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("reports a share the browser refused, which the homeowner did not choose", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", {
      ...navigator,
      share: undefined,
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    seedSession();

    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/brief"]}>
          <BriefPage />
        </MemoryRouter>,
      ),
    );

    await user.click(
      screen.getByRole("button", { name: "Share with installer" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not share the brief.",
    );
  });

  it("redirects to energy when no assessment has been run", async () => {
    const router = createMemoryRouter(
      [
        { path: "/brief", element: <BriefPage /> },
        { path: "/energy", element: <p>Energy</p> },
      ],
      { initialEntries: ["/brief"] },
    );

    render(withQueryClient(<RouterProvider router={router} />));

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
  });
});
