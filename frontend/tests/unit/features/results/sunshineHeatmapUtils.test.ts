import { describe, expect, it } from "vitest";

import {
  MAP_VIEW_MODES,
  normalizeShadingSegments,
  retentionRatioToColor,
  segmentRadiusMeters,
} from "../../../../src/features/results/sunshineHeatmapUtils";

describe("sunshineHeatmapUtils", () => {
  it("maps low retention to orange and high retention to bright yellow", () => {
    expect(retentionRatioToColor(0.6)).toMatch(/^rgb\(/);
    expect(retentionRatioToColor(0.95)).not.toBe(retentionRatioToColor(0.6));
  });

  it("normalizes shading segments for map rendering", () => {
    const segments = normalizeShadingSegments({
      roof_segments: [
        {
          segment_index: 0,
          center_latitude: "10.3159",
          center_longitude: "123.8852",
          area_m2: "40.8",
          pitch_degrees: "21.3",
          azimuth_degrees: "78.1",
          median_sunshine_hours_per_year: "1585.0",
          sunshine_retention_ratio: "0.94",
        },
      ],
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]!.center.latitude).toBeCloseTo(10.3159);
    expect(segments[0]!.retentionRatio).toBe(0.94);
    expect(segmentRadiusMeters(Math.PI)).toBeCloseTo(1, 5);
    expect(MAP_VIEW_MODES.flux).toBe("flux");
  });
});
