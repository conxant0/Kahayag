// Defines the public exports of the map integration.
export {
  DEMO_PROPERTY,
  getGoogleMapsUrl,
  getMapTypeId,
  normalizePropertySelection,
  propertyPinIcon,
} from "./googleMapsHelpers";
export type { PropertyCandidate } from "./googleMapsHelpers";
export { useGoogleMapsLoader } from "./googleMapsLoader";
export type { GoogleMapsStatus } from "./googleMapsLoader";
