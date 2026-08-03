// Masks solar flux rasters to the homeowner's traced roof polygon.
import type { GeoPoint } from "../../shared/api/types";
import { INVALID_FLUX_VALUE } from "./geoTiffLoader";
import type { GeoTiffRaster } from "./geoTiffLoader";

const EARTH_RADIUS_METERS = 6_371_000;

interface Point2D {
  x: number;
  y: number;
}

function projectPoint(coordinate: GeoPoint, averageLatitude: number): Point2D {
  const radians = Math.PI / 180;
  return {
    x:
      EARTH_RADIUS_METERS *
      coordinate.longitude *
      radians *
      Math.cos(averageLatitude * radians),
    y: EARTH_RADIUS_METERS * coordinate.latitude * radians,
  };
}

function isPointInPolygon(
  point: Point2D,
  polygon: readonly Point2D[],
): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    if (
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y) +
          current.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pixelCenter(x: number, y: number, flux: GeoTiffRaster): GeoPoint {
  const { bounds, width, height } = flux;
  return {
    longitude: bounds.west + ((x + 0.5) / width) * (bounds.east - bounds.west),
    latitude:
      bounds.north - ((y + 0.5) / height) * (bounds.north - bounds.south),
  };
}

export function buildTraceMaskGeoTiff(
  flux: GeoTiffRaster,
  roofCoordinates: readonly GeoPoint[],
): GeoTiffRaster {
  const maskValues = new Array<number>(flux.width * flux.height).fill(0);
  if (roofCoordinates.length < 3) {
    return { ...flux, rasters: [maskValues] };
  }

  const averageLatitude =
    roofCoordinates.reduce((sum, point) => sum + point.latitude, 0) /
    roofCoordinates.length;
  const polygon = roofCoordinates.map((point) =>
    projectPoint(point, averageLatitude),
  );

  for (let y = 0; y < flux.height; y += 1) {
    for (let x = 0; x < flux.width; x += 1) {
      if (
        isPointInPolygon(
          projectPoint(pixelCenter(x, y, flux), averageLatitude),
          polygon,
        )
      ) {
        maskValues[y * flux.width + x] = 1;
      }
    }
  }

  return { ...flux, rasters: [maskValues] };
}

export function chooseFluxDisplayMask({
  googleMask,
  flux,
  roofCoordinates,
}: {
  googleMask?: GeoTiffRaster | null;
  flux: GeoTiffRaster;
  roofCoordinates?: readonly GeoPoint[];
}): GeoTiffRaster | null {
  return roofCoordinates && roofCoordinates.length >= 3
    ? buildTraceMaskGeoTiff(flux, roofCoordinates)
    : (googleMask ?? null);
}

export function computeFluxRangeForMask(
  fluxRaster: readonly number[],
  maskRaster?: readonly number[] | null,
): { min: number; max: number } {
  const values = fluxRaster
    .filter(
      (value, index) =>
        (!maskRaster || maskRaster[index]! > 0) &&
        value !== INVALID_FLUX_VALUE &&
        Number.isFinite(value) &&
        value > 0,
    )
    .sort((left, right) => left - right);

  if (!values.length) {
    return { min: 0, max: 1 };
  }

  const lowerIndex = Math.floor(values.length * 0.05);
  const upperIndex = Math.max(lowerIndex, Math.ceil(values.length * 0.95) - 1);
  return { min: values[lowerIndex]!, max: values[upperIndex]! };
}
