// Verifies the geometry that reads a building's angle and shape out of the
// boxes a provider reports. Everything here is in plain metres, which is the
// frame the module works in.
import { describe, expect, it } from "vitest";

import {
  buildingRotationDegrees,
  orientedRectangle,
  polygonArea,
  rectilinearFootprint,
  resolveRotationDegrees,
} from "../../../src/integrations/footprintGeometry";
import type {
  LocalBox,
  RoofPlane,
} from "../../../src/integrations/footprintGeometry";

const box = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): LocalBox => ({ minX, minY, maxX, maxY });

/** Side lengths of a quadrilateral, shortest first. */
const sidesOf = (corners: { x: number; y: number }[]) =>
  corners
    .map((corner, index) => {
      const next = corners[(index + 1) % corners.length];
      return Math.hypot(next.x - corner.x, next.y - corner.y);
    })
    .sort((a, b) => a - b);

const plane = (
  area: number,
  pitch: number | null,
  azimuth: number | null,
  extent: LocalBox,
): RoofPlane => ({
  groundAreaSquareMeters: area,
  pitchDegrees: pitch,
  azimuthDegrees: azimuth,
  box: extent,
});

describe("buildingRotationDegrees", () => {
  it("reads the angle the pitched planes agree on", () => {
    const planes = [
      plane(60, 20, 30, box(0, 0, 10, 10)),
      plane(60, 20, 210, box(0, 0, 10, 10)),
    ];

    expect(buildingRotationDegrees(planes)).toBeCloseTo(30, 6);
  });

  it("ignores a flat plane, whose stated direction is arbitrary", () => {
    // A roof parallel to the ground faces nowhere, and the provider still fills
    // the field in. Letting that number vote spun buildings their pitched
    // planes had already described.
    const pitched = plane(60, 20, 30, box(0, 0, 10, 10));
    const flat = plane(60, 0, 75, box(0, 0, 10, 10));

    expect(buildingRotationDegrees([pitched, flat])).toBeCloseTo(30, 6);
  });

  it("gives no angle at all when every plane is flat", () => {
    const planes = [
      plane(60, 0, 75, box(0, 0, 10, 10)),
      plane(60, 1, 12, box(0, 0, 10, 10)),
    ];

    expect(buildingRotationDegrees(planes)).toBeNull();
  });

  it("gives no angle when the planes disagree about one", () => {
    // Folded to a quarter turn, 0 and 45 degrees point opposite ways and cancel
    // exactly. A roof like that is not a turned rectangle, and averaging to
    // some middle angle would turn the shape on evidence that says nothing.
    const planes = [
      plane(60, 20, 0, box(0, 0, 10, 10)),
      plane(60, 20, 45, box(0, 0, 10, 10)),
    ];

    expect(buildingRotationDegrees(planes)).toBeNull();
  });

  it("lets the larger plane outvote a dormer", () => {
    const main = plane(120, 20, 10, box(0, 0, 10, 10));
    const dormer = plane(6, 30, 80, box(0, 0, 3, 3));

    expect(buildingRotationDegrees([main, dormer])).toBeLessThan(20);
  });
});

describe("orientedRectangle", () => {
  it("returns the box itself when it already matches the measured area", () => {
    const corners = orientedRectangle(box(0, 0, 14, 8), 0, 112)!;

    expect(polygonArea(corners)).toBeCloseTo(112, 6);
  });

  it("pulls an oversized box back to the area the planes were measured at", () => {
    // The box grows with every plane joined into it and with eaves besides, so
    // it runs large. The measured ground area is the figure the assessment is
    // built on, and the seed had better open at it.
    const corners = orientedRectangle(box(0, 0, 14, 16), 0, 160)!;

    expect(polygonArea(corners)).toBeCloseTo(160, 6);
  });

  it("never grows the shape past the box that bounds it", () => {
    // The box is an outer bound on the building, so an area a little above what
    // it can hold is measurement noise rather than roof the fit is missing.
    const corners = orientedRectangle(box(0, 0, 14, 8), 0, 118)!;

    expect(polygonArea(corners)).toBeCloseTo(112, 6);
  });

  it("leaves the geometry alone when the area disagrees wildly", () => {
    // Two measurements this far apart are not describing the same building, and
    // shrinking to a sixth of the box would look deliberate rather than wrong.
    const corners = orientedRectangle(box(0, 0, 14, 8), 0, 18)!;

    expect(polygonArea(corners)).toBeCloseTo(112, 6);
  });

  it("recovers the rectangle at 45 degrees from the area", () => {
    const rotated = orientedRectangle(box(-7.78, -7.78, 7.78, 7.78), 45, 112)!;

    expect(polygonArea(rotated)).toBeCloseTo(112, 0);
  });
});

