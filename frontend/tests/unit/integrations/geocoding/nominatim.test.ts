// Verifies the geocoding adapter normalises Nominatim's shapes and failures.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MIN_QUERY_LENGTH,
  reverseGeocode,
  searchAddresses,
} from "../../../../src/integrations/geocoding";

const PLACE = {
  place_id: 12345,
  name: "Pajo",
  display_name: "Pajo, Lapu-Lapu City, Cebu, Philippines",
  lat: "10.3103",
  lon: "123.9494",
  place_rank: 26,
};

function mockFetch(payload: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The URL the adapter actually requested, parsed. */
function requestedUrl(fetchMock: ReturnType<typeof vi.fn>) {
  return new URL(String(fetchMock.mock.calls[0][0]));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("searchAddresses", () => {
  it("does not call out for a query below the minimum length", async () => {
    const fetchMock = mockFetch([]);

    const results = await searchAddresses("a".repeat(MIN_QUERY_LENGTH - 1));

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for JSON results and caps how many come back", async () => {
    const fetchMock = mockFetch([PLACE]);

    await searchAddresses("Pajo");
    const url = requestedUrl(fetchMock);

    expect(url.pathname).toMatch(/\/search$/);
    expect(url.searchParams.get("q")).toBe("Pajo");
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(Number(url.searchParams.get("limit"))).toBeGreaterThan(0);
  });

  it("splits the display name into a primary and secondary line", async () => {
    mockFetch([PLACE]);

    const [result] = await searchAddresses("Pajo");

    expect(result).toEqual({
      placeId: "12345",
      primary: "Pajo",
      secondary: "Lapu-Lapu City, Cebu, Philippines",
      address: "Pajo, Lapu-Lapu City, Cebu, Philippines",
      latitude: 10.3103,
      longitude: 123.9494,
      precision: "exact",
    });
  });

  it("scopes the search to the country this assessment covers", async () => {
    const fetchMock = mockFetch([PLACE]);

    await searchAddresses("Pajo");

    // A result the rest of the step would only have to reject is better not
    // returned at all.
    expect(requestedUrl(fetchMock).searchParams.get("countrycodes")).toBe("ph");
  });

  it("marks a result that names an area rather than a building", async () => {
    // Nominatim answers a vague query with a municipality, which points at a
    // centroid and not a roof.
    mockFetch([{ ...PLACE, place_rank: 16 }]);

    const [result] = await searchAddresses("Lapu-Lapu");

    expect(result.precision).toBe("approximate");
  });

  it("treats a result with no rank as approximate rather than exact", async () => {
    mockFetch([{ ...PLACE, place_rank: undefined }]);

    const [result] = await searchAddresses("Pajo");

    expect(result.precision).toBe("approximate");
  });

  it("parses the string coordinates Nominatim returns into numbers", async () => {
    mockFetch([PLACE]);

    const [result] = await searchAddresses("Pajo");

    expect(typeof result.latitude).toBe("number");
    expect(typeof result.longitude).toBe("number");
  });

  it("drops a result that has no usable coordinates", async () => {
    // Offering it would produce a suggestion that fails the moment it is picked.
    mockFetch([PLACE, { ...PLACE, place_id: 2, lat: undefined, lon: "x" }]);

    const results = await searchAddresses("Pajo");

    expect(results).toHaveLength(1);
    expect(results[0].placeId).toBe("12345");
  });

  it("returns nothing when the response is not a list", async () => {
    mockFetch({ error: "Unable to geocode" });

    await expect(searchAddresses("Pajo")).resolves.toEqual([]);
  });

  it("raises on a failed request so the caller can show an error", async () => {
    mockFetch([], false, 503);

    await expect(searchAddresses("Pajo")).rejects.toThrow(/503/);
  });
});

describe("reverseGeocode", () => {
  it("returns the display name for a coordinate", async () => {
    const fetchMock = mockFetch(PLACE);

    const address = await reverseGeocode(10.3103, 123.9494);
    const url = requestedUrl(fetchMock);

    expect(address).toBe("Pajo, Lapu-Lapu City, Cebu, Philippines");
    expect(url.pathname).toMatch(/\/reverse$/);
    expect(url.searchParams.get("lat")).toBe("10.3103");
    expect(url.searchParams.get("lon")).toBe("123.9494");
  });

  it("resolves to null rather than throwing when there is no answer", async () => {
    // The caller already has usable coordinates and only wanted a nicer label,
    // so a failure here must not take down the selection it belongs to.
    mockFetch({}, false, 500);
    await expect(reverseGeocode(1, 2)).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(reverseGeocode(1, 2)).resolves.toBeNull();
  });
});
