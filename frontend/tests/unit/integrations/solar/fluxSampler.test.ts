import { describe, expect, it } from "vitest";

import { INVALID_FLUX_VALUE } from "../../../../src/integrations/solar/geoTiffLoader";
import {
  averageFluxAtCoordinates,
  createFluxSampler,
} from "../../../../src/integrations/solar/fluxSampler";
import type { GeoTiffRaster } from "../../../../src/integrations/solar/geoTiffLoader";

const flux: GeoTiffRaster = {
  width: 4,
  height: 4,
  bounds: { north: 10.32, south: 10.31, east: 123.89, west: 123.88 },
  rasters: [
    [
      900, 1000, 1100, 1200, 900, 1000, 1100, 1200, 900, 1000, 1100, 1200, 900,
      1000, 1100, 1200,
    ],
  ],
};

describe("fluxSampler", () => {
  it("samples higher flux toward the east of the raster", () => {
    const sample = createFluxSampler(flux);

    expect(sample(10.315, 123.889)).toBeGreaterThan(sample(10.315, 123.881));
    expect(sample(10.315, 123.9)).toBe(INVALID_FLUX_VALUE);
  });

  it("averages valid panel-corner samples", () => {
    const score = averageFluxAtCoordinates(
      [
        { latitude: 10.315, longitude: 123.888 },
        { latitude: 10.316, longitude: 123.888 },
        { latitude: 10.316, longitude: 123.889 },
        { latitude: 10.315, longitude: 123.889 },
      ],
      createFluxSampler(flux),
    );

    expect(score).toBeGreaterThan(1100);
  });
});
