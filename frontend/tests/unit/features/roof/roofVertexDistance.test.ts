// Verifies that a corner cannot wander away from the property being assessed.
import { describe, expect, it } from "vitest";

import {
  MAX_VERTEX_DISTANCE_METERS,
  hasVertexBeyondPin,
} from "../../../../src/features/roof/roofUtils";

const PIN = { latitude: 10.3157, longitude: 123.8854 };

/** Metres north of the pin, which is the axis where a degree is a fixed size. */
const north = (meters: number) => ({
  latitude: PIN.latitude + meters / 111_320,
  longitude: PIN.longitude,
});

describe("hasVertexBeyondPin", () => {
  it("accepts a roof-sized shape around the pin", () => {
    expect(hasVertexBeyondPin([north(6), north(-6), north(10)], PIN)).toBe(
      false,
    );
  });

  it("catches a single corner flicked across the neighbourhood", () => {
    // The usual cause is grabbing a corner while meaning to pan the map, and
    // the area it invents would otherwise flow into the whole assessment.
    expect(hasVertexBeyondPin([north(5), north(-5), north(400)], PIN)).toBe(
      true,
    );
  });

  it("draws the line where the constant says it does", () => {
    expect(
      hasVertexBeyondPin([north(MAX_VERTEX_DISTANCE_METERS - 1)], PIN),
    ).toBe(false);
    expect(
      hasVertexBeyondPin([north(MAX_VERTEX_DISTANCE_METERS + 1)], PIN),
    ).toBe(true);
  });

  it("has nothing to measure against without a pin", () => {
    // The rule is about the confirmed property. With no property there is no
    // claim to contradict, so this must not invent a failure.
    expect(hasVertexBeyondPin([north(5000)], null)).toBe(false);
  });
});