describe("resolveRotationDegrees", () => {
  /** A 14 by 8 building standing at 30 degrees, as the box it casts. */
  const TURNED = shadowOf(box(-7, -4, 7, 4), 30);
  const AREA = 14 * 8;

  it("finds the angle from the box and the area, with no directions at all", () => {
    // The case that used to be square to the compass: a quarter of real roofs
    // report azimuths that agree on nothing, and the box plus the measured
    // ground is a second witness that never needed them.
    const rotation = resolveRotationDegrees(TURNED, AREA, null);
    const [shortA, , longA] = sidesOf(
      orientedRectangle(TURNED, rotation, AREA)!,
    );

    expect(shortA).toBeCloseTo(8, 1);
    expect(longA).toBeCloseTo(14, 1);
  });

  it("lets the directions choose which way the building leans", () => {
    // A rectangle turned left and the same one turned right cast the same
    // shadow, so geometry alone cannot separate 30 degrees from 60. This is
    // the half of the question the azimuths answer.
    expect(resolveRotationDegrees(TURNED, AREA, 30)).toBeCloseTo(30, 1);
    expect(resolveRotationDegrees(TURNED, AREA, 60)).toBeCloseTo(60, 1);
  });

  it("overrides a direction that cannot explain the building", () => {
    // Square to the compass would need the whole box to be roof, and the
    // measured ground says two thirds of it is not.
    const rotation = resolveRotationDegrees(TURNED, AREA, 2);

    expect(Math.min(rotation, 90 - rotation)).toBeCloseTo(30, 0);
  });

  it("sharpens a direction that is nearly right", () => {
    // Averaged azimuths land a degree or so out, and the box and the area put
    // the angle exactly. The reported direction picks which way the building
    // leans and the geometry refines it, which is each witness doing the part
    // it is good at.
    expect(resolveRotationDegrees(TURNED, AREA, 29.5)).toBeCloseTo(30, 4);
  });

  it("leaves the angle alone when no rectangle of that area fits the box", () => {
    // An L-shaped house among others. There is nothing to recover, and the
    // reported direction is the only thing left worth trusting.
    expect(resolveRotationDegrees(box(0, 0, 14, 16), 900, 12)).toBeCloseTo(
      12,
      6,
    );
  });
});

/** Two wings meeting at a corner: 14 by 8 along the bottom, 6 by 8 up the left. */
const L_SHAPED = [
  plane(112, 20, 180, box(0, 0, 14, 8)),
  plane(48, 20, 180, box(0, 8, 6, 16)),
];

/**
 * The axis-aligned box a building-frame rectangle casts when the building is
 * turned. Built forwards on purpose: the code under test runs this backwards,
 * so a test reusing its arithmetic would agree with any mistake in it.
 */
function shadowOf(rectangle: LocalBox, angleDegrees: number): LocalBox {
  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const along = rectangle.maxX - rectangle.minX;
  const across = rectangle.maxY - rectangle.minY;
  const alongCentre = (rectangle.minX + rectangle.maxX) / 2;
  const acrossCentre = (rectangle.minY + rectangle.maxY) / 2;

  const x = alongCentre * Math.cos(angle) + acrossCentre * Math.sin(angle);
  const y = -alongCentre * Math.sin(angle) + acrossCentre * Math.cos(angle);
  const halfWidth = (along * cos + across * sin) / 2;
  const halfHeight = (along * sin + across * cos) / 2;

  return {
    minX: x - halfWidth,
    maxX: x + halfWidth,
    minY: y - halfHeight,
    maxY: y + halfHeight,
  };
}

describe("rectilinearFootprint", () => {
  it("traces the L rather than boxing it in", () => {
    const footprint = rectilinearFootprint(L_SHAPED, 0)!;

    // Six corners is what an L has, and the ground it covers is the two wings
    // rather than the 14-by-16 box around them.
    expect(footprint).toHaveLength(6);
    expect(polygonArea(footprint)).toBeCloseTo(14 * 8 + 6 * 8, 6);
  });

  it("leaves a rectangular building to the rectangle", () => {
    // Both halves of a gable, side by side. The union is a plain quadrilateral,
    // which the turned rectangle already handles and sizes to the measured area.
    const gable = [
      plane(56, 20, 0, box(0, 0, 14, 4)),
      plane(56, 20, 180, box(0, 4, 14, 8)),
    ];

    expect(rectilinearFootprint(gable, 0)).toBeNull();
  });

  it("does not grow a staircase along a join that is a few centimetres out", () => {
    // Planes of one roof rarely line up exactly, and a plain union answers that
    // with a sliver at every seam.
    const ragged = [
      plane(112, 20, 0, box(0, 0, 14, 4)),
      plane(112, 20, 180, box(0.4, 4, 13.7, 8)),
    ];

    expect(rectilinearFootprint(ragged, 0)).toBeNull();
  });

  it("holds off near 45 degrees, where each plane's box inverts to noise", () => {
    expect(rectilinearFootprint(L_SHAPED, 45)).toBeNull();
  });

  it("traces the same L when the building stands off the compass", () => {
    // The very case a single box cannot describe: an L-shaped house at an
    // angle. Each plane arrives as the box it casts, and the shape and the
    // ground it covers both survive being recovered and turned back.
    const turned = rectilinearFootprint(
      L_SHAPED.map((wing) => ({ ...wing, box: shadowOf(wing.box, 20) })),
      20,
    )!;

    expect(turned).toHaveLength(6);
    expect(polygonArea(turned)).toBeCloseTo(14 * 8 + 6 * 8, 6);
  });
});
