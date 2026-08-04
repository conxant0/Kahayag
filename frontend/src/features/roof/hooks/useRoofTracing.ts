import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import {
  fetchBuildingOutline,
  outlineToCorners,
} from "../../../integrations/buildingOutline";
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
  createDefaultRoofOutline,
  hasVertexBeyondPin,
  isPointInsidePolygon,
  isSelfIntersecting,
  MAX_VERTEX_DISTANCE_METERS,
  isValidRoofTrace,
  slideOutlineToCover,
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
  /** True while the footprint is being fetched, so the button can say so. */
  const [isFittingOutline, setIsFittingOutline] = useState(false);

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

    // The outline has to keep covering the pin. Dragged off it, the shape is a
    // trace of some other roof no matter how carefully it was drawn, and every
    // number after this step would be about that roof instead.
    if (pin && !isPointInsidePolygon(coordinates, pin)) {
      revertDrag(
        "Your roof outline has to stay over the property pin, so that move was undone.",
      );
      return;
    }

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

          const { latLng } = event;
          setRoofCoordinates((previous) => [
            ...previous,
            {
              latitude: latLng.lat(),
              longitude: latLng.lng(),
            },
          ]);
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

  /**
   * Opens tracing on a rough outline rather than a blank map.
   *
   * Asking someone to produce a polygon from nothing is both the hardest way
   * to start and the easiest to get wrong. A square over the property is wrong
   * in a way that is obvious and quick to fix: drag four corners onto the roof
   * instead of inventing them. An existing trace is picked up where it was left
   * rather than thrown away.
   */
  /**
   * Lays down the starting shape: the building's own footprint if the provider
   * knows it, a square over the pin if not.
   *
   * An approximate start beats a blank map, so a provider that has never
   * surveyed this building must not become a reason the step cannot begin.
   */
  const seedRoofOutline = async (centre: RoofCoordinate) => {
    setIsFittingOutline(true);
    let seed = createDefaultRoofOutline(centre);
    try {
      const fitted = outlineToCorners(
        await fetchBuildingOutline(centre),
        centre,
      );
      if (fitted && isValidRoofTrace(fitted)) {
        // The fit can read the roof correctly and still sit off the pin, on a
        // long building whose planes near the pin are small. Its size, angle
        // and position all came from the imagery and are worth keeping, so a
        // fit that misses the pin slides only as far as covering it requires
        // rather than being thrown away or recentred.
        seed = slideOutlineToCover(fitted, centre);
      }
    } finally {
      setIsFittingOutline(false);
    }

    setRoofCoordinates(seed);
    lastValidCoordinatesRef.current = seed;
    applyPolygonPath(seed, true);
  };

  const propertyCentre = () =>
    selectedProperty
      ? {
          latitude: selectedProperty.latitude,
          longitude: selectedProperty.longitude,
        }
      : null;

  const startRoofTracing = async () => {
    const centre = propertyCentre();
    if (!centre || googleStatus !== "ready") {
      return;
    }

    setValidationMessage("");
    createRoofPolygon();
    setIsTracingRoof(true);

    // An existing trace is picked up where it was left rather than thrown away.
    if (roofCoordinates.length >= 3) {
      return;
    }

    await seedRoofOutline(centre);
  };

  const finishRoofTracing = () => {
    if (roofCoordinates.length < 3) {
      setValidationMessage(
        "Add at least 3 vertices to create a usable roof polygon.",
      );
      return;
    }

    const validation = validateRoofPolygon(roofCoordinates);
    if (!validation.isValid) {
      setValidationMessage(validation.message);
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
   * Throws away the current shape and lays a fresh one down.
   *
   * It used to leave an empty editable polygon behind, which was a dead end:
   * corners are dragged here, never clicked into place, so a shape with no
   * corners could not be recovered from without leaving the step.
   */
  const redrawRoofTracing = async () => {
    const centre = propertyCentre();
    if (!centre || googleStatus !== "ready") {
      return;
    }

    setValidationMessage("");
    setRoofCoordinates([]);
    clearRoofVertexMarkers();
    clearPolygonPath();
    createRoofPolygon();
    setIsTracingRoof(true);
    await seedRoofOutline(centre);
  };

  return {
    googleStatus,
    roofCoordinates,
    isTracingRoof,
    roofMetrics,
    validationMessage,
    isFittingOutline,
    startRoofTracing,
    finishRoofTracing,
    resetRoofTracing,
    redrawRoofTracing,
  };
}
/* eslint-enable react-hooks/immutability */
