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
