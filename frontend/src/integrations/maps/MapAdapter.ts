// Defines the contract a map provider satisfies, and the only shapes that
// cross out of `integrations/maps`.
//
// Nothing here names a vendor. A screen asks for a map, gets a `MapController`,
// and works in plain coordinates; which provider draws the tiles is settled
// inside this directory and nowhere else.

/** A point on the earth. The one coordinate shape the app passes around. */
export type LatLng = {
  latitude: number;
  longitude: number;
};

export type MapStatus = "loading" | "ready" | "failed" | "missing-key";

/** Removes whatever it was returned from. */
export type Unsubscribe = () => void;

export type MarkerOptions = {
  position: LatLng;
  /** Read by assistive tech and shown on hover. */
  title?: string;
  /** Drop it in rather than letting it appear. */
  animate?: boolean;
};

/**
 * A live map. One per container, handed back by `MapProvider.createMap`.
 *
 * Every method is provider-neutral on purpose: a caller that could tell one
 * provider from another would be a caller this seam has failed to cover.
 */
export type MapController = {
  setCentre(position: LatLng): void;
  /** Places or moves the single property marker. */
  showMarker(options: MarkerOptions): void;
  /** Fires for a click on the map. Providers do not report one after a drag. */
  onClick(handler: (position: LatLng) => void): Unsubscribe;
  /** The cursor over the tiles, which providers tend to paint themselves. */
  setCursor(cursor: string | null): void;
  /** Tells the map its container resized. */
  refresh(): void;
  destroy(): void;
};

export type CreateMapOptions = {
  centre: LatLng;
  zoom: number;
};

export type MapProvider = {
  /** Returns null when the provider is not loaded, rather than throwing. */
  createMap(
    container: HTMLElement,
    options: CreateMapOptions,
  ): MapController | null;
};
