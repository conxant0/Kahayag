// Defines the public surface of the map integration.
//
// The provider-neutral contract and one provider that satisfies it. Google's
// own helpers stay unexported: a screen that could reach them is a screen that
// could bypass the seam.
export type {
  CreateMapOptions,
  LatLng,
  MapController,
  MapProvider,
  MapStatus,
  MarkerOptions,
  Unsubscribe,
} from "./MapAdapter";

// Renamed at the boundary on purpose: callers ask for "the map provider", not
// for Google's. Swapping providers is an edit to this line, not to any screen.
export { googleMapProvider as mapProvider } from "./googleMapProvider";

export { DEMO_PROPERTY, normalizePropertySelection } from "./googleMapsHelpers";
export type { PropertyCandidate } from "./googleMapsHelpers";

export { useGoogleMapsLoader as useMapLoader } from "./googleMapsLoader";
