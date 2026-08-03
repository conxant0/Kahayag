import type { SelectedProperty } from "../../state/assessmentStore";

export const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js";

export const DEMO_PROPERTY = Object.freeze({
  placeId: "demo-property",
  name: "Demo property",
  address: "Demo property, Cebu City, Philippines",
  latitude: 10.3157,
  longitude: 123.8854,
  source: "demo",
});

/** The loose shape a selection arrives in, before it is normalised. */
export type PropertyCandidate = {
  placeId?: string | null;
  name?: string | null;
  address?: string | null;
  latitude: number | string;
  longitude: number | string;
  source?: string | null;
};

export function getGoogleMapsUrl({
  latitude,
  longitude,
  placeId,
}: {
  latitude: number;
  longitude: number;
  placeId?: string | null;
}) {
  const latLng = `${latitude},${longitude}`;

  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latLng)}&query_place_id=${encodeURIComponent(placeId)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latLng)}`;
}

export function normalizePropertySelection(
  property: PropertyCandidate | null | undefined,
): SelectedProperty | null {
  if (!property) {
    return null;
  }

  return {
    placeId: property.placeId ?? null,
    name: property.name ?? property.address ?? "Selected property",
    address: property.address ?? property.name ?? "Selected property",
    latitude: Number(property.latitude),
    longitude: Number(property.longitude),
    source: property.source ?? "search",
  };
}

export function getMapTypeId(googleMapsApi: GoogleMapsApi | undefined) {
  const mapTypeId = googleMapsApi?.MapTypeId;

  if (mapTypeId?.SATELLITE) {
    return mapTypeId.SATELLITE;
  }

  if (mapTypeId?.HYBRID) {
    return mapTypeId.HYBRID;
  }

  return "satellite";
}

/**
 * The property marker, drawn from the same pin as the rest of the interface.
 *
 * Red, like the stock marker, because that is what a map pin looks like and a
 * satellite photo is no place to be clever about it. The silhouette is the
 * shared `PinIcon` and the fill is our own ember rather than Google's red, with
 * a paper outline and a soft shadow so it holds up over pale roofs and dark
 * foliage alike.
 *
 * Inlined as a data URI: the artwork is a few hundred bytes, and a marker that
 * has to be fetched pops in a frame late every time the map recentres.
 */
const PROPERTY_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">
  <defs>
    <filter id="s" x="-50%" y="-30%" width="200%" height="180%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M17 43C17 43 29 32.6 29 20.5C29 13.6 23.6 8 17 8C10.4 8 5 13.6 5 20.5C5 32.6 17 43 17 43Z" fill="#B23511"/>
    <path d="M17 43C17 43 29 32.6 29 20.5C29 13.6 23.6 8 17 8C10.4 8 5 13.6 5 20.5C5 32.6 17 43 17 43Z" fill="none" stroke="#FCFAF5" stroke-width="1.8"/>
    <circle cx="17" cy="20" r="4.4" fill="#FCFAF5"/>
  </g>
</svg>`;

const PROPERTY_PIN_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  PROPERTY_PIN_SVG,
)}`;

/**
 * Anchored on the point rather than the centre, so the pin marks the coordinate
 * it was given instead of hovering half a pin above it.
 */
export function propertyPinIcon(
  googleMapsApi: GoogleMapsApi | undefined,
): GoogleMarkerIcon | string {
  if (!googleMapsApi?.Size || !googleMapsApi?.Point) {
    return PROPERTY_PIN_URL;
  }

  return {
    url: PROPERTY_PIN_URL,
    scaledSize: new googleMapsApi.Size(34, 46),
    anchor: new googleMapsApi.Point(17, 43),
  };
}
