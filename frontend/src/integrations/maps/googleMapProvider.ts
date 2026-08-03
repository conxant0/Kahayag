// Defines the Google Maps implementation of `MapAdapter`.
//
// Every call into the Maps SDK lives in this file. Nothing above it names
// Google, holds a `google.maps.Map`, or knows that `LatLng` is spelled
// `{ lat, lng }` down here.
import { getMapTypeId, propertyPinIcon } from "./googleMapsHelpers";
import type {
  CreateMapOptions,
  LatLng,
  MapController,
  MapProvider,
  MarkerOptions,
  Unsubscribe,
} from "./MapAdapter";

/** Google speaks `{ lat, lng }`; the rest of the app speaks latitude/longitude. */
function toGoogle(position: LatLng): GoogleLatLngLiteral {
  return { lat: position.latitude, lng: position.longitude };
}

function createController(map: GoogleMap, api: GoogleMapsApi): MapController {
  let marker: GoogleMarker | null = null;
  const listeners: GoogleMapsEventListener[] = [];

  return {
    setCentre(position) {
      map.setCenter(toGoogle(position));
      map.setMapTypeId(getMapTypeId(api));
    },

    /**
     * Rebuilt rather than moved, because Maps runs a marker's animation as it
     * is added to the map. Re-arming one already on the map played on some
     * placements and not others; a fresh marker runs every time and one marker
     * is cheap to replace.
     */
    showMarker({ position, title, animate = false }: MarkerOptions) {
      marker?.setMap(null);
      marker = new api.Marker({
        map,
        position: toGoogle(position),
        icon: propertyPinIcon(api),
        title,
        animation: animate ? api.Animation?.DROP : undefined,
      });
    },

    onClick(handler): Unsubscribe {
      const listener = map.addListener("click", (event) => {
        if (!event.latLng) {
          return;
        }
        handler({
          latitude: event.latLng.lat(),
          longitude: event.latLng.lng(),
        });
      });

      listeners.push(listener);
      return () => listener.remove();
    },

    setCursor(cursor) {
      map.setOptions({ draggableCursor: cursor ?? undefined });
    },

    refresh() {
      api.event?.trigger(map, "resize");
    },

    destroy() {
      listeners.forEach((listener) => listener.remove());
      listeners.length = 0;
      marker?.setMap(null);
      marker = null;
    },
  };
}

/**
 * Reads the SDK off `window` at call time rather than at import time, since the
 * script is injected after the bundle has already run.
 */
export const googleMapProvider: MapProvider = {
  createMap(container: HTMLElement, options: CreateMapOptions) {
    const api = window.google?.maps;
    if (!api?.Map) {
      return null;
    }

    const map = new api.Map(container, {
      center: toGoogle(options.centre),
      zoom: options.zoom,
      mapTypeId: getMapTypeId(api),
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });

    return createController(map, api);
  },
};
