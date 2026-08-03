import { useEffect, useMemo, useState } from "react";

import {
  MIN_QUERY_LENGTH,
  reverseGeocode,
  searchAddresses,
} from "../../../integrations/geocoding";
import type { AddressSuggestion } from "../../../integrations/geocoding";
import {
  DEMO_PROPERTY,
  normalizePropertySelection,
  useGoogleMapsLoader,
} from "../../../integrations/maps";
import { useAssessmentStore } from "../../../state/assessmentStore";
import type { SelectedProperty } from "../../../state/assessmentStore";
import {
  getGeolocationErrorMessage,
  resolveCurrentPosition,
} from "./getCurrentLocation";

export type SearchState = "idle" | "loading" | "ready" | "no-results" | "error";

/**
 * Nominatim asks for roughly one request per second per client, so keystrokes
 * are collected rather than sent. This also stops a fast typist queueing a
 * request per character and then watching the answers arrive out of order.
 */
const SEARCH_DEBOUNCE_MS = 450;

export function usePropertyAddressSearch() {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const googleStatus = useGoogleMapsLoader(googleApiKey);
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
  const [isSelectingPropertyFromMap, setIsSelectingPropertyFromMap] =
    useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

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
   * A search result already carries its coordinates, so picking one needs no
   * second round trip and cannot half-fail the way a details lookup could.
   */
  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    const nextProperty = normalizePropertySelection({
      placeId: suggestion.placeId,
      name: suggestion.primary,
      address: suggestion.address,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      source: "search",
    });

    setPropertySelection(nextProperty);
    setQuery(suggestion.address);
    setSuggestions([]);
    setSearchState("ready");
  };

  const handleUseDemoProperty = () => {
    const nextProperty = normalizePropertySelection(DEMO_PROPERTY);
    setPropertySelection(nextProperty);
    setQuery(nextProperty?.address ?? "");
    setSuggestions([]);
    setSearchState("ready");
    setManualCoordinateMessage("");
    setIsSelectingPropertyFromMap(false);
  };

  const handleManualCoordinateSelection = () => {
    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setManualCoordinateMessage("Enter valid latitude and longitude values.");
      return;
    }

    const nextProperty = normalizePropertySelection({
      ...DEMO_PROPERTY,
      name: "Manual coordinate selection",
      address: `Manual selection (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
      latitude,
      longitude,
      source: "manual",
    });

    setPropertySelection(nextProperty);
    setQuery(nextProperty?.address ?? "");
    setSearchState("ready");
    setManualCoordinateMessage("");
    setIsSelectingPropertyFromMap(false);
  };

  const handleMapSelect = (latitude: number, longitude: number) => {
    const nextProperty = normalizePropertySelection({
      ...DEMO_PROPERTY,
      name: "Selected map location",
      address: `Selected map location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
      latitude,
      longitude,
      source: "map",
    });
    setPropertySelection(nextProperty);
    setQuery(nextProperty?.address ?? "");
    setSearchState("ready");
    setIsSelectingPropertyFromMap(false);
    setManualCoordinateMessage("");
    setLocationMessage(null);
  };

  const applyCurrentLocation = async (
    latitude: number,
    longitude: number,
    source = "browser",
  ) => {
    const formattedAddress = await reverseGeocode(latitude, longitude);
    const address =
      formattedAddress ??
      `Current location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
    const approximate = source === "google-ip" || source === "ip-approximate";

    const nextProperty = normalizePropertySelection({
      ...DEMO_PROPERTY,
      placeId: null,
      name: approximate ? "Approximate location" : "Current location",
      address,
      latitude,
      longitude,
      source: approximate ? "geolocation-approximate" : "geolocation",
    });

    setPropertySelection(nextProperty);
    setQuery(address);
    setSuggestions([]);
    setSearchState("ready");
    setManualCoordinateMessage("");
    setIsSelectingPropertyFromMap(false);
    setLocationMessage(
      approximate
        ? "Using your approximate area. Search your address or tap Select from map to pin your roof exactly."
        : null,
    );
  };

  const requestCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Your browser does not support location access. Search an address instead.",
      );
      return;
    }

    setIsLocating(true);
    setLocationMessage("Requesting your location…");

    try {
      const result = await resolveCurrentPosition();
      await applyCurrentLocation(
        result.coords.latitude,
        result.coords.longitude,
        result.source,
      );
    } catch (error) {
      setLocationMessage(getGeolocationErrorMessage(error));
    } finally {
      setIsLocating(false);
    }
  };

  // The map is the only thing that still needs Google, so a missing or failed
  // key is a note about the preview rather than a warning about search.
  const mapMessage = (() => {
    if (googleStatus === "missing-key") {
      return "Map preview is unavailable because the Google Maps key is not configured. Address search still works.";
    }
    if (googleStatus === "failed") {
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
    googleStatus,
    query,
    suggestions: visibleSuggestions,
    selectedProperty,
    manualLatitude,
    manualLongitude,
    manualCoordinateMessage,
    isSelectingPropertyFromMap,
    isLocating,
    locationMessage,
    statusMessage,
    setManualLatitude,
    setManualLongitude,
    setIsSelectingPropertyFromMap,
    handleQueryChange,
    handleSuggestionSelect,
    handleUseDemoProperty,
    handleManualCoordinateSelection,
    handleMapSelect,
    requestCurrentLocation,
  };
}
