// Verifies the map pane says when tracing is live, and stays quiet when not.
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { RoofTracePane } from "../../../../src/features/roof/components/RoofTracePane";
import type { SelectedProperty } from "../../../../src/state/assessmentStore";

const PROPERTY: SelectedProperty = {
  placeId: "demo",
  name: "Demo property",
  address: "123 Demo Street",
  latitude: 10.3157,
  longitude: 123.8854,
  source: "search",
};

function renderPane(isTracing: boolean) {
  return render(
    <RoofTracePane
      mapContainerRef={createRef<HTMLDivElement | null>()}
      selectedProperty={PROPERTY}
      isTracing={isTracing}
    />,
  );
}

describe("RoofTracePane", () => {
  it("announces tracing mode over the map while it is on", () => {
    // While the mode is on, every click drops a corner. The one mistake worth
    // designing against is not realising that, so the map itself has to say.
    renderPane(true);

    const status = screen.getByRole("status");
    expect(status.textContent).toMatch(/tracing/i);
  });

  it("keeps the indicator clear of the clicks it describes", () => {
    renderPane(true);

    expect(screen.getByRole("status").className).toContain(
      "pointer-events-none",
    );
  });

  it("shows nothing while tracing is off", () => {
    renderPane(false);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
