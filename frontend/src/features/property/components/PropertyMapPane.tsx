import { useEffect, useRef } from "react";

import { getMapTypeId } from "../../../integrations/maps";
import type { GoogleMapsStatus } from "../../../integrations/maps";
import type { SelectedProperty } from "../../../state/assessmentStore";

export function PropertyMapPane({
  selectedProperty,
  googleStatus,
  isSelectingPropertyFromMap,
  onMapSelect,
}: {
  selectedProperty: SelectedProperty | null;
  googleStatus: GoogleMapsStatus;
  isSelectingPropertyFromMap: boolean;
  onMapSelect: (latitude: number, longitude: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const mapClickListenerRef = useRef<GoogleMapsEventListener | null>(null);

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
  }, [googleStatus, isSelectingPropertyFromMap, onMapSelect]);

  return (
    <div
      ref={mapRef}
      aria-label="Selected property satellite map"
      className="absolute inset-0 min-h-56"
    >
      {!selectedProperty && (
        <div className="flex size-full items-center justify-center p-6 font-sans text-sm text-secondary">
          Allow location access or search an address to view your roof on the
          satellite map.
        </div>
      )}
    </div>
  );
}
