import { describe, expect, it } from "vitest";

import {
  computeFluxRequestFromRoof,
  extendBoundsWithCoordinates,
} from "../../../../src/features/results/roofFluxRequest";

describe("computeFluxRequestFromRoof", () => {
  const property = { latitude: 10.31, longitude: 123.88 };

  it("uses the property pin when no trace exists", () => {
    expect(computeFluxRequestFromRoof([], property)).toEqual({
      latitude: 10.31,
      longitude: 123.88,
      radiusMeters: 100,
      centeredOn: "property",
    });
  });

  it("centers on the trace and covers every roof vertex", () => {
    const request = computeFluxRequestFromRoof(
      [
        { latitude: 10.31, longitude: 123.88 },
        { latitude: 10.312, longitude: 123.88 },
        { latitude: 10.312, longitude: 123.883 },
        { latitude: 10.31, longitude: 123.883 },
      ],
      property,
    );

    expect(request.centeredOn).toBe("trace");
    expect(request.latitude).toBeCloseTo(10.311, 3);
    expect(request.longitude).toBeCloseTo(123.8815, 3);
    expect(request.radiusMeters).toBeGreaterThanOrEqual(50);
    expect(request.radiusMeters).toBeLessThanOrEqual(175);
  });
});

describe("extendBoundsWithCoordinates", () => {
  it("expands flux bounds to include the traced roof", () => {
    expect(
      extendBoundsWithCoordinates(
        { north: 10.32, south: 10.31, east: 123.89, west: 123.88 },
        [{ latitude: 10.33, longitude: 123.9 }],
      ),
    ).toMatchObject({ north: 10.33, east: 123.9 });
  });
});
