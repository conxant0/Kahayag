import { afterEach, describe, expect, it, vi } from "vitest";

import { renderSolarFluxPalette } from "../../../../src/integrations/solar/fluxRenderer";
import type { GeoTiffRaster } from "../../../../src/integrations/solar/geoTiffLoader";

afterEach(() => vi.restoreAllMocks());

describe("fluxRenderer", () => {
  it("maps flux to the palette and applies mask transparency", () => {
    const image = { data: new Uint8ClampedArray(8) } as ImageData;
    const context = {
      createImageData: vi.fn(() => image),
      putImageData: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const bounds = { north: 1, south: 0, east: 1, west: 0 };
    const data: GeoTiffRaster = {
      width: 2,
      height: 1,
      bounds,
      rasters: [[100, 200]],
    };
    const mask: GeoTiffRaster = {
      width: 2,
      height: 1,
      bounds,
      rasters: [[1, 0]],
    };

    renderSolarFluxPalette({
      data,
      mask,
      colors: ["000000", "ffffff"],
      min: 100,
      max: 200,
    });

    expect([...image.data]).toEqual([0, 0, 0, 255, 255, 255, 255, 0]);
    expect(context.putImageData).toHaveBeenCalledOnce();
  });
});
