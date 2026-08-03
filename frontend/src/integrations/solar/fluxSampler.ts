// Samples annual solar flux values at WGS84 coordinates.
import type { GeoPoint } from "../../shared/api/types";
import { INVALID_FLUX_VALUE } from "./geoTiffLoader";
import type { GeoTiffRaster } from "./geoTiffLoader";

export type FluxSampler = (latitude: number, longitude: number) => number;

function isValidFlux(value: number): boolean {
  return value !== INVALID_FLUX_VALUE && Number.isFinite(value) && value > 0;
}

export function createFluxSampler(flux: GeoTiffRaster): FluxSampler {
  const raster = flux.rasters[0];
  if (!raster?.length || flux.width < 1 || flux.height < 1) {
    return () => INVALID_FLUX_VALUE;
  }

  const { bounds, width, height } = flux;
  const longitudeSpan = bounds.east - bounds.west;
  const latitudeSpan = bounds.north - bounds.south;

  return (latitude, longitude) => {
    if (
      longitudeSpan <= 0 ||
      latitudeSpan <= 0 ||
      latitude < bounds.south ||
      latitude > bounds.north ||
      longitude < bounds.west ||
      longitude > bounds.east
    ) {
      return INVALID_FLUX_VALUE;
    }

    const x = ((longitude - bounds.west) / longitudeSpan) * (width - 1);
    const y = ((bounds.north - latitude) / latitudeSpan) * (height - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    const values = [
      raster[y0 * width + x0]!,
      raster[y0 * width + x1]!,
      raster[y1 * width + x0]!,
      raster[y1 * width + x1]!,
    ];
    const validValues = values.filter(isValidFlux);

    if (validValues.length < 4) {
      return validValues.length
        ? validValues.reduce((sum, value) => sum + value, 0) /
            validValues.length
        : INVALID_FLUX_VALUE;
    }

    const fx = x - x0;
    const fy = y - y0;
    return (
      (1 - fx) * (1 - fy) * values[0]! +
      fx * (1 - fy) * values[1]! +
      (1 - fx) * fy * values[2]! +
      fx * fy * values[3]!
    );
  };
}

export function averageFluxAtCoordinates(
  coordinates: readonly GeoPoint[],
  sample: FluxSampler,
): number {
  const values = coordinates
    .map(({ latitude, longitude }) => sample(latitude, longitude))
    .filter(isValidFlux);

  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : Number.NEGATIVE_INFINITY;
}
