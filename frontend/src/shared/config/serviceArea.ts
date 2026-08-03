// Defines the area this assessment covers, and the check every pick passes.
//
// Configuration rather than a feature detail: the geocoding adapter scopes its
// search by it and the property screen rejects by it, so it cannot live inside
// either without one depending on the other.
import type { LatLng } from "../../integrations/maps";

/**
 * The Philippines, as a small set of boxes rather than one.
 *
 * A single box spanning the whole country also swallows Taiwan to the north,
 * Sabah to the south-west and a wide stretch of the South China Sea, so it
 * would accept points that are plainly not here. Grouping the archipelago
 * instead keeps the obvious neighbours out while staying something that can be
 * read, checked and corrected by hand.
 *
 * Still an approximation, and deliberately so: it decides whether an
 * assessment can be produced at all, and every point it turns away is tens of
 * kilometres out rather than a metre over a coastline. A precise border would
 * be a large polygon to ship and to keep current for a distinction nobody
 * using this step can make. The authoritative check is the geocoder, which is
 * scoped to the country and therefore cannot return a foreign address at all.
 */
export const SERVICE_AREA_BOXES = Object.freeze([
  // Luzon, Batanes and the Babuyan group, stopping short of Taiwan.
  Object.freeze({
    minLatitude: 12.2,
    maxLatitude: 21.3,
    minLongitude: 119.6,
    maxLongitude: 124.4,
  }),
  // Palawan and the Calamianes.
  Object.freeze({
    minLatitude: 7.6,
    maxLatitude: 12.6,
    minLongitude: 116.9,
    maxLongitude: 121.4,
  }),
  // The Visayas, Bicol and Mindoro.
  Object.freeze({
    minLatitude: 8.8,
    maxLatitude: 14.0,
    minLongitude: 120.2,
    maxLongitude: 126.2,
  }),
  // Mindanao.
  Object.freeze({
    minLatitude: 5.3,
    maxLatitude: 10.1,
    minLongitude: 121.7,
    maxLongitude: 126.7,
  }),
  // Sulu and Tawi-Tawi, kept east of Sabah.
  Object.freeze({
    minLatitude: 4.5,
    maxLatitude: 7.0,
    minLongitude: 119.2,
    maxLongitude: 122.4,
  }),
]);

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

  return SERVICE_AREA_BOXES.some(
    (box) =>
      latitude >= box.minLatitude &&
      latitude <= box.maxLatitude &&
      longitude >= box.minLongitude &&
      longitude <= box.maxLongitude,
  );
}
