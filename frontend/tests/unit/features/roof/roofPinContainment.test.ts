// Verifies that the outline has to keep standing on the property pin.
import { describe, expect, it } from "vitest";

import {
  centreOutlineOn,
  isPointInsidePolygon,
  slideOutlineToCover,
} from "../../../../src/features/roof/roofUtils";
import { outlineToCorners } from "../../../../src/integrations/buildingOutline";
import davaoMatina from "../../../fixtures/davaoMatinaOutline.json";

const PIN = { latitude: 10.3157, longitude: 123.8854 };

type Corner = { latitude: number; longitude: number };

/** How far a pure translation moved the shape, in metres. */
function shiftMetres(before: Corner[], after: Corner[]) {
  const metresPerLatitude = 111_195;
  const metresPerLongitude =
    metresPerLatitude * Math.cos((before[0].latitude * Math.PI) / 180);
  return Math.hypot(
    (after[0].latitude - before[0].latitude) * metresPerLatitude,
    (after[0].longitude - before[0].longitude) * metresPerLongitude,
  );
}

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

describe("slideOutlineToCover", () => {
  it("leaves a shape already covering the pin untouched", () => {
    expect(slideOutlineToCover(SQUARE, PIN)).toBe(SQUARE);
  });

  it("slides only as far as covering the pin requires", () => {
    // A long building whose near end sits by the pin: the centroid move drags
    // the whole shape until its middle is on the pin, while the shortest slide
    // barely has to move it. The 0.0009° of longitude is roughly 100 m.
    const longBuilding = [
      { latitude: 10.31575, longitude: 123.88545 },
      { latitude: 10.31595, longitude: 123.88545 },
      { latitude: 10.31595, longitude: 123.88635 },
      { latitude: 10.31575, longitude: 123.88635 },
    ];

    const slid = slideOutlineToCover(longBuilding, PIN);
    const centred = centreOutlineOn(longBuilding, PIN);

    expect(isPointInsidePolygon(slid, PIN)).toBe(true);
    expect(shiftMetres(longBuilding, slid)).toBeLessThan(15);
    expect(shiftMetres(longBuilding, centred)).toBeGreaterThan(45);
  });

  it("keeps the size and angle it was given", () => {
    const off = SQUARE.map((corner) => ({
      latitude: corner.latitude + 0.0006,
      longitude: corner.longitude + 0.0003,
    }));

    const slid = slideOutlineToCover(off, PIN);
    const span = (points: typeof SQUARE, key: "latitude" | "longitude") =>
      Math.max(...points.map((p) => p[key])) -
      Math.min(...points.map((p) => p[key]));

    expect(isPointInsidePolygon(slid, PIN)).toBe(true);
    expect(span(slid, "latitude")).toBeCloseTo(span(off, "latitude"), 10);
    expect(span(slid, "longitude")).toBeCloseTo(span(off, "longitude"), 10);
  });

  it("falls back to the centroid move when sliding cannot cover the pin", () => {
    // Three collinear points enclose nothing, so no slide can ever cover the
    // pin. The centroid move is the honest last resort either way.
    const degenerate = [
      { latitude: 10.316, longitude: 123.886 },
      { latitude: 10.3161, longitude: 123.886 },
      { latitude: 10.3162, longitude: 123.886 },
    ];

    expect(slideOutlineToCover(degenerate, PIN)).toEqual(
      centreOutlineOn(degenerate, PIN),
    );
  });

  it("keeps the real Davao Matina fit on its own roof", () => {
    // Captured payload: a large L-shaped roof whose fitted outline reads the
    // imagery correctly but does not quite reach the block-level pin. The
    // centroid move used to drag it ~32 m onto the neighbouring lots; the
    // shortest slide covers the pin while staying by the building.
    const corners = outlineToCorners(davaoMatina.outline, davaoMatina.pin)!;

    expect(corners.length).toBeGreaterThan(4);
    expect(isPointInsidePolygon(corners, davaoMatina.pin)).toBe(false);

    const slid = slideOutlineToCover(corners, davaoMatina.pin);
    const centred = centreOutlineOn(corners, davaoMatina.pin);

    expect(isPointInsidePolygon(slid, davaoMatina.pin)).toBe(true);
    expect(shiftMetres(corners, slid)).toBeLessThan(
      shiftMetres(corners, centred) / 3,
    );
  });
});
