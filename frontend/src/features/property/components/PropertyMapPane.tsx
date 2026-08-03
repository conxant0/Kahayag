import { useEffect, useRef, useState } from "react";

import { PinIcon } from "../../../shared/components/ui";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { cn } from "../../../shared/lib/cn";
import { getMapTypeId } from "../../../integrations/maps";
import type { GoogleMapsStatus } from "../../../integrations/maps";
import type { SelectedProperty } from "../../../state/assessmentStore";

export function PropertyMapPane({
  selectedProperty,
  googleStatus,
  isSelectingPropertyFromMap,
  onMapSelect,
  onCancelMapSelect,
}: {
  selectedProperty: SelectedProperty | null;
  googleStatus: GoogleMapsStatus;
  isSelectingPropertyFromMap: boolean;
  onMapSelect: (latitude: number, longitude: number) => void;
  onCancelMapSelect: () => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  /**
   * Where to draw the pin that rides the cursor. Null until the pointer is
   * actually over the map, so the pin does not sit in a corner waiting.
   */
  const [pinPosition, setPinPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const mapClickListenerRef = useRef<GoogleMapsEventListener | null>(null);

  /**
   * A touch has to be held before it counts as placing a pin.
   *
   * Without this, every tap on a phone drops the pin, which leaves no plain
   * gesture for panning the map to the roof in the first place. Holding is the
   * deliberate act; a tap or a drag is left to Maps so the map still moves the
   * way a map is expected to.
   */
  const isTouch = useMediaQuery("(hover: none)");
  const heldLongEnoughRef = useRef(false);
  const longPressTimerRef = useRef(0);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);

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

      markerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: center,
      });

      if (window.google?.maps?.event) {
        window.google.maps.event.trigger(mapInstanceRef.current, "resize");
      }
      return;
    }

    mapInstanceRef.current.setCenter(center);
    mapInstanceRef.current.setZoom(19);
    mapInstanceRef.current.setMapTypeId(mapTypeId);

    if (!markerRef.current && window.google?.maps?.Marker) {
      markerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: center,
      });
    } else if (markerRef.current) {
      markerRef.current.setPosition(center);
      markerRef.current.setMap(mapInstanceRef.current);
    }

    if (window.google?.maps?.event) {
      window.google.maps.event.trigger(mapInstanceRef.current, "resize");
    }
  }, [selectedProperty, googleStatus]);

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

  useEffect(() => {
    if (
      googleStatus !== "ready" ||
      !mapInstanceRef.current ||
      !window.google?.maps
    ) {
      return;
    }

    if (isSelectingPropertyFromMap) {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove();
      }

      mapClickListenerRef.current = mapInstanceRef.current.addListener(
        "click",
        (event) => {
          if (!event.latLng) {
            return;
          }

          // Maps reports a tap as a click too, so on touch the press has to
          // have been held first. A drag never reaches here: Maps pans instead
          // of reporting a click.
          if (isTouch && !heldLongEnoughRef.current) {
            return;
          }

          heldLongEnoughRef.current = false;
          onMapSelect(event.latLng.lat(), event.latLng.lng());
        },
      );
    } else if (mapClickListenerRef.current) {
      mapClickListenerRef.current.remove();
      mapClickListenerRef.current = null;
    }

    return () => {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove();
        mapClickListenerRef.current = null;
      }
    };
  }, [googleStatus, isSelectingPropertyFromMap, onMapSelect, isTouch]);

  // Times the hold that turns a touch into a placement, and moves it far enough
  // and it stops counting, because that is a pan.
  useEffect(() => {
    if (!isSelectingPropertyFromMap || !isTouch) {
      return undefined;
    }

    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }

    const LONG_PRESS_MS = 400;
    const PAN_SLOP_PX = 10;

    const cancelHold = () => {
      window.clearTimeout(longPressTimerRef.current);
      heldLongEnoughRef.current = false;
      pressOriginRef.current = null;
    };

    const handleDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        return;
      }

      pressOriginRef.current = { x: event.clientX, y: event.clientY };
      heldLongEnoughRef.current = false;
      longPressTimerRef.current = window.setTimeout(() => {
        heldLongEnoughRef.current = true;
        // Show where the pin would land the moment the hold registers, so the
        // gesture confirms itself before the finger lifts.
        const bounds = frame.getBoundingClientRect();
        const origin = pressOriginRef.current;
        if (origin) {
          setPinPosition({
            x: origin.x - bounds.left,
            y: origin.y - bounds.top,
          });
        }
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
        cancelHold();
        setPinPosition(null);
      }
    };

    frame.addEventListener("pointerdown", handleDown);
    frame.addEventListener("pointermove", handleMove);
    frame.addEventListener("pointercancel", cancelHold);

    return () => {
      frame.removeEventListener("pointerdown", handleDown);
      frame.removeEventListener("pointermove", handleMove);
      frame.removeEventListener("pointercancel", cancelHold);
      window.clearTimeout(longPressTimerRef.current);
    };
  }, [isSelectingPropertyFromMap, isTouch]);

  // Maps paints its own cursor over the tiles, so the crosshair has to be set
  // through the map rather than by a class on the container alone.
  useEffect(() => {
    if (googleStatus !== "ready" || !mapInstanceRef.current) {
      return;
    }

    mapInstanceRef.current.setOptions({
      draggableCursor: isSelectingPropertyFromMap ? "crosshair" : undefined,
    });
  }, [googleStatus, isSelectingPropertyFromMap, selectedProperty]);

  // Escape is the expected way out of a mode like this, and reaching for the
  // Cancel button means taking the pointer off the map you are aiming at.
  useEffect(() => {
    if (!isSelectingPropertyFromMap) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelMapSelect();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectingPropertyFromMap, onCancelMapSelect]);

  // The pin rides the cursor only where there is one. On touch it is driven by
  // the hold instead, so tracking every pan would just drag a ghost around.
  useEffect(() => {
    if (!isSelectingPropertyFromMap || isTouch) {
      return undefined;
    }

    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }

    const handleMove = (event: PointerEvent) => {
      const bounds = frame.getBoundingClientRect();
      setPinPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    };

    const handleLeave = () => setPinPosition(null);

    frame.addEventListener("pointermove", handleMove);
    frame.addEventListener("pointerleave", handleLeave);

    return () => {
      frame.removeEventListener("pointermove", handleMove);
      frame.removeEventListener("pointerleave", handleLeave);
      // Cleared on the way out rather than on the way in, so re-opening the
      // mode never flashes the pin at wherever it was last time.
      setPinPosition(null);
    };
  }, [isSelectingPropertyFromMap, isTouch]);

  /**
   * Names the gesture this device actually has, and switches to the correction
   * once a pin exists, since "place" is the wrong verb for moving one.
   */
  const placementHint = isTouch
    ? selectedProperty
      ? "Press and hold to move the pin"
      : "Press and hold the map to place your pin"
    : selectedProperty
      ? "Click the map to move the pin"
      : "Click the map to place your pin";

  return (
    <div ref={frameRef} className="absolute inset-0">
      <div
        ref={mapRef}
        aria-label="Selected property satellite map"
        className={cn(
          "absolute inset-0 min-h-56",
          // A crosshair says "this click means something" before any copy does.
          isSelectingPropertyFromMap && "cursor-crosshair",
        )}
      >
        {!selectedProperty && (
          <div className="flex size-full items-center justify-center p-6 font-sans text-sm text-secondary">
            Allow location access or search an address to view your roof on the
            satellite map.
          </div>
        )}
      </div>

      {isSelectingPropertyFromMap && (
        <>
          {/* A ring around the pane, so the whole map reads as armed rather
           * than only the spot under the pointer. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-map ring-2 ring-cobalt ring-inset"
          />

          {/* The pin the click is about to drop, held at the pointer with its
           * point on the exact spot. Never intercepts the click itself. */}
          {pinPosition && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-10 text-cobalt drop-shadow-[0_2px_3px_rgb(0_0_0/0.45)]"
              style={{
                left: pinPosition.x,
                top: pinPosition.y,
                translate: "-50% -100%",
              }}
            >
              <PinIcon size={32} />
            </span>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
            <div className="pointer-events-auto flex items-center gap-3 rounded-pill bg-ink-veil px-4 py-2.5 backdrop-blur-sm">
              <span className="flex items-center gap-2 font-sans text-[13px] font-semibold text-paper">
                <PinIcon size={16} />
                {placementHint}
              </span>
              <button
                type="button"
                onClick={onCancelMapSelect}
                className="font-sans text-[13px] font-semibold text-paper/70 underline transition-colors duration-150 hover:text-paper"
              >
                {selectedProperty ? "Done" : "Cancel"}
              </button>
            </div>
          </div>

          {/* Announced once when the mode opens, for anyone not watching the
           * cursor change shape. */}
          <p role="status" className="sr-only">
            {`Pin placement is on. ${placementHint}, or press Escape to finish.`}
          </p>
        </>
      )}
    </div>
  );
}
