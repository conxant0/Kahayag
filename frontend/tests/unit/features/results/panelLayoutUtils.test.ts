import { describe, expect, it } from "vitest";

import {
  layoutPanelsInPolygon,
  primaryRoofAngleRadians,
} from "../../../../src/features/results/panelLayoutUtils";
import { resolveLayoutContext } from "../../../../src/features/results/layoutContext";
import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import type { GeoPoint } from "../../../../src/shared/api/types";

const cebuRoof: GeoPoint[] = [
  { latitude: 10.3157, longitude: 123.8854 },
  { latitude: 10.3159, longitude: 123.8854 },
  { latitude: 10.3159, longitude: 123.8856 },
  { latitude: 10.3157, longitude: 123.8856 },
];

const lShapedRoof: GeoPoint[] = [
  { latitude: 10.3157, longitude: 123.8854 },
  { latitude: 10.31582, longitude: 123.8854 },
  { latitude: 10.31582, longitude: 123.88552 },
  { latitude: 10.31576, longitude: 123.88552 },
  { latitude: 10.31576, longitude: 123.88562 },
  { latitude: 10.3157, longitude: 123.88562 },
];

function panelCenter(panels: Array<{ corners: GeoPoint[] }>): GeoPoint {
  const corners = panels.flatMap((panel) => panel.corners);
  return {
    latitude:
      corners.reduce((sum, point) => sum + point.latitude, 0) / corners.length,
    longitude:
      corners.reduce((sum, point) => sum + point.longitude, 0) / corners.length,
  };
}

function roofCenter(coordinates: GeoPoint[]): GeoPoint {
  return {
    latitude:
      coordinates.reduce((sum, point) => sum + point.latitude, 0) /
      coordinates.length,
    longitude:
      coordinates.reduce((sum, point) => sum + point.longitude, 0) /
      coordinates.length,
  };
}

function buildRotatedRectangleRoof({
  centerLat,
  centerLng,
  widthM,
  heightM,
  angleRadians,
}: {
  centerLat: number;
  centerLng: number;
  widthM: number;
  heightM: number;
  angleRadians: number;
}): GeoPoint[] {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.cos((centerLat * Math.PI) / 180);
  const halfWidthLat =
    (widthM / 2 / metersPerDegreeLat) * Math.sin(angleRadians);
  const halfWidthLng =
    (widthM / 2 / metersPerDegreeLng) * Math.cos(angleRadians);
  const halfHeightLat =
    (heightM / 2 / metersPerDegreeLat) * Math.cos(angleRadians);
  const halfHeightLng =
    (heightM / 2 / metersPerDegreeLng) * Math.sin(angleRadians);

  return [
    {
      latitude: centerLat - halfWidthLat - halfHeightLat,
      longitude: centerLng - halfWidthLng + halfHeightLng,
    },
    {
      latitude: centerLat + halfWidthLat - halfHeightLat,
      longitude: centerLng + halfWidthLng + halfHeightLng,
    },
    {
      latitude: centerLat + halfWidthLat + halfHeightLat,
      longitude: centerLng + halfWidthLng - halfHeightLng,
    },
    {
      latitude: centerLat - halfWidthLat + halfHeightLat,
      longitude: centerLng - halfWidthLng - halfHeightLng,
    },
  ];
}

