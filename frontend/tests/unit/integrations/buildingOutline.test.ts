// Verifies the footprint used to seed a roof trace, and what happens when
// there isn't one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchBuildingOutline,
  outlineToCorners,
} from "../../../src/integrations/buildingOutline";

const BUILDING = {
  south: 10.3155,
  west: 123.8852,
  north: 10.3159,
  east: 123.8856,
};

const SEGMENT = {
  south: 10.3156,
  west: 123.8853,
  north: 10.3158,
  east: 123.8855,
};

const PAYLOAD = {
  center: { latitude: 10.3157, longitude: 123.8854 },
  bounding_box: BUILDING,
  segments: [
    {
      bounding_box: SEGMENT,
      area_square_meters: 64,
      pitch_degrees: 12,
      azimuth_degrees: 190,
    },
  ],
};

const METRES_PER_DEGREE_LATITUDE = 111_320;
const ORIGIN = { latitude: 10.3157, longitude: 123.8854 };
const METRES_PER_DEGREE_LONGITUDE =
  METRES_PER_DEGREE_LATITUDE * Math.cos((ORIGIN.latitude * Math.PI) / 180);

/** A point so many metres east and north of the origin. */
const metres = (east: number, north: number) => ({
  latitude: ORIGIN.latitude + north / METRES_PER_DEGREE_LATITUDE,
  longitude: ORIGIN.longitude + east / METRES_PER_DEGREE_LONGITUDE,
});

const metreBox = (
  minEast: number,
  minNorth: number,
  maxEast: number,
  maxNorth: number,
) => ({
  south: metres(minEast, minNorth).latitude,
  west: metres(minEast, minNorth).longitude,
  north: metres(maxEast, maxNorth).latitude,
  east: metres(maxEast, maxNorth).longitude,
});

/** Shoelace over the returned corners, back in metres. */
function areaOf(corners: { latitude: number; longitude: number }[]) {
  const points = corners.map((corner) => ({
    x: (corner.longitude - ORIGIN.longitude) * METRES_PER_DEGREE_LONGITUDE,
    y: (corner.latitude - ORIGIN.latitude) * METRES_PER_DEGREE_LATITUDE,
  }));

  const twice = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0);

  return Math.abs(twice) / 2;
}

/** Two wings: 14 by 8 along the bottom, 6 by 8 up the left of it. */
const L_SHAPED_HOUSE = {
  center: metres(7, 8),
  bounding_box: metreBox(0, 0, 14, 16),
  segments: [
    {
      bounding_box: metreBox(0, 0, 14, 8),
      area_square_meters: 119,
      ground_area_square_meters: 112,
      pitch_degrees: 20,
      azimuth_degrees: 180,
    },
    {
      bounding_box: metreBox(0, 8, 6, 16),
      area_square_meters: 51,
      ground_area_square_meters: 48,
      pitch_degrees: 20,
      azimuth_degrees: 180,
    },
  ],
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

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchBuildingOutline", () => {
  it("asks our own backend for the point given", async () => {
    const fetchMock = mockFetch(PAYLOAD);

    await fetchBuildingOutline({ latitude: 10.3157, longitude: 123.8854 });
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://api.test");

    expect(url.pathname).toContain("/properties/roof-outline");
    expect(url.searchParams.get("latitude")).toBe("10.3157");
  });

  it("returns the outline when the provider knows the building", async () => {
    mockFetch(PAYLOAD);

    const outline = await fetchBuildingOutline({
      latitude: 10.3157,
      longitude: 123.8854,
    });

    expect(outline?.segments).toHaveLength(1);
    expect(outline?.bounding_box).toEqual(BUILDING);
  });

  it.each([
    ["a 404, meaning no surveyed building", { detail: "none" }, false, 404],
    ["a server error", { detail: "boom" }, false, 502],
  ])("resolves to null on %s", async (_label, body, ok, status) => {
    // A footprint is a convenience. Never having been surveyed is an ordinary
    // outcome, and the caller falls back to drawing its own shape.
    mockFetch(body, ok as boolean, status as number);

    await expect(
      fetchBuildingOutline({ latitude: 10.3157, longitude: 123.8854 }),
    ).resolves.toBeNull();
  });

  it("resolves to null when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(
      fetchBuildingOutline({ latitude: 10.3157, longitude: 123.8854 }),
    ).resolves.toBeNull();
  });

  it("discards a payload carrying no usable geometry", async () => {
    mockFetch({ center: null, bounding_box: null, segments: [] });

    await expect(
      fetchBuildingOutline({ latitude: 10.3157, longitude: 123.8854 }),
    ).resolves.toBeNull();
  });

  it("drops a segment whose box has no extent", async () => {
    mockFetch({
      ...PAYLOAD,
      segments: [
        {
          ...PAYLOAD.segments[0],
          bounding_box: { ...SEGMENT, north: SEGMENT.south },
        },
      ],
    });

    const outline = await fetchBuildingOutline({
      latitude: 10.3157,
      longitude: 123.8854,
    });

    expect(outline?.segments).toEqual([]);
  });
});

