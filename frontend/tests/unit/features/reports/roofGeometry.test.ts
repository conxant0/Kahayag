import { describe, expect, it } from "vitest";

import {
  formatRoofOrientation,
  formatRoofPitch,
  summarizeRoofGeometry,
} from "../../../../src/features/reports/roofGeometry";

describe("summarizeRoofGeometry", () => {
  it("returns area-weighted pitch and azimuth from roof segments", () => {
    const summary = summarizeRoofGeometry([
      { area_m2: "40.8", pitch_degrees: "14.0", azimuth_degrees: "168.0" },
      { area_m2: "36.1", pitch_degrees: "16.0", azimuth_degrees: "175.0" },
      { area_m2: "21.7", pitch_degrees: "12.0", azimuth_degrees: "170.0" },
    ]);

    expect(summary?.pitchDegrees).toBeCloseTo(14.3, 0);
    expect(summary?.azimuthDegrees).toBeCloseTo(171, 0);
    expect(formatRoofPitch(summary!.pitchDegrees)).toBe("14°");
    expect(formatRoofOrientation(summary!.azimuthDegrees)).toBe("171° S");
  });
});
