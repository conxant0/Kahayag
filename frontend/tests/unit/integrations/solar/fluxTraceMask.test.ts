import { describe, expect, it } from "vitest";

import {
  buildTraceMaskGeoTiff,
  chooseFluxDisplayMask,
  computeFluxRangeForMask,
} from "../../../../src/integrations/solar/fluxTraceMask";
import type { GeoTiffRaster } from "../../../../src/integrations/solar/geoTiffLoader";

const flux: GeoTiffRaster = {
  width: 4,
  height: 4,
  bounds: { north: 10.32, south: 10.31, east: 123.89, west: 123.88 },
  rasters: [
    [
      -9999, 900, 900, -9999, 900, 1200, 1200, 900, 900, 1500, 1500, 900, -9999,
      900, 900, -9999,
    ],
  ],
};
const roofCoordinates = [
  { latitude: 10.31, longitude: 123.88 },
  { latitude: 10.32, longitude: 123.88 },
  { latitude: 10.32, longitude: 123.89 },
  { latitude: 10.31, longitude: 123.89 },
];

describe("fluxTraceMask", () => {
  it("prefers a mask built from the traced roof", () => {
    const googleMask: GeoTiffRaster = {
      width: 4,
      height: 4,
      bounds: flux.bounds,
      rasters: [[0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    };

    const displayMask = chooseFluxDisplayMask({
      googleMask,
      flux,
      roofCoordinates,
    });

    expect(displayMask).not.toBe(googleMask);
    expect(
      displayMask?.rasters[0]?.filter((value) => value === 1).length,
    ).toBeGreaterThan(1);
  });

  it("computes the display range from traced-roof pixels", () => {
    const traceMask = buildTraceMaskGeoTiff(flux, roofCoordinates);
    const range = computeFluxRangeForMask(
      flux.rasters[0]!,
      traceMask.rasters[0],
    );

    expect(range.min).toBeGreaterThanOrEqual(900);
    expect(range.max).toBeGreaterThan(range.min);
  });
});
