// Verifies the geometry rules that decide whether a trace can be used.
import { describe, expect, it } from "vitest";

import {
  DEFAULT_OUTLINE_SIDE_METERS,
  MIN_VALID_ROOF_AREA_SQUARE_METERS,
  calculateRoofMetrics,
  createDefaultRoofOutline,
  isSelfIntersecting,
  validateRoofPolygon,
} from "../../../../src/features/roof/roofUtils";

const CENTRE = { latitude: 10.3157, longitude: 123.8854 };

/** A square of `side` metres about the centre, built the same way the app does. */
const square = (side: number) => createDefaultRoofOutline(CENTRE, side);

describe("createDefaultRoofOutline", () => {
  it("produces four corners around the point it is given", () => {
    const outline = createDefaultRoofOutline(CENTRE);

    expect(outline).toHaveLength(4);
    const latitudes = outline.map((point) => point.latitude);
    const longitudes = outline.map((point) => point.longitude);
    expect(Math.min(...latitudes)).toBeLessThan(CENTRE.latitude);
    expect(Math.max(...latitudes)).toBeGreaterThan(CENTRE.latitude);
    expect(Math.min(...longitudes)).toBeLessThan(CENTRE.longitude);
    expect(Math.max(...longitudes)).toBeGreaterThan(CENTRE.longitude);
  });

  it("measures close to the side length it was asked for", () => {
    const { areaSquareMeters } = calculateRoofMetrics(square(20));

    // Within a percent: the projection is flat-earth, over 20 metres.
    expect(areaSquareMeters).toBeGreaterThan(400 * 0.99);
    expect(areaSquareMeters).toBeLessThan(400 * 1.01);
  });

  it("starts above the minimum, so tracing opens on a usable shape", () => {
    // Otherwise the first thing on screen is an error about the shape the app
    // just drew for you.
    const { areaSquareMeters } = calculateRoofMetrics(
      square(DEFAULT_OUTLINE_SIDE_METERS),
    );

    expect(areaSquareMeters).toBeGreaterThan(MIN_VALID_ROOF_AREA_SQUARE_METERS);
  });
});

describe("isSelfIntersecting", () => {
  it("accepts a square", () => {
    expect(isSelfIntersecting(square(20))).toBe(false);
  });

  it("accepts a concave outline, which is a real roof shape", () => {
    // An L-shaped roof is not convex, and rejecting it would be wrong.
    expect(
      isSelfIntersecting([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0.0002 },
        { latitude: 0.0001, longitude: 0.0002 },
        { latitude: 0.0001, longitude: 0.0001 },
        { latitude: 0.0002, longitude: 0.0001 },
        { latitude: 0.0002, longitude: 0 },
      ]),
    ).toBe(false);
  });

  it("catches a bowtie", () => {
    // Its two lobes cancel in the shoelace sum, so the area reads smaller than
    // either half. Nothing downstream can use it.
    expect(
      isSelfIntersecting([
        { latitude: 0, longitude: 0 },
        { latitude: 0.0001, longitude: 0.0001 },
        { latitude: 0, longitude: 0.0001 },
        { latitude: 0.0001, longitude: 0 },
      ]),
    ).toBe(true);
  });

  it("says nothing about shapes too small to cross", () => {
    expect(isSelfIntersecting([])).toBe(false);
    expect(
      isSelfIntersecting([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0.0001 },
        { latitude: 0.0001, longitude: 0 },
      ]),
    ).toBe(false);
  });
});

describe("validateRoofPolygon", () => {
  it("accepts a roof comfortably above the minimum", () => {
    const result = validateRoofPolygon(square(20));

    expect(result.isValid).toBe(true);
  });

  it("accepts a real roof plane, which is smaller than people assume", () => {
    // The imagery provider returns planes around 30 to 60 m² on ordinary
    // houses. A floor set by intuition rather than by the panel size rejected
    // most of them, so this pins a realistic one as acceptable.
    const result = validateRoofPolygon(square(7));

    expect(result.isValid).toBe(true);
  });

  it("refuses a roof too small to assess, and says which problem it is", () => {
    // Under one panel's footprint, which is the same floor the solar
    // calculation applies.
    const result = validateRoofPolygon(square(1));

    expect(result.isValid).toBe(false);
    expect(result.message).toMatch(/too small/i);
  });

  it("refuses a crossed outline ahead of the size rule", () => {
    // A bowtie also reads as tiny, so reporting the area would send someone off
    // to enlarge a shape whose actual problem is that it folds over itself.
    const result = validateRoofPolygon([
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0.001 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0.001, longitude: 0 },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.message).toMatch(/crosses itself/i);
  });

  it("refuses fewer than three corners", () => {
    expect(validateRoofPolygon([{ latitude: 0, longitude: 0 }]).isValid).toBe(
      false,
    );
  });
});
