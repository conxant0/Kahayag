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
  zoomControl?: boolean;
  zoomControlOptions?: { position: number };
  gestureHandling?: "auto" | "cooperative" | "greedy" | "none";
  /** Cursor over the tiles. Maps paints its own, so CSS alone cannot set it. */
  draggableCursor?: string;
}

interface GoogleMap {
  setOptions(options: Partial<GoogleMapOptions>): void;
  setCenter(latLng: GoogleLatLngLiteral): void;
  setZoom(zoom: number): void;
  setMapTypeId(mapTypeId: string): void;
  fitBounds(bounds: GoogleLatLngBounds, padding?: number): void;
  addListener(
    eventName: string,
    handler: (event: GoogleMapMouseEvent) => void,
  ): GoogleMapsEventListener | undefined;
}

/** Built up with `extend`, then handed to `Map.fitBounds`. */
interface GoogleLatLngBounds {
  extend(point: GoogleLatLngLiteral): GoogleLatLngBounds;
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
interface GoogleImageMarkerIcon {
  url: string;
  scaledSize?: GoogleSize;
  anchor?: GooglePoint;
}

/** A marker drawn from a vector path, used for the trace's vertex handles. */
interface GoogleSymbolMarkerIcon {
  path: number | string;
  scale?: number;
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWeight?: number;
}

type GoogleMarkerIcon = GoogleImageMarkerIcon | GoogleSymbolMarkerIcon;

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

/** The editable vertex list behind a polygon. */
interface GoogleMVCArray {
  getArray(): GoogleLatLng[];
  push(latLng: GoogleLatLngInstance): void;
  clear(): void;
  addListener(eventName: string, handler: () => void): GoogleMapsEventListener;
}

/** `new google.maps.LatLng(...)`, distinct from the accessor-only interface. */
type GoogleLatLngInstance = GoogleLatLng;

interface GooglePolygonOptions {
  map: GoogleMap | null;
  paths?: GoogleLatLngLiteral[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  fillColor?: string;
  fillOpacity?: number;
  editable?: boolean;
  clickable?: boolean;
  zIndex?: number;
}

interface GooglePolylineOptions {
  map: GoogleMap | null;
  path: GoogleLatLngLiteral[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  clickable?: boolean;
  zIndex?: number;
}

interface GooglePolyline {
  setMap(map: GoogleMap | null): void;
  setPath(path: GoogleLatLngLiteral[]): void;
  setOptions(options: Partial<GooglePolylineOptions>): void;
}

interface GoogleLatLngBoundsLiteral {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** The sunshine raster, painted to a canvas and dropped over the tiles. */
interface GoogleGroundOverlay {
  setMap(map: GoogleMap | null): void;
}

interface GooglePolygon {
  getPath(): GoogleMVCArray;
  setPath(path: GoogleLatLngLiteral[]): void;
  setOptions(options: Partial<GooglePolygonOptions>): void;
  setMap(map: GoogleMap | null): void;
  setEditable(editable: boolean): void;
  setVisible(visible: boolean): void;
}

interface GoogleMapsApi {
  /** Async bootstrap: the libraries arrive after the script itself does. */
  importLibrary?: (name: string) => Promise<unknown>;
  Map: new (container: HTMLElement, options: GoogleMapOptions) => GoogleMap;
  Marker: new (options: {
    map: GoogleMap;
    position: GoogleLatLngLiteral;
    icon?: GoogleMarkerIcon | string;
    title?: string;
    /** Set at construction; Maps runs it as the marker is added to the map. */
    animation?: number;
    clickable?: boolean;
    zIndex?: number;
  }) => GoogleMarker;
  Animation?: { DROP?: number; BOUNCE?: number };
  Polygon: new (options: GooglePolygonOptions) => GooglePolygon;
  Polyline: new (options: GooglePolylineOptions) => GooglePolyline;
  LatLng: new (latitude: number, longitude: number) => GoogleLatLngInstance;
  LatLngBounds?: new () => GoogleLatLngBounds;
  GroundOverlay?: new (
    url: string,
    bounds: GoogleLatLngBoundsLiteral,
    opts?: { opacity?: number; clickable?: boolean },
  ) => GoogleGroundOverlay;
  SymbolPath: { CIRCLE: number };
  ControlPosition?: { RIGHT_BOTTOM: number };
  Size?: new (width: number, height: number) => GoogleSize;
  Point?: new (x: number, y: number) => GooglePoint;
  Geocoder: new () => GoogleGeocoder;
  MapTypeId?: { SATELLITE?: string; HYBRID?: string };
  event?: { trigger(instance: object, eventName: string): void };
}

interface Window {
  google?: { maps?: GoogleMapsApi };
}
