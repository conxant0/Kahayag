import { describe, expect, it } from "vitest";

import { getMapTypeId } from "../../../../src/integrations/maps/googleMapsHelpers";

describe("getMapTypeId", () => {
  it("prefers satellite when available", () => {
    expect(
      getMapTypeId({
        MapTypeId: { SATELLITE: "satellite", HYBRID: "hybrid" },
      } as GoogleMapsApi),
    ).toBe("satellite");
  });

  it("falls back to hybrid when satellite is unavailable", () => {
    expect(
      getMapTypeId({ MapTypeId: { HYBRID: "hybrid" } } as GoogleMapsApi),
    ).toBe("hybrid");
  });

  it("falls back to a satellite string when MapTypeId is missing", () => {
    expect(getMapTypeId(undefined)).toBe("satellite");
  });
});