describe("layoutPanelsInPolygon", () => {
  it("places panels inside a traced roof polygon", () => {
    const panels = layoutPanelsInPolygon({
      coordinates: cebuRoof,
      panelCount: 6,
      panelWidthM: 1.13,
      panelHeightM: 1.76,
    });

    expect(panels.length).toBeGreaterThan(0);
    expect(panels.length).toBeLessThanOrEqual(6);
    expect(panels[0]!.corners).toHaveLength(4);
  });

  it("centers panel groups instead of anchoring them to one corner", () => {
    const placed = panelCenter(
      layoutPanelsInPolygon({
        coordinates: cebuRoof,
        panelCount: 4,
        panelWidthM: 1.13,
        panelHeightM: 1.76,
      }),
    );
    const target = roofCenter(cebuRoof);

    expect(Math.abs(placed.latitude - target.latitude)).toBeLessThan(0.00003);
    expect(Math.abs(placed.longitude - target.longitude)).toBeLessThan(0.00003);
  });

  it("keeps panel footprints inside an L-shaped trace bounds", () => {
    const panels = layoutPanelsInPolygon({
      coordinates: lShapedRoof,
      panelCount: 4,
      panelWidthM: 1.13,
      panelHeightM: 1.76,
    });

    expect(panels.length).toBeGreaterThan(0);
    const minLat = Math.min(...lShapedRoof.map((point) => point.latitude));
    const maxLat = Math.max(...lShapedRoof.map((point) => point.latitude));
    const minLng = Math.min(...lShapedRoof.map((point) => point.longitude));
    const maxLng = Math.max(...lShapedRoof.map((point) => point.longitude));

    for (const panel of panels) {
      for (const corner of panel.corners) {
        expect(corner.latitude).toBeGreaterThanOrEqual(minLat - 0.000001);
        expect(corner.latitude).toBeLessThanOrEqual(maxLat + 0.000001);
        expect(corner.longitude).toBeGreaterThanOrEqual(minLng - 0.000001);
        expect(corner.longitude).toBeLessThanOrEqual(maxLng + 0.000001);
      }
    }
  });

  it("rotates panels to follow a tilted roof trace", () => {
    const panels = layoutPanelsInPolygon({
      coordinates: buildRotatedRectangleRoof({
        centerLat: 10.3158,
        centerLng: 123.8855,
        widthM: 24,
        heightM: 14,
        angleRadians: Math.PI / 4,
      }),
      panelCount: 6,
      panelWidthM: 1.13,
      panelHeightM: 1.76,
    });

    expect(panels.length).toBeGreaterThan(0);
    const [first, second] = panels[0]!.corners;
    expect(Math.abs(second!.latitude - first!.latitude)).toBeGreaterThan(
      0.000001,
    );
    expect(Math.abs(second!.longitude - first!.longitude)).toBeGreaterThan(
      0.000001,
    );
  });

  it("never returns more panels than fit the requested physical geometry", () => {
    const feasible = layoutPanelsInPolygon({
      coordinates: cebuRoof,
      panelCount: 1_000,
      panelWidthM: 1.13,
      panelHeightM: 1.76,
    });
    const repeated = layoutPanelsInPolygon({
      coordinates: cebuRoof,
      panelCount: feasible.length + 10,
      panelWidthM: 1.13,
      panelHeightM: 1.76,
    });

    expect(repeated.length).toBe(feasible.length);
  });

  it("returns an empty list for zero or negative counts", () => {
    expect(
      layoutPanelsInPolygon({ coordinates: cebuRoof, panelCount: 0 }),
    ).toEqual([]);
    expect(
      layoutPanelsInPolygon({ coordinates: cebuRoof, panelCount: -1 }),
    ).toEqual([]);
  });
});

describe("primaryRoofAngleRadians", () => {
  it("uses the longest edge bearing for a rectangle", () => {
    expect(
      primaryRoofAngleRadians([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 0, y: 4 },
      ]),
    ).toBeCloseTo(0, 5);
  });
});

describe("resolveLayoutContext", () => {
  it("uses the response recommendation and traced roof for the editor", () => {
    const context = resolveLayoutContext({
      result: fixture,
      roofPolygon: { coordinates: cebuRoof, areaSquareMeters: 40 },
    });

    expect(context.currentPanelCount).toBe(8);
    expect(context.recommendedPanelCount).toBe(8);
    expect(context.panelWidthM).toBe(1.13);
    expect(context.panelHeightM).toBe(1.76);
    expect(context.maxPanels).toBeGreaterThanOrEqual(8);
    expect(context.coordinates).toEqual(cebuRoof);
  });
});
