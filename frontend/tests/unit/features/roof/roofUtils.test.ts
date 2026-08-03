import { describe, expect, it } from "vitest";

import {
  MIN_VALID_ROOF_AREA_SQUARE_METERS,
  validateRoofPolygon,
} from "../../../../src/features/roof/roofUtils";

describe("validateRoofPolygon", () => {
  it("rejects polygons with fewer than three vertices", () => {
    const result = validateRoofPolygon([
      { latitude: 0, longitude: 0 },
      { latitude: 0.0001, longitude: 0.0001 },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.message).toContain("3 vertices");
  });

  it("rejects polygons that are too small to be usable", () => {
    const result = validateRoofPolygon([
      { latitude: 0, longitude: 0 },
      { latitude: 0.00001, longitude: 0 },
      { latitude: 0.00001, longitude: 0.00001 },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.message).toContain("too small");
  });

  it("accepts polygons that meet the minimum usable area", () => {
    const result = validateRoofPolygon([
      { latitude: 10.3157, longitude: 123.8854 },
      { latitude: 10.3158, longitude: 123.8854 },
      { latitude: 10.3158, longitude: 123.8855 },
      { latitude: 10.3157, longitude: 123.8855 },
    ]);

    expect(result.isValid).toBe(true);
    expect(result.areaSquareMeters).toBeGreaterThanOrEqual(
      MIN_VALID_ROOF_AREA_SQUARE_METERS,
    );
  });
});