describe("outlineToCorners", () => {
  it("seeds from the roof plane rather than the whole building", () => {
    // The shape is turned to sit square with the building, so it no longer
    // shares the plane's edges. It should still be centred on that plane and
    // stay well inside the footprint of the building as a whole.
    const corners = outlineToCorners(PAYLOAD);

    expect(corners).toHaveLength(4);

    const mean = (values: number[]) =>
      values.reduce((total, value) => total + value, 0) / values.length;
    const centreLatitude = mean(corners!.map((c) => c.latitude));
    const centreLongitude = mean(corners!.map((c) => c.longitude));

    expect(centreLatitude).toBeCloseTo((SEGMENT.south + SEGMENT.north) / 2, 6);
    expect(centreLongitude).toBeCloseTo((SEGMENT.west + SEGMENT.east) / 2, 6);
    expect(Math.max(...corners!.map((c) => c.latitude))).toBeLessThanOrEqual(
      BUILDING.north,
    );
  });

  it("turns the shape to match a building standing off the compass", () => {
    // Every box the provider sends is square to north, so a house at an angle
    // arrives as a box that overshoots on all four sides. The azimuths carry
    // the real angle, and a turned rectangle covers roof instead of garden.
    const corners = outlineToCorners(PAYLOAD);
    const latitudes = corners!.map((c) => c.latitude);

    // A square-to-north rectangle has its corners in two pairs. A turned one
    // has four distinct edges.
    expect(new Set(latitudes.map((value) => value.toFixed(8))).size).toBe(4);
  });

  it("still finds an angle when the planes report no direction", () => {
    /*
     * A flat roof faces nowhere and a complex one faces everywhere, so a
     * quarter of real buildings offer no usable direction at all. They used to
     * be laid square to the compass at the full size of the box, which on this
     * payload is 488 m² of box around 63 m² of roof.
     *
     * The box and the measured area are enough on their own: exactly one
     * rectangle of that area fits that box, give or take which way it leans.
     */
    const flat = {
      ...PAYLOAD,
      segments: [{ ...PAYLOAD.segments[0], azimuth_degrees: null }],
    };

    const corners = outlineToCorners(flat)!;
    const latitudes = corners.map((corner) => corner.latitude);

    // Four distinct edges is a turned shape; a square-to-north box has two.
    expect(new Set(latitudes.map((value) => value.toFixed(8))).size).toBe(4);
    expect(areaOf(corners)).toBeCloseTo(
      PAYLOAD.segments[0].area_square_meters *
        Math.cos((PAYLOAD.segments[0].pitch_degrees * Math.PI) / 180),
      0,
    );
  });

  it("falls back to the building footprint when there are no planes", () => {
    const corners = outlineToCorners({ ...PAYLOAD, segments: [] });

    expect(corners?.some((c) => c.latitude === BUILDING.north)).toBe(true);
  });

  it("returns null when there is nothing to seed from", () => {
    expect(outlineToCorners(null)).toBeNull();
    expect(
      outlineToCorners({ center: null, bounding_box: null, segments: [] }),
    ).toBeNull();
  });

  it("traces an L-shaped house as an L", () => {
    // The whole reason the shape is worked out plane by plane. A single
    // rectangle over this house covers the empty quarter as if it were roof,
    // and the person tracing has to drag a corner in to take it back.
    const corners = outlineToCorners(L_SHAPED_HOUSE, {
      latitude: metres(7, 4).latitude,
      longitude: metres(7, 4).longitude,
    })!;

    expect(corners).toHaveLength(6);
    expect(areaOf(corners)).toBeCloseTo(14 * 8 + 6 * 8, 0);
  });

  it("walks the corners in order, so the seed is not a bowtie", () => {
    // Opposite corners of a rectangle are the diagonal, so each one has to be
    // further from its start than either neighbour is. A crossed order pairs
    // the diagonal as an edge and fails this.
    const corners = outlineToCorners(PAYLOAD)!;
    const gap = (a: { latitude: number; longitude: number }, b: typeof a) =>
      Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude);

    expect(gap(corners[0], corners[2])).toBeGreaterThan(
      gap(corners[0], corners[1]),
    );
    expect(gap(corners[0], corners[2])).toBeGreaterThan(
      gap(corners[0], corners[3]),
    );
  });
});
