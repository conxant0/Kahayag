// Defines the slice of the Google Maps JavaScript API this adapter touches.
//
// `@types/google.maps` is deliberately not installed. The adapter uses a small,
// stable corner of the API, and declaring exactly that corner keeps the vendor's
// surface visible at the boundary instead of letting an implicit global spread
// through the app. Anything not declared here is not reached for.
//
// The map is loaded from a script tag, so `window.google` is optional until the
// loader reports ready.

type GoogleLatLngLiteral = { lat: number; lng: number };

/** Places returns coordinates as either accessors or plain numbers. */
type GoogleLatLngLike = {
  lat: number | (() => number);
  lng: number | (() => number);
};

interface GoogleLatLng {
  lat(): number;
  lng(): number;
}

interface GoogleMapsEventListener {
  remove(): void;
}

interface GoogleMapMouseEvent {
  latLng: GoogleLatLng | null;
}

interface GoogleMapOptions {
  center: GoogleLatLngLiteral;
  zoom: number;
  mapTypeId: string;
  streetViewControl?: boolean;
  mapTypeControl?: boolean;
  fullscreenControl?: boolean;
  /** Cursor over the tiles. Maps paints its own, so CSS alone cannot set it. */
  draggableCursor?: string;
}

interface GoogleMap {
  setOptions(options: Partial<GoogleMapOptions>): void;
  setCenter(latLng: GoogleLatLngLiteral): void;
  setZoom(zoom: number): void;
  setMapTypeId(mapTypeId: string): void;
  addListener(
    eventName: string,
    handler: (event: GoogleMapMouseEvent) => void,
  ): GoogleMapsEventListener;
}

interface GoogleSize {
  readonly width: number;
  readonly height: number;
}

interface GooglePoint {
  readonly x: number;
  readonly y: number;
}

/** A marker drawn from our own artwork rather than the stock red teardrop. */
interface GoogleMarkerIcon {
  url: string;
  scaledSize?: GoogleSize;
  anchor?: GooglePoint;
}

interface GoogleMarker {
  setPosition(latLng: GoogleLatLngLiteral): void;
  setMap(map: GoogleMap | null): void;
  setIcon(icon: GoogleMarkerIcon | string | null): void;
  setAnimation(animation: number | null): void;
}

interface GoogleGeocoderResult {
  formatted_address?: string;
}

interface GoogleGeocoder {
  geocode(
    request: { location: GoogleLatLngLiteral },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ): void;
}

interface GooglePlace {
  location?: GoogleLatLngLike;
  geometry?: { location?: GoogleLatLngLike };
  formattedAddress?: string;
  formatted_address?: string;
  displayName?: string;
  name?: string;
  placeId?: string;
  place_id?: string;
  fetchFields?(options: { fields: string[] }): Promise<void>;
}

interface GoogleMapsApi {
  Map: new (container: HTMLElement, options: GoogleMapOptions) => GoogleMap;
  Marker: new (options: {
    map: GoogleMap;
    position: GoogleLatLngLiteral;
    icon?: GoogleMarkerIcon | string;
    title?: string;
  }) => GoogleMarker;
  Animation?: { DROP?: number; BOUNCE?: number };
  Size?: new (width: number, height: number) => GoogleSize;
  Point?: new (x: number, y: number) => GooglePoint;
  Geocoder: new () => GoogleGeocoder;
  MapTypeId?: { SATELLITE?: string; HYBRID?: string };
  event?: { trigger(instance: object, eventName: string): void };
}

interface Window {
  google?: { maps?: GoogleMapsApi };
}
