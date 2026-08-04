// Draws the recommended layout on the same satellite basemap roof tracing
// uses, instead of the flattened SVG the results screen showed before.
//
// Read-only: no editable path, no click handling. `useRoofTracing` is not
// reused directly because its polygon is editable and event-wired for
// tracing; this hook only ever renders what the recommendation already
// settled on.
import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

import type { GeoPoint } from "../../../shared/api/types";
import { propertyPinIcon, useMapLoader } from "../../../integrations/maps";
import type { GeoTiffRaster } from "../../../integrations/solar/geoTiffLoader";
import { renderSolarFluxOverlay } from "../../../integrations/solar/fluxRenderer";
import type { SelectedProperty } from "../../../state/assessmentStore";
import type { LayoutPanel } from "../panelLayoutUtils";

const SATELLITE_MAP_TYPE = "satellite";
const ROOF_COLOUR = "#2144C7";
const PANEL_FILL = "#C7900C";
const PANEL_STROKE = "#1C1C1C";

function toLatLngPath(points: readonly GeoPoint[]) {
  return points.map((point) => ({
    lat: point.latitude,
    lng: point.longitude,
  }));
}

function boundsOf(points: readonly GeoPoint[]): GoogleLatLngBounds | null {
  if (!points.length || !window.google?.maps?.LatLngBounds) {
    return null;
  }

  const bounds = new window.google.maps.LatLngBounds();
  points.forEach((point) =>
    bounds.extend({ lat: point.latitude, lng: point.longitude }),
  );
  return bounds;
}

export function useResultsMap(
  mapContainerRef: RefObject<HTMLDivElement | null>,
  selectedProperty: SelectedProperty | null,
  roofCoordinates: readonly GeoPoint[],
  panels: readonly LayoutPanel[],
  flux: GeoTiffRaster | null = null,
  mask: GeoTiffRaster | null = null,
) {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const googleStatus = useMapLoader(googleApiKey);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const roofPolygonRef = useRef<GooglePolygon | null>(null);
  const panelPolygonsRef = useRef<GooglePolygon[]>([]);
  const fluxOverlayRef = useRef<GoogleGroundOverlay | null>(null);
  const overlay = useMemo(
    () =>
      flux ? renderSolarFluxOverlay({ flux, mask, roofCoordinates }) : null,
    [flux, mask, roofCoordinates],
  );

  useEffect(() => {
    if (!selectedProperty || googleStatus !== "ready") {
      return;
    }

    const container = mapContainerRef.current;
    if (!container || !window.google?.maps?.Map) {
      return;
    }

    const center = {
      lat: selectedProperty.latitude,
      lng: selectedProperty.longitude,
    };

    if (!mapInstanceRef.current) {
      // Zoom buttons + free wheel-zoom are desktop/tablet only: mobile keeps
      // pinch-to-zoom and cooperative gestureHandling so page scroll still
      // wins over the map on touch.
      const isDesktopOrTablet = window.matchMedia("(min-width: 768px)").matches;
      mapInstanceRef.current = new window.google.maps.Map(container, {
        center,
        zoom: 20,
        mapTypeId: SATELLITE_MAP_TYPE,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        ...(isDesktopOrTablet
          ? {
              zoomControl: true,
              zoomControlOptions: {
                position: window.google.maps.ControlPosition?.RIGHT_BOTTOM ?? 0,
              },
              gestureHandling: "greedy" as const,
            }
          : {}),
      });
      new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: center,
        icon: propertyPinIcon(window.google?.maps),
        title: selectedProperty.address,
      });
    } else {
      mapInstanceRef.current.setCenter(center);
    }

    const bounds = boundsOf(roofCoordinates);
    if (bounds) {
      mapInstanceRef.current.fitBounds(bounds, 32);
    }

    window.google?.maps?.event?.trigger(mapInstanceRef.current, "resize");
    // Coordinates and panels are drawn in the effects below; this effect only
    // owns creating and framing the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, googleStatus, mapContainerRef]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) {
      return;
    }

    if (roofCoordinates.length < 3) {
      roofPolygonRef.current?.setMap(null);
      roofPolygonRef.current = null;
      return;
    }

    const path = toLatLngPath(roofCoordinates);
    if (roofPolygonRef.current) {
      roofPolygonRef.current.setPath(path);
    } else {
      roofPolygonRef.current = new window.google.maps.Polygon({
        map,
        paths: path,
        strokeColor: ROOF_COLOUR,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: ROOF_COLOUR,
        fillOpacity: 0.18,
        clickable: false,
        zIndex: 900,
      });
    }
  }, [googleStatus, roofCoordinates]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) {
      return;
    }

    const maps = window.google.maps;
    panelPolygonsRef.current.forEach((polygon) => polygon.setMap(null));
    panelPolygonsRef.current = panels.map(
      (panel) =>
        new maps.Polygon({
          map,
          paths: toLatLngPath(panel.corners),
          strokeColor: PANEL_STROKE,
          strokeOpacity: 0.85,
          strokeWeight: 1,
          fillColor: PANEL_FILL,
          fillOpacity: 0.88,
          clickable: false,
          zIndex: 1000,
        }),
    );

    return () => {
      panelPolygonsRef.current.forEach((polygon) => polygon.setMap(null));
    };
  }, [googleStatus, panels]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps?.GroundOverlay) {
      return;
    }

    fluxOverlayRef.current?.setMap(null);
    fluxOverlayRef.current = null;

    if (!overlay) {
      return;
    }

    fluxOverlayRef.current = new window.google.maps.GroundOverlay(
      overlay.canvas.toDataURL(),
      {
        north: overlay.bounds.north,
        south: overlay.bounds.south,
        east: overlay.bounds.east,
        west: overlay.bounds.west,
      },
      { opacity: 0.72, clickable: false },
    );
    fluxOverlayRef.current.setMap(map);

    return () => {
      fluxOverlayRef.current?.setMap(null);
      fluxOverlayRef.current = null;
    };
  }, [googleStatus, overlay]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        window.google?.maps?.event?.trigger(mapInstanceRef.current, "resize");
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapContainerRef]);

  const fluxRange = overlay ? { min: overlay.min, max: overlay.max } : null;

  return { googleStatus, fluxRange };
}
