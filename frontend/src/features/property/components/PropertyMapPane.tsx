import { useEffect, useRef } from "react";

import { mapProvider } from "../../../integrations/maps";
import type {
  LatLng,
  MapController,
  MapStatus,
} from "../../../integrations/maps";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "../../../shared/hooks/usePrefersReducedMotion";
import { cn } from "../../../shared/lib/cn";

/** Held this long, a touch is placing a pin rather than starting a pan. */
const LONG_PRESS_MS = 400;
/** Past this much travel, a press is panning the map and not aiming at it. */
const PAN_SLOP_PX = 10;
const ROOF_ZOOM = 19;

/**
 * The satellite pane, and the only place the pin is set.
 *
 * There is no placement mode. A mode meant the map ignored clicks until a
 * button had been pressed, which is the opposite of what a map affords: the
 * obvious thing to do with one is click the place you mean. The map is always
 * live, and the work here is telling a deliberate placement apart from someone
 * moving the map around to look for their roof.
 *
 * The map itself is reached through `MapController`, so this component names no
 * provider and holds nothing vendor-shaped.
 */
export function PropertyMapPane({
  selectedProperty,
  mapStatus,
  onMapSelect,
}: {
  selectedProperty: { position: LatLng; address: string } | null;
  mapStatus: MapStatus;
  onMapSelect: (position: LatLng) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MapController | null>(null);

  /**
   * On a touch screen a tap has to be held before it places anything,
   * otherwise there is no plain gesture left for panning to the roof in the
   * first place. With a mouse the click is already unambiguous.
   */
  const isTouch = useMediaQuery("(hover: none)");
  const prefersReducedMotion = usePrefersReducedMotion();

  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const heldLongEnoughRef = useRef(false);
  const longPressTimerRef = useRef(0);

  // Latest handler, read by the click subscription so it does not resubscribe
  // on every render just to see a new closure.
  const onMapSelectRef = useRef(onMapSelect);
  useEffect(() => {
    onMapSelectRef.current = onMapSelect;
  }, [onMapSelect]);

  const position = selectedProperty?.position ?? null;
  const latitude = position?.latitude;
  const longitude = position?.longitude;

  useEffect(() => {
    if (
      mapStatus !== "ready" ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return;
    }

    const container = mapRef.current;
    if (!container) {
      return;
    }

    const centre = { latitude, longitude };

    if (!controllerRef.current) {
      controllerRef.current = mapProvider.createMap(container, {
        centre,
        zoom: ROOF_ZOOM,
      });

      if (!controllerRef.current) {
        return;
      }

      controllerRef.current.setCursor("crosshair");
      controllerRef.current.onClick((clicked) => {
        // A press that travelled is a pan, and on touch one that was not held
        // is a tap the map should keep for itself.
        if (draggedRef.current || (isTouch && !heldLongEnoughRef.current)) {
          return;
        }

        heldLongEnoughRef.current = false;
        onMapSelectRef.current(clicked);
      });
    } else {
      controllerRef.current.setCentre(centre);
    }

    controllerRef.current.showMarker({
      position: centre,
      title: selectedProperty?.address,
      animate: !prefersReducedMotion,
    });
    controllerRef.current.refresh();
  }, [
    latitude,
    longitude,
    mapStatus,
    isTouch,
    prefersReducedMotion,
    selectedProperty?.address,
  ]);

  useEffect(
    () => () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const container = mapRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => controllerRef.current?.refresh());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /**
   * Tells aiming apart from panning, for both kinds of pointer.
   *
   * A press that travels is someone moving the map, so it never places
   * anything. On touch a press also has to last, which leaves plain tap and
   * drag to the map so it still moves the way a map should.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || mapStatus !== "ready") {
      return undefined;
    }

    const clearHold = () => {
      window.clearTimeout(longPressTimerRef.current);
      heldLongEnoughRef.current = false;
    };

    const handleDown = (event: PointerEvent) => {
      pressOriginRef.current = { x: event.clientX, y: event.clientY };
      draggedRef.current = false;
      // Every gesture starts disarmed, so a stale flag from a hold that never
      // produced a click cannot carry into this one.
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
      // Cleared on the next press rather than here, because the click that
      // consumes it arrives after pointerup. Anything else that ends the
      // gesture does clear it, so a hold that never became a click cannot
      // stay armed into whatever happens next.
    };

    const handleLeave = () => {
      pressOriginRef.current = null;
      clearHold();
    };

    // A context menu or a text selection ends the gesture without a click, and
    // the flag has to come down with it.
    const handleContextMenu = () => clearHold();

    frame.addEventListener("pointerdown", handleDown);
    frame.addEventListener("pointermove", handleMove);
    frame.addEventListener("pointerup", handleUp);
    frame.addEventListener("pointercancel", handleLeave);
    frame.addEventListener("pointerleave", handleLeave);
    frame.addEventListener("contextmenu", handleContextMenu);

    return () => {
      frame.removeEventListener("pointerdown", handleDown);
      frame.removeEventListener("pointermove", handleMove);
      frame.removeEventListener("pointerup", handleUp);
      frame.removeEventListener("pointercancel", handleLeave);
      frame.removeEventListener("pointerleave", handleLeave);
      frame.removeEventListener("contextmenu", handleContextMenu);
      window.clearTimeout(longPressTimerRef.current);
    };
  }, [mapStatus]);

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
