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

export { googleMapProvider } from "./googleMapProvider";

export { DEMO_PROPERTY, normalizePropertySelection } from "./googleMapsHelpers";
export type { PropertyCandidate } from "./googleMapsHelpers";

export { useGoogleMapsLoader } from "./googleMapsLoader";
