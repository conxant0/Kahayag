import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import {
  DEMO_PROPERTY,
  propertyPinIcon,
  useMapLoader,
} from "../../../integrations/maps";
import { useAssessmentStore } from "../../../state/assessmentStore";
import type {
  RoofCoordinate,
  SelectedProperty,
} from "../../../state/assessmentStore";
import {
  buildRoofPolygonModel,
  calculateRoofMetrics,
  hasVertexBeyondPin,
  isPointInsidePolygon,
  isSelfIntersecting,
  MAX_VERTEX_DISTANCE_METERS,
  isValidRoofTrace,
  validateRoofPolygon,
} from "../roofUtils";

/** Satellite imagery, which is the only base this step is drawn on. */
const SATELLITE_MAP_TYPE = "satellite";

/**
 * The trace paints cobalt while it can be used and grey once it cannot.
 *
 * Cobalt is the colour the rest of the interface uses for engine output, and a
 * trace is the input that produces it. Grey is not a warning colour: a roof too
 * small to assess is not an error someone made, it is a shape that will not
 * carry the next step, and saying so quietly is more useful than alarm.
 */
const TRACE_COLOURS = {
  valid: "#2144C7",
  invalid: "#948F83",
} as const;

const VERTEX_FILL = "#FCFAF5";

