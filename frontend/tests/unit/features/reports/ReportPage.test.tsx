import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { roofPolygonFixture } from "../../../fixtures/roofPolygonFixture";
import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { ReportPage } from "../../../../src/features/reports/ReportPage";
import * as client from "../../../../src/shared/api/client";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
  type SelectedProperty,
} from "../../../../src/state/assessmentStore";
import { useDesignStore } from "../../../../src/state/designStore";

const PROPERTY: SelectedProperty = {
  placeId: "place-1",
  name: "Demo Street",
  address: "123 Demo Street, Cebu City, Philippines",
  latitude: 10.3157,
  longitude: 123.8854,
  source: "search",
};

/** Large enough to hold the fixture's eight panels. */
const ROOF = roofPolygonFixture({
  coordinates: [
    { latitude: 10.3157, longitude: 123.8854 },
    { latitude: 10.3159, longitude: 123.8854 },
    { latitude: 10.3159, longitude: 123.8857 },
    { latitude: 10.3157, longitude: 123.8857 },
  ],
  areaSquareMeters: 220,
});

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function seedSession({
  roof = ROOF,
  design = false,
}: { roof?: typeof ROOF | null; design?: boolean } = {}) {
  const store = useAssessmentStore.getState();
  store.setPropertySelection(PROPERTY);
  if (roof) {
    store.setRoofPolygon(roof);
  }
  useAssessmentStore
    .getState()
    .setResult(fixture as unknown as StoreAssessmentResult);
  if (design) {
    useDesignStore.getState().setDesignSession(mockDesignSession);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  useAssessmentStore.getState().reset();
  useDesignStore.getState().clearDesign();
});

describe("ReportPage", () => {
  it("lists what the PDF actually contains", () => {
    seedSession();

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    expect(
      screen.getByRole("heading", { name: "Everything, in one PDF." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kahayag Solar Brief")).toBeInTheDocument();
    expect(screen.getByText("Results & system specs")).toBeInTheDocument();
    expect(screen.getByText("Panel layout on your roof")).toBeInTheDocument();
  });

  it("keeps the optional contact details with the session", async () => {
    seedSession();
    const user = userEvent.setup();

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    await user.type(screen.getByLabelText("Full name"), "Juana dela Cruz");
    await user.type(screen.getByLabelText("Mobile number"), "0917 123 4567");

    expect(useAssessmentStore.getState().contactDetails).toMatchObject({
      fullName: "Juana dela Cruz",
      mobile: "0917 123 4567",
    });
    // Typing a name must not discard the result this page is built on.
    expect(useAssessmentStore.getState().result).not.toBeNull();
  });

  it("leaves the download open with the contact fields blank", () => {
    // Every contact field is optional: the proposal is the homeowner's either
    // way, so an empty form must never hold the PDF hostage.
    seedSession();

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    expect(
      screen.getByRole("button", { name: /Download PDF report/ }),
    ).toBeEnabled();
  });

  it("blocks the download until a roof has been traced", () => {
    seedSession({ roof: null });

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    expect(
      screen.getByRole("button", { name: /Download PDF report/ }),
    ).toBeDisabled();
  });

  it("requests the PDF with the assessment and the traced roof", async () => {
    const user = userEvent.setup();
    const apiPostBlob = vi.spyOn(client, "apiPostBlob").mockResolvedValue({
      blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      filename: "kahayag-solar-report.pdf",
    });
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    seedSession();

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    await user.click(
      screen.getByRole("button", { name: /Download PDF report/ }),
    );

    await waitFor(() => expect(apiPostBlob).toHaveBeenCalledTimes(1));
    const [, body] = apiPostBlob.mock.calls[0];
    const request = body as { roof_polygon: unknown[]; panel_polygons: [] };
    expect(request.roof_polygon).toHaveLength(4);
    expect(request.panel_polygons).toHaveLength(
      fixture.recommendation.panel_count,
    );
  });

  it("includes the chosen design in the PDF request and the contents list", async () => {
    const user = userEvent.setup();
    const apiPostBlob = vi.spyOn(client, "apiPostBlob").mockResolvedValue({
      blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      filename: "kahayag-solar-report.pdf",
    });
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    seedSession({ design: true });

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    expect(screen.getByText("Chosen design & quotation")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Download PDF report/ }),
    );

    await waitFor(() => expect(apiPostBlob).toHaveBeenCalledTimes(1));
    const [, body] = apiPostBlob.mock.calls[0];
    const request = body as {
      design_build: { id: string } | undefined;
    };
    expect(request.design_build).toBeDefined();
    expect(request.design_build!.id).toBe(
      mockDesignSession.active_build_id,
    );
  });

  it("surfaces a failed download instead of leaving the button silent", async () => {
    const user = userEvent.setup();
    vi.spyOn(client, "apiPostBlob").mockRejectedValue(
      new Error("Request failed: 502"),
    );
    seedSession();

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    await user.click(
      screen.getByRole("button", { name: /Download PDF report/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Request failed: 502",
    );
  });

  it("says why the download is blocked rather than leaving a dead button", () => {
    seedSession({ roof: null });

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    expect(
      screen.getByText(
        "The report draws your panel layout, so it needs your roof trace.",
      ),
    ).toBeInTheDocument();
  });

  it("offers a CTA to the permit check and a start-over button", () => {
    seedSession();

    render(
      <Providers>
        <MemoryRouter initialEntries={["/report"]}>
          <ReportPage />
        </MemoryRouter>
      </Providers>,
    );

    const permitLink = screen.getByRole("link", {
      name: /Check permit requirements/,
    });
    expect(permitLink).toBeInTheDocument();
    expect(permitLink).toHaveAttribute("href", "/permits");
    expect(
      screen.getByRole("button", { name: "Start another assessment" }),
    ).toBeInTheDocument();
  });

  it("redirects to energy when no assessment has been run", async () => {
    const router = createMemoryRouter(
      [
        { path: "/report", element: <ReportPage /> },
        { path: "/energy", element: <p>Energy</p> },
      ],
      { initialEntries: ["/report"] },
    );

    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/energy"));
  });
});
