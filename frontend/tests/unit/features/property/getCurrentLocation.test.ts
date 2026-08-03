import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getGeolocationErrorMessage,
  resolveCurrentPosition,
} from "../../../../src/features/property/hooks/getCurrentLocation";

describe("getGeolocationErrorMessage", () => {
  it("maps permission denied to a search fallback message", () => {
    expect(getGeolocationErrorMessage({ code: 1 })).toMatch(/denied/i);
  });

  it("maps position unavailable to search guidance", () => {
    expect(getGeolocationErrorMessage({ code: 2 })).toMatch(
      /Search your address/i,
    );
  });

  it("uses backend error messages when present", () => {
    expect(
      getGeolocationErrorMessage(
        new Error("Approximate location is unavailable on localhost."),
      ),
    ).toMatch(/localhost/i);
  });
});

describe("resolveCurrentPosition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to backend approximate location when browser geolocation fails", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback,
        ) => {
          error({ code: 2 } as GeolocationPositionError);
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          latitude: 10.3157,
          longitude: 123.8854,
          accuracy: 5000,
          source: "ip-approximate",
        }),
      }),
    );

    const result = await resolveCurrentPosition();

    expect(result.source).toBe("ip-approximate");
    expect(result.coords.latitude).toBe(10.3157);
    expect(result.coords.longitude).toBe(123.8854);
  });
});
