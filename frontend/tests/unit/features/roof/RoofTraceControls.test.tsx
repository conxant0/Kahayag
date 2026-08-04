// Verifies the roof controls stay legible where they float over the map.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoofTraceControls } from "../../../../src/features/roof/components/RoofTraceControls";
import { resolveRoofTraceStage } from "../../../../src/features/roof/roofTraceStage";

function renderControls() {
  const stage = resolveRoofTraceStage({
    mapStatus: "ready",
    hasProperty: true,
    isTracingRoof: false,
    traceIsUsable: false,
    vertexCount: 0,
    hasConfirmedPolygon: false,
  });

  render(
    <RoofTraceControls
      stage={stage}
      vertexCount={0}
      roofMetrics={{ areaSquareMeters: 0, perimeterMeters: 0 }}
      validationMessage=""
      startRoofTracing={() => {}}
      finishRoofTracing={() => {}}
      resetRoofTracing={() => {}}
    />,
  );

  return stage;
}

describe("RoofTraceControls", () => {
  it("gives the main action an opaque fill to sit on", () => {
    /*
     * On a phone this block floats over the satellite photo. The `secondary`
     * weight fills with a 6% cobalt wash, which is a fill for a card on the
     * page: over imagery it is 94% roof, and the step's own action read as an
     * outline with the map showing through it.
     */
    const stage = renderControls();
    const action = screen.getByRole("button", { name: stage.action!.label });

    expect(action.className).toContain("bg-paper");
    expect(action.className).not.toContain("bg-cobalt-wash");
  });

  it("keeps the cobalt fill on hover, with nothing layered over it", () => {
    // The opaque backing is painted as an image layer, so hover has to clear
    // it or the solid cobalt would arrive tinted.
    const stage = renderControls();
    const action = screen.getByRole("button", { name: stage.action!.label });

    expect(action.className).toContain("hover:bg-cobalt");
    expect(action.className).toContain("hover:bg-none");
  });
});
