import { describe, expect, it } from "vitest";

import {
  computeFluxCacheKey,
  needsFluxForPanelLayout,
} from "../../../../src/features/results/fluxCacheKey";

const property = { latitude: 10.3157, longitude: 123.8854 };
const roof = [
  property,
  { latitude: 10.3158, longitude: 123.8854 },
  { latitude: 10.3158, longitude: 123.8855 },
];

describe("fluxCacheKey", () => {
  it("keys layers only when property and roof context exist", () => {
    expect(
      computeFluxCacheKey({ roofCoordinates: [], selectedProperty: property }),
    ).toBeNull();
    expect(
      computeFluxCacheKey({
        roofCoordinates: roof,
        selectedProperty: property,
      }),
    ).toContain('"roofCoordinates"');
  });

  it("loads flux only for shaded, panelled, traced roofs", () => {
    expect(
      needsFluxForPanelLayout({
        shading: {},
        roofCoordinates: roof,
        panelCount: 1,
      }),
    ).toBe(true);
    expect(
      needsFluxForPanelLayout({
        shading: null,
        roofCoordinates: roof,
        panelCount: 1,
      }),
    ).toBe(false);
  });
});
