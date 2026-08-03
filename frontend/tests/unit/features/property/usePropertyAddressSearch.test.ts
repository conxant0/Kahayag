// Verifies the property step's debounce, its selection rules, and the
// one-per-session location prompt.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePropertyAddressSearch } from "../../../../src/features/property/hooks/usePropertyAddressSearch";
import { useAssessmentStore } from "../../../../src/state/assessmentStore";

const SEARCH_DEBOUNCE_MS = 450;

const CEBU = { latitude: 10.3157, longitude: 123.8854 };
const SINGAPORE = { latitude: 1.3521, longitude: 103.8198 };

const NOMINATIM_RESULT = {
  place_id: 1,
  name: "Pajo",
  display_name: "Pajo, Lapu-Lapu City, Cebu, Philippines",
  lat: String(CEBU.latitude),
  lon: String(CEBU.longitude),
  place_rank: 26,
};

function mockSearch(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  window.sessionStorage.clear();
  useAssessmentStore.getState().reset();
  mockSearch([NOMINATIM_RESULT]);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePropertyAddressSearch", () => {
  describe("searching", () => {
    it("waits out the debounce before asking the provider", () => {
      const fetchMock = mockSearch([NOMINATIM_RESULT]);
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() => result.current.handleQueryChange("Pajo"));
      act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
      expect(fetchMock).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("asks once for a query typed a character at a time", () => {
      const fetchMock = mockSearch([NOMINATIM_RESULT]);
      const { result } = renderHook(() => usePropertyAddressSearch());

      for (const value of ["Pa", "Paj", "Pajo"]) {
        act(() => result.current.handleQueryChange(value));
        act(() => vi.advanceTimersByTime(100));
      }
      act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

      // Nominatim asks for roughly one request per second per client, so a
      // request per keystroke is the thing this debounce exists to prevent.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not ask at all below the minimum query length", () => {
      const fetchMock = mockSearch([NOMINATIM_RESULT]);
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() => result.current.handleQueryChange("Pa"));
      act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2));

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("selecting", () => {
    it("stores a pick made from the map", () => {
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() => result.current.handleMapSelect(CEBU));

      const stored = useAssessmentStore.getState().selectedProperty;
      expect(stored?.latitude).toBeCloseTo(CEBU.latitude);
      expect(stored?.source).toBe("map");
    });

    it("stores the demo property, and it is inside the service area", () => {
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() => result.current.handleUseDemoProperty());

      const stored = useAssessmentStore.getState().selectedProperty;
      // The fixture goes through the same rule as everything else, so a demo
      // that drifted outside the country would fail here rather than seed an
      // assessment that cannot be produced.
      expect(stored?.source).toBe("demo");
      expect(stored?.address).toMatch(/Philippines/);
      expect(result.current.locationTone).not.toBe("error");
    });

    it("refuses a point outside the service area", () => {
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() => result.current.handleMapSelect(SINGAPORE));

      // The figures downstream are built on Philippine irradiance and tariff,
      // so a point elsewhere would produce numbers that look real and are not.
      expect(useAssessmentStore.getState().selectedProperty).toBeNull();
      expect(result.current.locationTone).toBe("error");
      expect(result.current.locationMessage).toMatch(
        /outside the Philippines/i,
      );
    });

    it("refuses typed coordinates outside the service area", () => {
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() => result.current.setManualLatitude(String(SINGAPORE.latitude)));
      act(() => result.current.setManualLongitude(String(SINGAPORE.longitude)));
      act(() => result.current.handleManualCoordinateSelection());

      expect(useAssessmentStore.getState().selectedProperty).toBeNull();
      expect(result.current.manualCoordinateMessage).toMatch(
        /outside the Philippines/i,
      );
    });

    it("accepts typed coordinates inside the service area", () => {
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() => result.current.setManualLatitude(String(CEBU.latitude)));
      act(() => result.current.setManualLongitude(String(CEBU.longitude)));
      act(() => result.current.handleManualCoordinateSelection());

      expect(useAssessmentStore.getState().selectedProperty?.source).toBe(
        "manual",
      );
    });

    it("notes when a search result named an area rather than a building", () => {
      const { result } = renderHook(() => usePropertyAddressSearch());

      act(() =>
        result.current.handleSuggestionSelect({
          placeId: "1",
          primary: "Lapu-Lapu City",
          secondary: "Cebu, Philippines",
          address: "Lapu-Lapu City, Cebu, Philippines",
          latitude: CEBU.latitude,
          longitude: CEBU.longitude,
          precision: "approximate",
        }),
      );

      expect(result.current.locationMessage).toMatch(/matched an area/i);
      // Still committed: the map is right there to correct it.
      expect(useAssessmentStore.getState().selectedProperty).not.toBeNull();
    });
  });

  describe("the location prompt", () => {
    it("opens on arrival when nothing has been picked", () => {
      const { result } = renderHook(() => usePropertyAddressSearch());

      expect(result.current.isLocationPromptOpen).toBe(true);
    });

    it("does not open again once it has been answered this session", () => {
      const first = renderHook(() => usePropertyAddressSearch());
      act(() => first.result.current.dismissLocationPrompt());
      first.unmount();

      const second = renderHook(() => usePropertyAddressSearch());

      expect(second.result.current.isLocationPromptOpen).toBe(false);
    });

    it("does not open when a property is already chosen", () => {
      const { result, unmount } = renderHook(() => usePropertyAddressSearch());
      act(() => result.current.handleMapSelect(CEBU));
      act(() => result.current.dismissLocationPrompt());
      unmount();

      window.sessionStorage.removeItem("kahayag-location-prompt-asked");
      const again = renderHook(() => usePropertyAddressSearch());

      expect(again.result.current.isLocationPromptOpen).toBe(false);
    });
  });
});