export function useRoofTracing(
  mapContainerRef: RefObject<HTMLDivElement | null>,
  selectedProperty: SelectedProperty | null,
) {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const googleStatus = useMapLoader(googleApiKey);
  const storedRoofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const setRoofPolygon = useAssessmentStore((state) => state.setRoofPolygon);

  /**
   * Seeded from the session rather than synced to it.
   *
   * A trace saved earlier in the visit is restored once, at mount. Every later
   * change to the stored polygon originates here, so listening for them would
   * only be this hook hearing its own echo a render late.
   */
  const [roofCoordinates, setRoofCoordinates] = useState<RoofCoordinate[]>(
    () => storedRoofPolygon?.coordinates ?? [],
  );
  const [isTracingRoof, setIsTracingRoof] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  /**
   * Derived from the vertices rather than stored alongside them.
   *
   * Keeping it in state meant every change needed a second render to catch the
   * figures up, so the area shown briefly belonged to the previous shape.
   */
  const roofMetrics = useMemo(
    () => calculateRoofMetrics(roofCoordinates),
    [roofCoordinates],
  );

  /**
   * Whether the current shape could carry the next step.
   *
   * Derived, so the outline's colour, the message and the confirm button all
   * read the same answer instead of each deciding for themselves.
   */
  const validation = useMemo(
    () => validateRoofPolygon(roofCoordinates),
    [roofCoordinates],
  );
  const isUsableTrace = validation.isValid;

  useEffect(() => {
    isUsableTraceRef.current = isUsableTrace;

    const polygon = polygonRef.current;
    if (!polygon) {
      return;
    }

    const colour = isUsableTrace ? TRACE_COLOURS.valid : TRACE_COLOURS.invalid;
    polygon.setOptions({ strokeColor: colour, fillColor: colour });

    // The handles carry the same answer, so a shape that has shrunk out of
    // range is grey all over rather than grey with cobalt corners.
    roofVertexMarkersRef.current.forEach((marker) =>
      marker.setIcon({
        path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
        scale: 6,
        fillColor: VERTEX_FILL,
        fillOpacity: 1,
        strokeColor: colour,
        strokeWeight: 2.5,
      }),
    );
  }, [isUsableTrace]);

  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const polygonRef = useRef<GooglePolygon | null>(null);
  const polygonListenersRef = useRef<(GoogleMapsEventListener | undefined)[]>(
    [],
  );
  const roofVertexMarkersRef = useRef<GoogleMarker[]>([]);
  const mapClickListenerRef = useRef<
    GoogleMapsEventListener | null | undefined
  >(null);
  const isSyncingPathRef = useRef(false);
  const isTracingRoofRef = useRef(false);
  const isUsableTraceRef = useRef(true);
  /** The last outline that did not cross itself, to spring a bad drag back to. */
  const lastValidCoordinatesRef = useRef<RoofCoordinate[]>(
    storedRoofPolygon?.coordinates ?? [],
  );
  /** A queued undo, so clearing the outline can call it off. */
  const pendingRevertRef = useRef(0);

  /**
   * Wipes the outline without the path listeners fighting back.
   *
   * Clearing removes vertices one at a time, so partway through the shape is a
   * triangle, then a line. Those intermediate states can read as crossed, and
   * the crossing guard would helpfully restore the very outline being deleted.
   * The flag holds the listeners off, and any undo already queued is called
   * off with it.
   */
  const clearPolygonPath = () => {
    window.clearTimeout(pendingRevertRef.current);
    isSyncingPathRef.current = true;
    polygonRef.current?.getPath?.()?.clear();
    lastValidCoordinatesRef.current = [];
    isSyncingPathRef.current = false;

    /*
     * Clearing must end with nothing to say.
     *
     * The path events that come out of a clear are handled synchronously, but
     * anything the map queues for the next tick would land after the message
     * was already blanked, leaving "that move was undone" over an empty map.
     * Blanking again once the queue has drained is what makes Clear mean
     * clear, whatever order the events arrived in.
     */
    window.setTimeout(() => setValidationMessage(""), 0);
  };
  const roofCoordinatesRef = useRef(roofCoordinates);
  const selectedPropertyRef = useRef(selectedProperty);

  useEffect(() => {
    isTracingRoofRef.current = isTracingRoof;
  }, [isTracingRoof]);

  useEffect(() => {
    roofCoordinatesRef.current = roofCoordinates;
    // Clicking builds the shape one corner at a time, so this is where the
    // "spring a bad drag back" target keeps up. Only shapes that do not cross
    // themselves are worth springing back to.
    if (!isSelfIntersecting(roofCoordinates)) {
      lastValidCoordinatesRef.current = roofCoordinates;
    }
  }, [roofCoordinates]);

  useEffect(() => {
    selectedPropertyRef.current = selectedProperty;
  }, [selectedProperty]);

  useEffect(() => {
    return () => {
      const coordinates = roofCoordinatesRef.current;
      const property = selectedPropertyRef.current;

      if (!property || !isValidRoofTrace(coordinates)) {
        return;
      }

      setRoofPolygon(
        buildRoofPolygonModel({
          propertyId: property.placeId ?? DEMO_PROPERTY.placeId,
          coordinates,
        }),
      );
    };
  }, [setRoofPolygon]);

  const cleanupPolygonPathListeners = () => {
    polygonListenersRef.current.forEach((listener) => listener?.remove?.());
    polygonListenersRef.current = [];
  };

  /**
   * Takes the shape back from the map, unless it has been dragged into a knot.
   *
   * A crossed outline is refused at the moment it happens rather than reported
   * afterwards: the corner springs back to where it was, which teaches the
   * constraint in the one place it makes sense, under the pointer that broke
   * it. Accepting it and colouring it red would leave someone to work out
   * which of four corners to move.
   */
  const syncCoordinatesFromPolygon = (polygon: GooglePolygon) => {
    if (isSyncingPathRef.current) {
      return;
    }

    const path = polygon.getPath?.();
    if (!path) {
      return;
    }

    const coordinates = path.getArray().map((latLng) => ({
      latitude: latLng.lat(),
      longitude: latLng.lng(),
    }));

    /*
     * Undoing a drag the shape cannot keep.
     *
     * Queued, not immediate. This runs inside Maps' own path event, and
     * rewriting the path from there re-enters its bookkeeping mid-update,
     * which throws from inside the library. Letting the current event finish
     * and restoring on the next tick is the difference between an undo and a
     * crash. The flag goes up now so nothing in between reads as a new edit.
     */
    const revertDrag = (message: string) => {
      setValidationMessage(message);

      const restore = lastValidCoordinatesRef.current;
      isSyncingPathRef.current = true;
      window.clearTimeout(pendingRevertRef.current);
      pendingRevertRef.current = window.setTimeout(() => {
        applyPolygonPath(restore, true);
        syncRoofMarkers(restore);
        isSyncingPathRef.current = false;
      }, 0);
    };

    if (isSelfIntersecting(coordinates)) {
      revertDrag("Corners cannot cross another edge, so that move was undone.");
      return;
    }

    // Checked against the pin the previous step confirmed, so a corner flicked
    // across the neighbourhood cannot quietly become part of the roof area.
    const property = selectedPropertyRef.current;
    const pin = property && {
      latitude: property.latitude,
      longitude: property.longitude,
    };

    if (hasVertexBeyondPin(coordinates, pin)) {
      revertDrag(
        `Corners have to stay within ${MAX_VERTEX_DISTANCE_METERS} m of your property pin, so that move was undone.`,
      );
      return;
    }

    // Covering the pin is checked when the trace is confirmed, not here: a
    // shape being clicked into existence corner by corner spends most of its
    // life not covering the pin yet, and undoing every drag in that state
    // would fight the person building it.
    lastValidCoordinatesRef.current = coordinates;
    setValidationMessage("");
    setRoofCoordinates(coordinates);
  };

  const attachPolygonPathListeners = (polygon: GooglePolygon) => {
    cleanupPolygonPathListeners();

    const path = polygon.getPath?.();
    if (!path || typeof path.addListener !== "function") {
      return;
    }

    const insertListener = path.addListener("insert_at", () =>
      syncCoordinatesFromPolygon(polygon),
    );
    const setListener = path.addListener("set_at", () =>
      syncCoordinatesFromPolygon(polygon),
    );
    const removeListener = path.addListener("remove_at", () =>
      syncCoordinatesFromPolygon(polygon),
    );
    polygonListenersRef.current = [insertListener, setListener, removeListener];
  };

  /* eslint-disable react-hooks/immutability -- These refs hold imperative map
     objects whose lifetime is the hook's, not a render's. The compiler reads
     the assignment as render-phase work because these helpers are plain
     functions. The real fix is moving polygon drawing behind `MapAdapter`,
     which is tracked separately; disabling narrowly is honest about that
     rather than restructuring the map layer inside a lint pass. */
  const clearRoofVertexMarkers = () => {
    roofVertexMarkersRef.current.forEach((marker) => marker.setMap(null));
    // Emptied in place rather than replaced: the ref holds one list for the
    // lifetime of the hook, and swapping it is a mutation the compiler reads
    // as render-phase work.
    roofVertexMarkersRef.current.length = 0;
  };

  const syncRoofMarkers = (coordinates: RoofCoordinate[]) => {
    if (!window.google?.maps || !mapInstanceRef.current) {
      return;
    }

    const markers = roofVertexMarkersRef.current;
    while (markers.length > coordinates.length) {
      const marker = markers.pop();
      marker?.setMap(null);
    }

    const map = mapInstanceRef.current;

    coordinates.forEach((coordinate, index) => {
      const position = { lat: coordinate.latitude, lng: coordinate.longitude };
      if (markers[index]) {
        markers[index].setPosition(position);
      } else if (window.google?.maps?.Marker) {
        markers[index] = new window.google.maps.Marker({
          map,
          position,
          clickable: false,
          zIndex: 1001,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: VERTEX_FILL,
            fillOpacity: 1,
            strokeColor: isUsableTraceRef.current
              ? TRACE_COLOURS.valid
              : TRACE_COLOURS.invalid,
            strokeWeight: 2.5,
          },
        });
      }
    });
  };

  const applyPolygonPath = (
    coordinates: RoofCoordinate[],
    tracingActive: boolean,
  ) => {
    createRoofPolygon();

    const polygon = polygonRef.current;
    if (!polygon || !window.google?.maps) {
      return;
    }

    // `getPath` is not there the instant a polygon is constructed, which the
    // listener setup already allows for. Writing the path before it exists
    // took the whole step down with it.
    const path = polygon.getPath?.();
    if (!path) {
      return;
    }

    isSyncingPathRef.current = true;
    const maps = window.google.maps;
    path.clear();

    coordinates.forEach((coord) => {
      path.push(new maps.LatLng(coord.latitude, coord.longitude));
    });

    const hasShape = tracingActive || coordinates.length > 0;
    polygon.setEditable(hasShape);
    polygon.setVisible(hasShape);
    isSyncingPathRef.current = false;
  };

  const createRoofPolygon = () => {
    if (!mapInstanceRef.current || !window.google?.maps) {
      return;
    }

    if (!polygonRef.current) {
      polygonRef.current = new window.google.maps.Polygon({
        map: mapInstanceRef.current,
        strokeColor: TRACE_COLOURS.valid,
        strokeOpacity: 0.95,
        strokeWeight: 3,
        fillColor: TRACE_COLOURS.valid,
        fillOpacity: 0.25,
        editable: false,
        clickable: false,
        zIndex: 1000,
      });
      attachPolygonPathListeners(polygonRef.current);
    } else {
      polygonRef.current.setMap(mapInstanceRef.current);
    }
  };

  const triggerMapResize = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps?.event) {
      return;
    }

    window.google.maps.event.trigger(mapInstanceRef.current, "resize");
  }, []);

  const previousPlaceIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const placeId = selectedProperty
      ? `${selectedProperty.placeId ?? ""}|${selectedProperty.latitude},${selectedProperty.longitude}`
      : null;

    if (previousPlaceIdRef.current === undefined) {
      previousPlaceIdRef.current = placeId;
      return;
    }

    if (previousPlaceIdRef.current === placeId) {
      return;
    }

    previousPlaceIdRef.current = placeId;
    setRoofCoordinates([]);
    setIsTracingRoof(false);
    setValidationMessage("");
    clearPolygonPath();
    if (polygonRef.current) {
      polygonRef.current.setVisible(false);
      polygonRef.current.setEditable(false);
    }
    clearRoofVertexMarkers();
    setRoofPolygon(null);
  }, [selectedProperty?.placeId, setRoofPolygon]);

  useEffect(() => {
    applyPolygonPath(roofCoordinates, isTracingRoof);
    syncRoofMarkers(roofCoordinates);
  }, [roofCoordinates, isTracingRoof]);

  useEffect(() => {
    if (!selectedProperty || googleStatus !== "ready") {
      return;
    }

    const container = mapContainerRef.current;
    if (!container || !window.google?.maps?.Map) {
      return;
    }

    const { latitude, longitude } = selectedProperty;
    const center = { lat: latitude, lng: longitude };
    const mapTypeId = SATELLITE_MAP_TYPE;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(container, {
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
        icon: propertyPinIcon(window.google?.maps),
        title: selectedProperty?.address,
      });
      createRoofPolygon();
      triggerMapResize();
      return;
    }

    mapInstanceRef.current.setCenter(center);
    mapInstanceRef.current.setZoom(19);
    mapInstanceRef.current.setMapTypeId(mapTypeId);

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: center,
        icon: propertyPinIcon(window.google?.maps),
        title: selectedProperty?.address,
      });
    } else {
      markerRef.current.setPosition(center);
      markerRef.current.setMap(mapInstanceRef.current);
    }

    triggerMapResize();
  }, [selectedProperty, googleStatus, mapContainerRef, triggerMapResize]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      triggerMapResize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [mapContainerRef, triggerMapResize, selectedProperty, googleStatus]);

  useEffect(() => {
    if (googleStatus !== "ready") {
      return;
    }

    if (!mapInstanceRef.current || !window.google?.maps) {
      return;
    }

    // The cursor is the always-on reminder of what a click will do here:
    // crosshair while every click drops a corner, the ordinary hand once
    // clicking is just panning again.
    mapInstanceRef.current.setOptions({
      draggableCursor: isTracingRoof ? "crosshair" : undefined,
    });

    if (isTracingRoof) {
      createRoofPolygon();

      if (mapClickListenerRef.current) {
        mapClickListenerRef.current?.remove?.();
      }

      mapClickListenerRef.current = mapInstanceRef.current.addListener(
        "click",
        (event) => {
          if (!isTracingRoofRef.current || !event.latLng) {
            return;
          }

          const clicked = {
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          };

          // The same fence the drag guard applies, at the moment the corner
          // is placed rather than after: a click on the next street cannot
          // become part of this roof's area.
          const property = selectedPropertyRef.current;
          const pin = property && {
            latitude: property.latitude,
            longitude: property.longitude,
          };
          if (pin && hasVertexBeyondPin([clicked], pin)) {
            setValidationMessage(
              `Corners have to stay within ${MAX_VERTEX_DISTANCE_METERS} m of your property pin, so that corner was not added.`,
            );
            return;
          }

          // Refused at the click, the same way a crossing drag is refused at
          // the drag: a corner whose edges cross the outline can never be
          // confirmed, and finding that out now beats finding out at the end.
          const next = [...roofCoordinatesRef.current, clicked];
          if (isSelfIntersecting(next)) {
            setValidationMessage(
              "Corners cannot cross another edge, so that corner was not added.",
            );
            return;
          }

          setValidationMessage("");
          setRoofCoordinates(next);
        },
      );
    } else if (mapClickListenerRef.current) {
      mapClickListenerRef.current?.remove?.();
      mapClickListenerRef.current = null;
    }

    return () => {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current?.remove?.();
        mapClickListenerRef.current = null;
      }
    };
  }, [googleStatus, isTracingRoof]);

  const propertyCentre = () =>
    selectedProperty
      ? {
          latitude: selectedProperty.latitude,
          longitude: selectedProperty.longitude,
        }
      : null;

  /**
   * Opens tracing on a blank map, ready for the first click.
   *
   * The shape is the person's to draw: click a corner of the roof, then the
   * next, until the outline closes around the pin. An earlier attempt seeded a
   * fitted outline from provider imagery here, and it earned its removal —
   * where coverage was thin the seed was a misplaced or mis-rotated shape that
   * had to be wrestled off before tracing could start, which is worse than
   * starting clean. An existing trace is picked up where it was left rather
   * than thrown away.
   */
  const startRoofTracing = () => {
    if (!propertyCentre() || googleStatus !== "ready") {
      return;
    }

    setValidationMessage("");
    createRoofPolygon();
    setIsTracingRoof(true);
  };

  const finishRoofTracing = () => {
    if (roofCoordinates.length < 3) {
      setValidationMessage(
        "Add at least 3 corners by clicking the map before confirming.",
      );
      return;
    }

    const validation = validateRoofPolygon(roofCoordinates);
    if (!validation.isValid) {
      setValidationMessage(validation.message);
      return;
    }

    // The pin is what the previous step confirmed, so a trace that does not
    // cover it is a trace of some other roof, however carefully it was drawn.
    // Checked here rather than while drawing, because a shape under
    // construction spends most of its life not covering the pin yet.
    const pin = propertyCentre();
    if (pin && !isPointInsidePolygon(roofCoordinates, pin)) {
      setValidationMessage(
        "Your roof outline has to cover the property pin. Extend the shape until the pin sits inside it.",
      );
      return;
    }

    setValidationMessage("");
    setIsTracingRoof(false);
    setRoofPolygon(
      buildRoofPolygonModel({
        propertyId: selectedProperty?.placeId ?? DEMO_PROPERTY.placeId,
        coordinates: roofCoordinates,
      }),
    );
  };

  const resetRoofTracing = () => {
    setIsTracingRoof(false);
    setValidationMessage("");
    setRoofCoordinates([]);
    clearPolygonPath();
    if (polygonRef.current) {
      polygonRef.current.setVisible(false);
      polygonRef.current.setEditable(false);
    }
    clearRoofVertexMarkers();
    setRoofPolygon(null);
  };

  /**
   * Throws away the current shape and stays in tracing, ready for the first
   * click of a fresh outline.
   *
   * An empty shape used to be a dead end, back when corners were only ever
   * dragged. Clicking corners into place is the whole gesture now, so empty
   * is simply the starting state.
   */
  const redrawRoofTracing = () => {
    if (!propertyCentre() || googleStatus !== "ready") {
      return;
    }

    setValidationMessage("");
    setRoofCoordinates([]);
    clearRoofVertexMarkers();
    clearPolygonPath();
    createRoofPolygon();
    setIsTracingRoof(true);
  };

  return {
    googleStatus,
    roofCoordinates,
    isTracingRoof,
    isUsableTrace,
    roofMetrics,
    validationMessage,
    startRoofTracing,
    finishRoofTracing,
    resetRoofTracing,
    redrawRoofTracing,
  };
}
/* eslint-enable react-hooks/immutability */
