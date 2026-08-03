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
import type { LatLng } from "../../../integrations/maps";
import { readJson, writeJson } from "../../../integrations/storage";
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
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapStatus = useGoogleMapsLoader(googleApiKey);
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
  };

  /**
   * Moves the pin. Placement stays open afterwards, because the first spot you
   * point at is rarely the exact corner of the roof you meant, and closing the
   * mode on the first tap would make every correction a fresh trip through the
   * button.
   */
  const handleMapSelect = ({ latitude, longitude }: LatLng) => {
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
    setLocationTone("info");
    setLocationMessage(
      approximate
        ? "Using your approximate area. Search your address or tap Select from map to pin your roof exactly."
        : null,
    );
  };

  /**
   * Opens the explainer rather than the browser prompt.
   *
   * The browser only asks once and gives no reason of its own, so a dismissed
   * prompt permanently closes this route off. Asking first means the real
   * prompt only appears for someone who has already agreed to it.
   */
  /**
   * Straight to the browser. The explainer opened on arrival, so pressing this
   * afterwards is already the answer to it and asking again would be a wall
   * between someone and the thing they just asked for.
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
      await applyCurrentLocation(
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
