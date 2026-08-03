// Selects a Solar data-layers request centered on the traced roof when present.
import type { GeoPoint } from "../../shared/api/types";

const EARTH_RADIUS_METERS = 6_371_000;
const MIN_FLUX_RADIUS_METERS = 50;
const MAX_FLUX_RADIUS_METERS = 175;
const FLUX_RADIUS_BUFFER_METERS = 30;

export interface FluxRequest {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  centeredOn: "property" | "trace";
}

function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const radians = Math.PI / 180;
  const latitudeA = a.latitude * radians;
  const latitudeB = b.latitude * radians;
  const deltaLatitude = latitudeB - latitudeA;
  const deltaLongitude = (b.longitude - a.longitude) * radians;
  const square =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(deltaLongitude / 2) ** 2;
  return (
    EARTH_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(square), Math.sqrt(1 - square))
  );
}

export function computeFluxRequestFromRoof(
  coordinates: readonly GeoPoint[],
  fallbackProperty: GeoPoint,
): FluxRequest {
  if (coordinates.length < 3) {
    return {
      latitude: fallbackProperty.latitude,
      longitude: fallbackProperty.longitude,
      radiusMeters: 100,
      centeredOn: "property",
    };
  }

  const centroid = coordinates.reduce(
    (total, coordinate) => ({
      latitude: total.latitude + coordinate.latitude / coordinates.length,
      longitude: total.longitude + coordinate.longitude / coordinates.length,
    }),
    { latitude: 0, longitude: 0 },
  );
  const maximumDistance = Math.max(
    ...coordinates.map((coordinate) =>
      haversineDistanceMeters(centroid, coordinate),
    ),
  );

  return {
    latitude: centroid.latitude,
    longitude: centroid.longitude,
    radiusMeters: Math.min(
      MAX_FLUX_RADIUS_METERS,
      Math.max(
        MIN_FLUX_RADIUS_METERS,
        Math.ceil(maximumDistance + FLUX_RADIUS_BUFFER_METERS),
      ),
    ),
    centeredOn: "trace",
  };
}

export function extendBoundsWithCoordinates<
  T extends { north: number; south: number; east: number; west: number },
>(bounds: T, coordinates: readonly GeoPoint[]): T {
  return coordinates.reduce(
    (next, coordinate) => ({
      ...next,
      north: Math.max(next.north, coordinate.latitude),
      south: Math.min(next.south, coordinate.latitude),
      east: Math.max(next.east, coordinate.longitude),
      west: Math.min(next.west, coordinate.longitude),
    }),
    { ...bounds },
  );
}
