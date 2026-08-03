// Verifies that the seeded outline lands on the roof under the pin.
import { describe, expect, it } from "vitest";

import { outlineToCorners } from "../../../src/integrations/buildingOutline";

const box = (south: number, west: number, size = 0.0002) => ({
  south,
  west,
  north: south + size,
  east: west + size,
});

const segment = (bounding_box: ReturnType<typeof box>, area: number) => ({
  bounding_box,
  area_square_meters: area,
  pitch_degrees: 15,
  azimuth_degrees: 180,
});

/** A small plane under the pin, and a bigger one further along the building. */
const SMALL_UNDER_PIN = box(10.3157, 123.8854);
const LARGE_NEARBY = box(10.3161, 123.8858, 0.0004);

const OUTLINE = {
  center: { latitude: 10.3159, longitude: 123.8856 },
  bounding_box: box(10.3155, 123.8852, 0.0012),
  segments: [segment(LARGE_NEARBY, 120), segment(SMALL_UNDER_PIN, 31)],
};

const PIN = { latitude: 10.3158, longitude: 123.8855 };

describe("outlineToCorners with a pin", () => {
  it("takes the plane under the pin over the biggest one", () => {
    // Choosing the biggest plane is what put the starting shape on a
    // neighbouring roof: one building holds many planes, and the largest can
    // sit tens of metres from where the person actually dropped their pin.
    const corners = outlineToCorners(OUTLINE, PIN);

    expect(corners?.map((c) => c.latitude)).toContain(SMALL_UNDER_PIN.north);
    expect(corners?.map((c) => c.latitude)).not.toContain(LARGE_NEARBY.north);
  });

  it("falls to the nearest plane when the pin is between them", () => {
    // Clear of both planes and their edge tolerance, and closer to the large
    // one, so this asserts the distance tie-break rather than containment.
    const between = { latitude: 10.316025, longitude: 123.8858 };

    const corners = outlineToCorners(OUTLINE, between);

    expect(corners?.map((c) => c.latitude)).toContain(LARGE_NEARBY.north);
  });

  it("refuses a building the pin is not standing on", () => {
    // The provider answers with the nearest building, which in a dense row is
    // regularly the neighbour's. A square at the pin is more honest than a
    // confident trace of the wrong roof.
    const faraway = { latitude: 10.32, longitude: 123.89 };

    expect(outlineToCorners(OUTLINE, faraway)).toBeNull();
  });

  it("allows a pin sitting right on the roof edge", () => {
    const onEdge = {
      latitude: OUTLINE.bounding_box.north,
      longitude: OUTLINE.bounding_box.east,
    };

    expect(outlineToCorners(OUTLINE, onEdge)).not.toBeNull();
  });

  it("leaves a plane across a gap out of the outline", () => {
    // Planes of one roof meet along a shared edge. A plane six metres clear of
    // every other one is over a firewall or an alley, and joining it stretched
    // the starting shape across next door's roof.
    const METRES_PER_DEGREE = 111_320;
    const near = box(10.3157, 123.8854, 0.00007);
    const across = {
      south: near.north + 6 / METRES_PER_DEGREE,
      north: near.north + 6 / METRES_PER_DEGREE + 0.00007,
      west: near.west,
      east: near.east,
    };
    const outline = {
      center: { latitude: 10.3158, longitude: 123.8855 },
      bounding_box: { ...near, north: across.north },
      segments: [segment(near, 60), segment(across, 60)],
    };
    const pin = { latitude: 10.31573, longitude: 123.88545 };

    const northernmost = Math.max(
      ...outlineToCorners(outline, pin)!.map((corner) => corner.latitude),
    );

    expect(northernmost).toBeLessThan(across.south);
  });

  it("still uses the building box when it knows of no planes", () => {
    const corners = outlineToCorners({ ...OUTLINE, segments: [] }, PIN);

    expect(corners?.map((c) => c.latitude)).toContain(
      OUTLINE.bounding_box.north,
    );
  });
});
