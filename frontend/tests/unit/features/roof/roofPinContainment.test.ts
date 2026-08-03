// Verifies that the outline has to keep standing on the property pin.
import { describe, expect, it } from "vitest";

import {
  centreOutlineOn,
  isPointInsidePolygon,
} from "../../../../src/features/roof/roofUtils";

const PIN = { latitude: 10.3157, longitude: 123.8854 };

const SQUARE = [
  { latitude: 10.3156, longitude: 123.8853 },
  { latitude: 10.3158, longitude: 123.8853 },
  { latitude: 10.3158, longitude: 123.8855 },
  { latitude: 10.3156, longitude: 123.8855 },
];

describe("isPointInsidePolygon", () => {
  it("accepts a pin under the outline", () => {
    expect(isPointInsidePolygon(SQUARE, PIN)).toBe(true);
  });

  it("rejects a pin the outline has been dragged off", () => {
    const away = SQUARE.map((corner) => ({
      latitude: corner.latitude + 0.0006,
      longitude: corner.longitude,
    }));

    expect(isPointInsidePolygon(away, PIN)).toBe(false);
  });

  it("handles a turned outline, not just a square-to-north one", () => {
    // The seeded shape is turned to match the building, so a test that only
    // ever sees axis-aligned corners would not exercise the real case.
    const diamond = [
      { latitude: 10.3157, longitude: 123.8852 },
      { latitude: 10.3159, longitude: 123.8854 },
      { latitude: 10.3157, longitude: 123.8856 },
      { latitude: 10.3155, longitude: 123.8854 },
    ];

    expect(isPointInsidePolygon(diamond, PIN)).toBe(true);
    expect(
      isPointInsidePolygon(diamond, { latitude: 10.3159, longitude: 123.8856 }),
    ).toBe(false);
  });

  it("counts a corner level with the pin once, not twice", () => {
    // Two edges meet at a vertex. Counting both flips the answer back and
    // reports a pin plainly inside the shape as outside.
    const level = [
      { latitude: PIN.latitude, longitude: 123.8852 },
      { latitude: 10.316, longitude: 123.8856 },
      { latitude: 10.3154, longitude: 123.8856 },
    ];

    expect(isPointInsidePolygon(level, PIN)).toBe(true);
  });

  it("has nothing to enclose without a shape or a pin", () => {
    expect(isPointInsidePolygon(SQUARE.slice(0, 2), PIN)).toBe(false);
    expect(isPointInsidePolygon(SQUARE, null)).toBe(false);
  });
});

describe("centreOutlineOn", () => {
  it("brings a fitted shape that missed the pin back over it", () => {
    const off = SQUARE.map((corner) => ({
      latitude: corner.latitude + 0.0006,
      longitude: corner.longitude + 0.0006,
    }));

    const moved = centreOutlineOn(off, PIN);

    expect(isPointInsidePolygon(moved, PIN)).toBe(true);
  });

  it("keeps the size and angle it was given", () => {
    // The shape and angle came from the imagery and are the part worth
    // keeping. Only where it sat was ever in doubt.
    const off = SQUARE.map((corner) => ({
      latitude: corner.latitude + 0.0006,
      longitude: corner.longitude,
    }));

    const moved = centreOutlineOn(off, PIN);
    const span = (points: typeof SQUARE, key: "latitude" | "longitude") =>
      Math.max(...points.map((p) => p[key])) -
      Math.min(...points.map((p) => p[key]));

    expect(span(moved, "latitude")).toBeCloseTo(span(off, "latitude"), 10);
    expect(span(moved, "longitude")).toBeCloseTo(span(off, "longitude"), 10);
  });
});
