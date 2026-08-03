// Verifies address search goes through our own API and normalises what it gets.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MIN_QUERY_LENGTH,
  searchAddresses,
} from "../../../../src/integrations/geocoding";

const RESULT = {
  address: "Pajo, Lapu-Lapu City, Cebu, Philippines",
  latitude: 10.3103,
  longitude: 123.9494,
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

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>) {
  return new URL(String(fetchMock.mock.calls[0][0]), "http://backend.test");
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

  it("asks our own backend rather than a geocoder directly", async () => {
    const fetchMock = mockFetch([RESULT]);

    await searchAddresses("Pajo");
    const url = requestedUrl(fetchMock);

    // The provider is the backend's business: it holds the rate limit and the
    // User-Agent a browser cannot send.
    expect(url.pathname).toContain("/properties/search");
    expect(url.hostname).not.toContain("nominatim");
    expect(url.searchParams.get("query")).toBe("Pajo");
    expect(Number(url.searchParams.get("limit"))).toBeGreaterThan(0);
  });

  it("splits the address into a primary and secondary line", async () => {
    mockFetch([RESULT]);

    const [result] = await searchAddresses("Pajo");

    expect(result.primary).toBe("Pajo");
    expect(result.secondary).toBe("Lapu-Lapu City, Cebu, Philippines");
    expect(result.address).toBe(RESULT.address);
    expect(result.latitude).toBe(10.3103);
  });

  it("treats a result with no stated precision as approximate", async () => {
    // The endpoint does not send precision yet. Erring toward "check the pin"
    // is better than presenting a centroid with false confidence.
    mockFetch([RESULT]);

    const [result] = await searchAddresses("Pajo");

    expect(result.precision).toBe("approximate");
  });

  it("keeps a precision the backend does state", async () => {
    mockFetch([{ ...RESULT, precision: "exact" }]);

    const [result] = await searchAddresses("Pajo");

    expect(result.precision).toBe("exact");
  });

  it("drops a result with no usable coordinates", async () => {
    // Offering it would produce a suggestion that fails the moment it is picked.
    mockFetch([RESULT, { address: "Nowhere", latitude: null }]);

    const results = await searchAddresses("Pajo");

    expect(results).toHaveLength(1);
  });

  it("returns nothing when the response is not a list", async () => {
    mockFetch({ detail: "Geocoding unavailable" });

    await expect(searchAddresses("Pajo")).resolves.toEqual([]);
  });

  it("raises on a failed request so the caller can show an error", async () => {
    mockFetch([], false, 502);

    await expect(searchAddresses("Pajo")).rejects.toThrow(/502/);
  });

  it("passes an abort signal through to the request", async () => {
    const fetchMock = mockFetch([RESULT]);
    const controller = new AbortController();

    await searchAddresses("Pajo", { signal: controller.signal });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: controller.signal,
    });
  });
});
