// Defines the area this assessment covers, and the check every pick passes.
//
// Configuration rather than a feature detail: the geocoding adapter scopes its
// search by it and the property screen rejects by it, so it cannot live inside
// either without one depending on the other.
import type { LatLng } from "../../integrations/maps";

/**
 * The Philippines, as a bounding box.
 *
 * A box rather than a border: the question here is whether an assessment can
 * be produced at all, and every input this rejects is thousands of kilometres
 * out rather than a metre over a coastline. Tracing the actual border would be
 * a large polygon to ship and to keep current, for a distinction no user of
 * this step can make.
 *
 * Wide enough to include Batanes in the north, Tawi-Tawi in the south, the
 * Kalayaan group in the west and the eastern seaboard.
 */
export const SERVICE_AREA_BOUNDS = Object.freeze({
  minLatitude: 4.2,
  maxLatitude: 21.4,
  minLongitude: 116.0,
  maxLongitude: 127.0,
});

/** The country code the geocoder is scoped to, so search cannot stray. */
export const SERVICE_AREA_COUNTRY_CODE = "ph";

export const OUTSIDE_SERVICE_AREA_MESSAGE =
  "That location is outside the Philippines. Kahayag only assesses roofs in the Philippines, so pick a spot inside the country.";

/**
 * Whether a point can be assessed.
 *
 * Checked on every route in, not just search: the solar figures downstream are
 * built on Philippine irradiance and a Philippine tariff, so a pin dropped on
 * another continent would produce numbers that look real and mean nothing.
 */
export function isWithinServiceArea(position: LatLng): boolean {
  const { latitude, longitude } = position;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  return (
    latitude >= SERVICE_AREA_BOUNDS.minLatitude &&
    latitude <= SERVICE_AREA_BOUNDS.maxLatitude &&
    longitude >= SERVICE_AREA_BOUNDS.minLongitude &&
    longitude <= SERVICE_AREA_BOUNDS.maxLongitude
  );
}
