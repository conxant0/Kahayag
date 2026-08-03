import { useEffect, useMemo, useState } from "react";

import {
  MIN_QUERY_LENGTH,
  searchAddresses,
} from "../../../integrations/geocoding";
import type { AddressSuggestion } from "../../../integrations/geocoding";
import {
  DEMO_PROPERTY,
  normalizePropertySelection,
  useMapLoader,
} from "../../../integrations/maps";
import type { LatLng } from "../../../integrations/maps";
import type { PropertyCandidate } from "../../../integrations/maps";
import {
  OUTSIDE_SERVICE_AREA_MESSAGE,
  isWithinServiceArea,
} from "../../../shared/config/serviceArea";
import { readJson, writeJson } from "../../../integrations/storage";
import { useAssessmentStore } from "../../../state/assessmentStore";
import type { SelectedProperty } from "../../../state/assessmentStore";
import {
  getGeolocationErrorMessage,
  resolveCurrentPosition,
} from "./getCurrentLocation";
import type { PositionSource } from "./getCurrentLocation";

export type SearchState = "idle" | "loading" | "ready" | "no-results" | "error";

/**
 * The geocoder behind the backend is rate limited, so keystrokes
 * are collected rather than sent. This also stops a fast typist queueing a
 * request per character and then watching the answers arrive out of order.
 */
const SEARCH_DEBOUNCE_MS = 450;

/**
 * Remembers that the location question has been put once already.
 *
 * The step is the first thing after Get started, so the prompt opens on
 * arrival rather than waiting to be found. Someone who said no should not be
 * asked again every time they come back to change their address, and the
 * answer only needs to outlive the visit, so it rides the session.
 */
const LOCATION_ASKED_KEY = "kahayag-location-prompt-asked";

