import { useCallback, useEffect, useRef } from "react";

import { getMapTypeId, propertyPinIcon } from "../../../integrations/maps";
import type { GoogleMapsStatus } from "../../../integrations/maps";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "../../../shared/hooks/usePrefersReducedMotion";
import { cn } from "../../../shared/lib/cn";
import type { SelectedProperty } from "../../../state/assessmentStore";

/** Held this long, a touch is placing a pin rather than starting a pan. */
const LONG_PRESS_MS = 400;
/** Past this much travel, a press is panning the map and not aiming at it. */
const PAN_SLOP_PX = 10;

/**
 * The satellite pane, and the only place the pin is set.
 *
 * There is no placement mode. A mode meant the map ignored clicks until a
 * button had been pressed, which is the opposite of what a map affords: the
 * obvious thing to do with one is click the place you mean. The map is always
 * live, and the work is in telling a deliberate placement apart from someone
 * moving the map around to look for their roof.
 */
export function PropertyMapPane({
  selectedProperty,
  googleStatus,
  onMapSelect,
}: {
  selectedProperty: SelectedProperty | null;
  googleStatus: GoogleMapsStatus;
  onMapSelect: (latitude: number, longitude: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const mapClickListenerRef = useRef<GoogleMapsEventListener | null>(null);

  /**
   * On a touch screen a tap has to be held before it places anything,
   * otherwise there is no plain gesture left for panning to the roof in the
   * first place. With a mouse the click is already unambiguous.
   */
  const isTouch = useMediaQuery("(hover: none)");

  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const heldLongEnoughRef = useRef(false);
  const longPressTimerRef = useRef(0);

  const prefersReducedMotion = usePrefersReducedMotion();

  /**
   * Puts the pin down, dropping it in so the landing is seen.
   *
   * The marker is rebuilt on every placement rather than moved. Maps runs a
   * marker's animation as it is added to the map, so setting one on a marker
   * that is already there is unreliable: it played on some placements and not
   * others. Building a fresh marker with the animation already set is the only
   * version that runs every time, and one marker is cheap to replace.
   *
   * Reduced motion gets the same pin without the fall.
   */
  const placeMarker = useCallback(
    (map: GoogleMap, center: GoogleLatLngLiteral, title?: string) => {
      if (!window.google?.maps?.Marker) {
        return;
      }

      markerRef.current?.setMap(null);
      markerRef.current = new window.google.maps.Marker({
        map,
        position: center,
        icon: propertyPinIcon(window.google?.maps),
        title,
        animation: prefersReducedMotion
          ? undefined
          : window.google?.maps?.Animation?.DROP,
      });
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    if (!selectedProperty || googleStatus !== "ready") {
      return;
    }

    const { latitude, longitude } = selectedProperty;
    const center = { lat: latitude, lng: longitude };
    const mapTypeId = getMapTypeId(window.google?.maps);

    if (!mapInstanceRef.current) {
      if (!window.google?.maps?.Map || !mapRef.current) {
        return;
      }

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 19,
        mapTypeId,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
    } else {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setMapTypeId(mapTypeId);
    }

    placeMarker(mapInstanceRef.current, center, selectedProperty.address);

    if (window.google?.maps?.event) {
      window.google.maps.event.trigger(mapInstanceRef.current, "resize");
    }
  }, [selectedProperty, googleStatus, placeMarker]);

  useEffect(() => {
    const container = mapRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current && window.google?.maps?.event) {
        window.google.maps.event.trigger(mapInstanceRef.current, "resize");
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [selectedProperty, googleStatus]);

  // Sets the pin. Maps does not report a click after a drag, and the pointer
  // guards below cover the smaller movements it still counts as a click.
  useEffect(() => {
    if (
      googleStatus !== "ready" ||
      !mapInstanceRef.current ||
      !window.google?.maps
    ) {
      return;
    }

    mapClickListenerRef.current = mapInstanceRef.current.addListener(
      "click",
      (event) => {
        if (!event.latLng || draggedRef.current) {
          return;
        }

        if (isTouch && !heldLongEnoughRef.current) {
          return;
        }

        heldLongEnoughRef.current = false;
        onMapSelect(event.latLng.lat(), event.latLng.lng());
      },
    );

    return () => {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove();
        mapClickListenerRef.current = null;
      }
    };
  }, [googleStatus, onMapSelect, isTouch, selectedProperty]);

  /**
   * Tells aiming apart from panning, for both kinds of pointer.
   *
   * A press that travels is someone moving the map, so it never places
   * anything. On touch a press also has to last, which leaves plain tap and
   * drag to Maps so the map still moves the way a map should.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || googleStatus !== "ready") {
      return undefined;
    }

    const clearHold = () => {
      window.clearTimeout(longPressTimerRef.current);
      heldLongEnoughRef.current = false;
    };

    const handleDown = (event: PointerEvent) => {
      pressOriginRef.current = { x: event.clientX, y: event.clientY };
      draggedRef.current = false;
      clearHold();

      if (event.pointerType !== "touch") {
        return;
      }

      longPressTimerRef.current = window.setTimeout(() => {
        heldLongEnoughRef.current = true;
      }, LONG_PRESS_MS);
    };

    const handleMove = (event: PointerEvent) => {
      const origin = pressOriginRef.current;
      if (!origin) {
        return;
      }

      const travelled = Math.hypot(
        event.clientX - origin.x,
        event.clientY - origin.y,
      );
      if (travelled > PAN_SLOP_PX) {
        draggedRef.current = true;
        clearHold();
      }
    };

    const handleUp = () => {
      pressOriginRef.current = null;
      window.clearTimeout(longPressTimerRef.current);
    };

    const handleLeave = () => {
      pressOriginRef.current = null;
      clearHold();
    };

    frame.addEventListener("pointerdown", handleDown);
    frame.addEventListener("pointermove", handleMove);
    frame.addEventListener("pointerup", handleUp);
    frame.addEventListener("pointercancel", handleLeave);
    frame.addEventListener("pointerleave", handleLeave);

    return () => {
      frame.removeEventListener("pointerdown", handleDown);
      frame.removeEventListener("pointermove", handleMove);
      frame.removeEventListener("pointerup", handleUp);
      frame.removeEventListener("pointercancel", handleLeave);
      frame.removeEventListener("pointerleave", handleLeave);
      window.clearTimeout(longPressTimerRef.current);
    };
  }, [googleStatus, isTouch]);

  // Maps paints its own cursor over the tiles, so the crosshair has to be set
  // through the map rather than by a class on the container alone.
  useEffect(() => {
    if (googleStatus !== "ready" || !mapInstanceRef.current) {
      return;
    }

    mapInstanceRef.current.setOptions({ draggableCursor: "crosshair" });
  }, [googleStatus, selectedProperty]);

  return (
    <div ref={frameRef} className="absolute inset-0">
      <div
        ref={mapRef}
        aria-label="Selected property satellite map"
        className={cn(
          "absolute inset-0 min-h-56",
          selectedProperty && "cursor-crosshair",
        )}
      >
        {!selectedProperty && (
          <div className="flex size-full items-center justify-center p-6 font-sans text-sm text-secondary">
            Allow location access or search an address to view your roof on the
            satellite map.
          </div>
        )}
      </div>
    </div>
  );
}
