// Verifies the boundary that decides whether an assessment can be produced.
import { describe, expect, it } from "vitest";

import {
  SERVICE_AREA_BOUNDS,
  isWithinServiceArea,
} from "../../../../src/shared/config/serviceArea";

describe("isWithinServiceArea", () => {
  it.each([
    ["Cebu City", 10.3157, 123.8854],
    ["Metro Manila", 14.5995, 120.9842],
    ["Davao", 7.1907, 125.4553],
    ["Batanes, the northern edge", 20.4487, 121.9702],
    ["Tawi-Tawi, the southern edge", 5.0333, 119.75],
  ])("accepts %s", (_name, latitude, longitude) => {
    expect(isWithinServiceArea({ latitude, longitude })).toBe(true);
  });

  it.each([
    ["Singapore", 1.3521, 103.8198],
    ["Hong Kong", 22.3193, 114.1694],
    ["Jakarta", -6.2088, 106.8456],
    ["London", 51.5072, -0.1276],
    ["the middle of the Pacific", 10.0, 160.0],
  ])("rejects %s", (_name, latitude, longitude) => {
    expect(isWithinServiceArea({ latitude, longitude })).toBe(false);
  });

  it("accepts the corners of its own box", () => {
    const { minLatitude, maxLatitude, minLongitude, maxLongitude } =
      SERVICE_AREA_BOUNDS;

    // Inclusive on purpose: a point exactly on the boundary is inside it.
    expect(
      isWithinServiceArea({ latitude: minLatitude, longitude: minLongitude }),
    ).toBe(true);
    expect(
      isWithinServiceArea({ latitude: maxLatitude, longitude: maxLongitude }),
    ).toBe(true);
  });

  it("rejects a point just outside each edge", () => {
    const { minLatitude, maxLatitude, minLongitude, maxLongitude } =
      SERVICE_AREA_BOUNDS;
    const nudge = 0.0001;

    expect(
      isWithinServiceArea({
        latitude: minLatitude - nudge,
        longitude: minLongitude,
      }),
    ).toBe(false);
    expect(
      isWithinServiceArea({
        latitude: maxLatitude + nudge,
        longitude: maxLongitude,
      }),
    ).toBe(false);
    expect(
      isWithinServiceArea({
        latitude: minLatitude,
        longitude: minLongitude - nudge,
      }),
    ).toBe(false);
    expect(
      isWithinServiceArea({
        latitude: maxLatitude,
        longitude: maxLongitude + nudge,
      }),
    ).toBe(false);
  });

  it.each([
    ["NaN", Number.NaN, 123.8854],
    ["Infinity", Number.POSITIVE_INFINITY, 123.8854],
    ["a non-finite longitude", 10.3157, Number.NaN],
  ])("rejects %s rather than comparing it", (_name, latitude, longitude) => {
    // A comparison against NaN is false either way, so this is asserting the
    // guard exists rather than that the arithmetic happens to work out.
    expect(isWithinServiceArea({ latitude, longitude })).toBe(false);
  });
});