export function usePropertyAddressSearch() {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapStatus = useMapLoader(mapsApiKey);
  const storedProperty = useAssessmentStore((state) => state.selectedProperty);
  const setPropertySelection = useAssessmentStore(
    (state) => state.setPropertySelection,
  );
  const setRoofPolygon = useAssessmentStore((state) => state.setRoofPolygon);

  const [query, setQuery] = useState(storedProperty?.address ?? "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");

  /**
   * Derived from the store rather than mirrored into local state. The store is
   * already the source of truth, and every handler here writes to it, so a
   * second copy could only ever be the same value or a stale one.
   */
  const selectedProperty: SelectedProperty | null = useMemo(
    () => (storedProperty ? normalizePropertySelection(storedProperty) : null),
    [storedProperty],
  );
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  const [manualCoordinateMessage, setManualCoordinateMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(
    // Nothing to locate if a property is already chosen, which is what coming
    // back to this step to edit an address looks like.
    () => !storedProperty && readJson(LOCATION_ASKED_KEY) !== true,
  );

  const markLocationAsked = () => writeJson(LOCATION_ASKED_KEY, true);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  /**
   * Whether the message above is a failure or just a note.
   *
   * Carried alongside the text because only the code that produced it knows,
   * and reading it back out of the wording was a second, looser copy of a
   * classification `getCurrentLocation` had already made from the error code.
   */
  const [locationTone, setLocationTone] = useState<"error" | "info">("info");

  const trimmedQuery = query.trim();
  const queryNamesSelection = Boolean(
    selectedProperty && trimmedQuery === selectedProperty.address,
  );
  /**
   * Only a query that is long enough, and is not simply echoing the pick the
   * user already made, is worth a request. Deriving this rather than bailing
   * out inside the effect keeps the effect free of the synchronous state
   * writes that cause a second render pass before the first has painted.
   */
  const shouldSearch =
    !queryNamesSelection && trimmedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!shouldSearch) {
      return undefined;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setSearchState("loading");

      try {
        const results = await searchAddresses(trimmedQuery, {
          signal: controller.signal,
        });

        setSuggestions(results);
        setSearchState(results.length ? "ready" : "no-results");
      } catch (error) {
        // An aborted request is this effect being superseded, not a failure,
        // and its state belongs to a query the user has already moved on from.
        if (
          controller.signal.aborted ||
          (error as Error)?.name === "AbortError"
        ) {
          return;
        }

        setSuggestions([]);
        setSearchState("error");
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, shouldSearch]);

  // What the screen actually shows. While no search applies there is nothing to
  // offer and nothing in flight, so both are derived instead of being cleared
  // by an effect after the fact.
  const visibleSuggestions = shouldSearch ? suggestions : [];
  const visibleSearchState: SearchState = shouldSearch
    ? searchState
    : queryNamesSelection
      ? "ready"
      : "idle";

  const clearSelection = () => {
    setPropertySelection(null);
    setRoofPolygon(null);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSearchState("idle");
    setSuggestions([]);
    setManualCoordinateMessage("");
    if (selectedProperty) {
      clearSelection();
    }
  };

  /**
   * Commits a pick, or refuses it.
   *
   * Every route in goes through here: search, the map, typed coordinates, the
   * demo fixture and geolocation all produce the same kind of answer and were
   * each repeating the same normalise-then-set-four-things dance, which is how
   * one of them ends up quietly skipping a rule the others apply.
   *
   * The rule that matters is the service area. The figures downstream are
   * built on Philippine irradiance and a Philippine tariff, so a point outside
   * the country would produce numbers that look real and mean nothing. It is
   * checked here rather than at each call site precisely so a sixth route
   * cannot be added that forgets.
   */
  const commitSelection = (
    candidate: PropertyCandidate,
    note?: { message: string; tone: "error" | "info" },
  ): boolean => {
    const nextProperty = normalizePropertySelection(candidate);
    if (!nextProperty) {
      return false;
    }

    if (!isWithinServiceArea(nextProperty)) {
      setLocationTone("error");
      setLocationMessage(OUTSIDE_SERVICE_AREA_MESSAGE);
      return false;
    }

    setPropertySelection(nextProperty);
    setQuery(nextProperty.address);
    setSuggestions([]);
    setSearchState("ready");
    setManualCoordinateMessage("");
    setLocationTone(note?.tone ?? "info");
    setLocationMessage(note?.message ?? null);
    return true;
  };

  /**
   * A search result already carries its coordinates, so picking one needs no
   * second round trip and cannot half-fail the way a details lookup could.
   *
   * A coarse result is still committed, with a note. A geocoder answers a vague
   * query with a municipality or a province, which points at a centroid rather
   * than a roof; saying so is more useful than refusing the pick, since the
   * map is right there to correct it.
   */
  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    commitSelection(
      {
        placeId: suggestion.placeId,
        name: suggestion.primary,
        address: suggestion.address,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        source: "search",
      },
      suggestion.precision === "approximate"
        ? {
            tone: "info",
            message:
              "That address matched an area rather than a building. Click the map to move the pin onto your roof.",
          }
        : undefined,
    );
  };

  const handleUseDemoProperty = () => {
    commitSelection(DEMO_PROPERTY);
  };

  const handleManualCoordinateSelection = () => {
    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setManualCoordinateMessage("Enter valid latitude and longitude values.");
      return;
    }

    const committed = commitSelection({
      ...DEMO_PROPERTY,
      name: "Manual coordinate selection",
      address: `Manual selection (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
      latitude,
      longitude,
      source: "manual",
    });

    if (!committed) {
      setManualCoordinateMessage(OUTSIDE_SERVICE_AREA_MESSAGE);
    }
  };

  /**
   * Moves the pin, and can be called again to move it once more: the first
   * spot someone points at is rarely the exact corner of the roof they meant.
   */
  const handleMapSelect = ({ latitude, longitude }: LatLng) => {
    commitSelection({
      ...DEMO_PROPERTY,
      name: "Selected map location",
      address: `Selected map location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
      latitude,
      longitude,
      source: "map",
    });
  };

  /**
   * Takes whatever the browser or the backend fallback reported.
   *
   * Routed through `commitSelection` like every other path, so a device
   * reporting a location outside the country is refused with the same message
   * rather than quietly seeding an assessment that cannot be produced.
   */
  const applyCurrentLocation = (
    latitude: number,
    longitude: number,
    source: PositionSource = "browser",
  ) => {
    // Labelled by coordinate rather than by a reverse lookup. The backend has
    // no reverse endpoint, and reaching past it to a geocoder is exactly the
    // thing the proxy rule exists to prevent. The address the search box shows
    // is the one someone typed; a pin they dropped is a pin they can see.
    const address = `Current location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
    const approximate = source === "google-ip" || source === "ip-approximate";

    commitSelection(
      {
        ...DEMO_PROPERTY,
        placeId: null,
        name: approximate ? "Approximate location" : "Current location",
        address,
        latitude,
        longitude,
        source: approximate ? "geolocation-approximate" : "geolocation",
      },
      approximate
        ? {
            tone: "info",
            message:
              "Using your approximate area. Search your address or click the map to pin your roof exactly.",
          }
        : undefined,
    );
  };

  /**
   * Straight to the browser. The explainer opened on arrival, so pressing the
   * button afterwards is already the answer to it, and asking again would be a
   * wall between someone and the thing they just asked for.
   */
  const dismissLocationPrompt = () => {
    markLocationAsked();
    setIsLocationPromptOpen(false);
  };

  const allowLocation = () => {
    markLocationAsked();
    setIsLocationPromptOpen(false);
    void requestCurrentLocation();
  };

  const requestCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationTone("error");
      setLocationMessage(
        "Your browser does not support location access. Search an address instead.",
      );
      return;
    }

    setIsLocating(true);
    setLocationTone("info");
    setLocationMessage("Requesting your location…");

    try {
      const result = await resolveCurrentPosition();
      applyCurrentLocation(
        result.coords.latitude,
        result.coords.longitude,
        result.source,
      );
    } catch (error) {
      setLocationTone("error");
      setLocationMessage(getGeolocationErrorMessage(error));
    } finally {
      setIsLocating(false);
    }
  };

  // The map is the only thing that still needs Google, so a missing or failed
  // key is a note about the preview rather than a warning about search.
  const mapMessage = (() => {
    if (mapStatus === "missing-key") {
      return "Map preview is unavailable because the Google Maps key is not configured. Address search still works.";
    }
    if (mapStatus === "failed") {
      return "Map preview is temporarily unavailable. Address search still works.";
    }
    return null;
  })();

  const statusMessage = (() => {
    if (isLocating || locationMessage) {
      return null;
    }
    if (visibleSearchState === "loading") {
      return "Searching…";
    }
    if (visibleSearchState === "no-results") {
      return "No matches found. Try a more specific address or choose a demo property.";
    }
    if (visibleSearchState === "error") {
      return "Address search is unavailable right now. You can continue with a demo property or by picking a point on the map.";
    }
    if (query.trim().length < MIN_QUERY_LENGTH) {
      return mapMessage ?? "Type at least 3 characters to get suggestions.";
    }
    return mapMessage;
  })();

  return {
    mapStatus,
    query,
    suggestions: visibleSuggestions,
    selectedProperty,
    manualLatitude,
    manualLongitude,
    manualCoordinateMessage,
    isLocating,
    isLocationPromptOpen,
    locationMessage,
    locationTone,
    statusMessage,
    setManualLatitude,
    setManualLongitude,
    handleQueryChange,
    handleSuggestionSelect,
    handleUseDemoProperty,
    handleManualCoordinateSelection,
    handleMapSelect,
    requestCurrentLocation,
    dismissLocationPrompt,
    allowLocation,
  };
}
