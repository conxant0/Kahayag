// Verifies the boundary that decides whether an assessment can be produced.
import { describe, expect, it } from "vitest";

import {
  SERVICE_AREA_BOXES,
  isWithinServiceArea,
} from "../../../../src/shared/config/serviceArea";

describe("isWithinServiceArea", () => {
  it.each([
    ["Cebu City", 10.3157, 123.8854],
    ["Metro Manila", 14.5995, 120.9842],
    ["Davao", 7.1907, 125.4553],
    ["Baguio", 16.4023, 120.596],
    ["Puerto Princesa, Palawan", 9.7392, 118.7353],
    ["Basco, Batanes", 20.4487, 121.9702],
    ["Bongao, Tawi-Tawi", 5.0292, 119.7731],
    ["Zamboanga City", 6.9214, 122.079],
  ])("accepts %s", (_name, latitude, longitude) => {
    expect(isWithinServiceArea({ latitude, longitude })).toBe(true);
  });

  it.each([
    ["Singapore", 1.3521, 103.8198],
    ["Hong Kong", 22.3193, 114.1694],
    ["Jakarta", -6.2088, 106.8456],
    ["London", 51.5072, -0.1276],
  ])("rejects %s", (_name, latitude, longitude) => {
    expect(isWithinServiceArea({ latitude, longitude })).toBe(false);
  });

  // These are the neighbours a single box spanning the whole country would
  // have swallowed, which is the reason it is several boxes instead.
  it.each([
    ["Taipei, Taiwan", 25.033, 121.5654],
    ["Kaohsiung, Taiwan", 22.6273, 120.3014],
    ["Kota Kinabalu, Sabah", 5.9804, 116.0735],
    ["Sandakan, Sabah", 5.8402, 118.1179],
    ["open water west of Palawan", 12.0, 116.2],
  ])("rejects %s, which a single box would have accepted", (_n, lat, lon) => {
    expect(isWithinServiceArea({ latitude: lat, longitude: lon })).toBe(false);
  });

  it("accepts the corners of every box it defines", () => {
    for (const box of SERVICE_AREA_BOXES) {
      // Inclusive on purpose: a point exactly on a boundary is inside it.
      expect(
        isWithinServiceArea({
          latitude: box.minLatitude,
          longitude: box.minLongitude,
        }),
      ).toBe(true);
      expect(
        isWithinServiceArea({
          latitude: box.maxLatitude,
          longitude: box.maxLongitude,
        }),
      ).toBe(true);
    }
  });

  it.each([
    ["NaN latitude", Number.NaN, 123.8854],
    ["infinite latitude", Number.POSITIVE_INFINITY, 123.8854],
    ["NaN longitude", 10.3157, Number.NaN],
  ])("rejects %s rather than comparing it", (_name, latitude, longitude) => {
    // Comparing against NaN is false either way, so this asserts the guard
    // exists rather than that the arithmetic happens to work out.
    expect(isWithinServiceArea({ latitude, longitude })).toBe(false);
  });
});
