// Verifies that a turned building gets a turned starting shape.
import { describe, expect, it } from "vitest";

import { outlineToCorners } from "../../../src/integrations/buildingOutline";

const CENTRE = { latitude: 10.3157, longitude: 123.8854 };
const METRES_PER_DEGREE_LATITUDE = 111_320;

/**
 * The axis-aligned box a rectangle of these dimensions casts when turned.
 *
 * Built the forward way on purpose: the code under test runs this backwards,
 * so a test that reused its arithmetic would agree with any mistake in it.
 */
function boxAround(widthMeters: number, depthMeters: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const boxWidth = widthMeters * cos + depthMeters * sin;
  const boxHeight = widthMeters * sin + depthMeters * cos;
  const metresPerDegreeLongitude =
    METRES_PER_DEGREE_LATITUDE * Math.cos((CENTRE.latitude * Math.PI) / 180);

  const halfLat = boxHeight / 2 / METRES_PER_DEGREE_LATITUDE;
  const halfLng = boxWidth / 2 / metresPerDegreeLongitude;

  return {
    south: CENTRE.latitude - halfLat,
    north: CENTRE.latitude + halfLat,
    west: CENTRE.longitude - halfLng,
    east: CENTRE.longitude + halfLng,
  };
}

const PITCH_DEGREES = 15;

/**
 * A building of these dimensions, described the way the provider describes one.
 *
 * The stated area is measured along the slope, so a roof standing over
 * `width × depth` of ground reports more than that. Writing the ground figure
 * into that field would describe a pitched roof lying flat, and the fit reads
 * the two as different quantities.
 */
function outlineAt(angleDeg: number, width = 14, depth = 8) {
  const bounding_box = boxAround(width, depth, angleDeg);
  return {
    center: CENTRE,
    bounding_box,
    segments: [
      {
        bounding_box,
        area_square_meters:
          (width * depth) / Math.cos((PITCH_DEGREES * Math.PI) / 180),
        ground_area_square_meters: width * depth,
        pitch_degrees: PITCH_DEGREES,
        azimuth_degrees: angleDeg,
      },
    ],
  };
}

/** Side lengths of the returned quad, in metres, shortest first. */
function sides(corners: { latitude: number; longitude: number }[]) {
  const metresPerDegreeLongitude =
    METRES_PER_DEGREE_LATITUDE * Math.cos((CENTRE.latitude * Math.PI) / 180);

  return corners
    .map((corner, index) => {
      const next = corners[(index + 1) % corners.length];
      return Math.hypot(
        (next.latitude - corner.latitude) * METRES_PER_DEGREE_LATITUDE,
        (next.longitude - corner.longitude) * metresPerDegreeLongitude,
      );
    })
    .sort((a, b) => a - b);
}

describe("the turned starting shape", () => {
  it.each([15, 25, 30, 60, 70, 80])(
    "recovers the real rectangle from the box it casts at %s degrees",
    (angle) => {
      const corners = outlineToCorners(outlineAt(angle), CENTRE)!;
      const [shortA, shortB, longA, longB] = sides(corners);

      expect(shortA).toBeCloseTo(8, 1);
      expect(shortB).toBeCloseTo(8, 1);
      expect(longA).toBeCloseTo(14, 1);
      expect(longB).toBeCloseTo(14, 1);
    },
  );

  it("covers far less ground than the box it came from", () => {
    // This is the whole point: at 30 degrees the axis-aligned box is roughly
    // half again the size of the roof, and all of that excess is garden.
    const outline = outlineAt(30);
    const box = outline.bounding_box;
    const metresPerDegreeLongitude =
      METRES_PER_DEGREE_LATITUDE * Math.cos((CENTRE.latitude * Math.PI) / 180);
    const boxArea =
      (box.north - box.south) *
      METRES_PER_DEGREE_LATITUDE *
      ((box.east - box.west) * metresPerDegreeLongitude);

    const [, , long] = sides(outlineToCorners(outline, CENTRE)!);

    expect(boxArea).toBeGreaterThan(14 * 8 * 1.3);
    expect(long).toBeCloseTo(14, 1);
  });

  it("recovers the rectangle at 45 degrees, where the pair of equations cannot", () => {
    // Subtracting the two shadow equations is what degenerates at 45 degrees.
    // Adding them does not, and the measured ground area supplies what the
    // subtraction would have. This band used to give up and return the box.
    const [shortA, shortB, longA, longB] = sides(
      outlineToCorners(outlineAt(45), CENTRE)!,
    );

    expect(shortA).toBeCloseTo(8, 1);
    expect(shortB).toBeCloseTo(8, 1);
    expect(longA).toBeCloseTo(14, 1);
    expect(longB).toBeCloseTo(14, 1);
  });

  it("keeps the box at 45 degrees when the area cannot close the system", () => {
    // Without a believable area there is nothing to replace the subtraction
    // with. A square box is a poor answer; a wildly wrong rectangle presented
    // confidently is a worse one.
    const outline = outlineAt(45);
    outline.segments = [
      {
        ...outline.segments[0],
        // Far more roof than the box could hold, so the two measurements are
        // not describing the same building and neither is trusted.
        area_square_meters: 4_000,
        ground_area_square_meters: 4_000,
      },
    ];

    const corners = outlineToCorners(outline, CENTRE)!;
    const latitudes = new Set(corners.map((c) => c.latitude.toFixed(9)));

    expect(latitudes.size).toBe(2);
  });

  it("treats 1 degree and 89 degrees as the same angle", () => {
    // Averaging those as plain numbers gives 45, which is wrong in both
    // directions and lands in the band that gives up.
    const outline = outlineAt(0);
    outline.segments = [
      { ...outline.segments[0], azimuth_degrees: 1 },
      { ...outline.segments[0], azimuth_degrees: 89 },
    ];

    const corners = outlineToCorners(outline, CENTRE)!;
    const [shortA, , longA] = sides(corners);

    expect(shortA).toBeCloseTo(8, 0);
    expect(longA).toBeCloseTo(14, 0);
  });
});
