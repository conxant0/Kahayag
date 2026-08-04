// Defines the building footprint used to seed a roof trace, served by our own
// backend.
//
// The provider behind it is the backend's business. This asks for "the roof
// under this point" and gets plain corners back.
import {
  buildingRotationDegrees,
  orientedRectangle,
  polygonArea,
  rectilinearFootprint,
  resolveRotationDegrees,
} from "./footprintGeometry";
import type { LocalBox, LocalPoint, RoofPlane } from "./footprintGeometry";
import { ApiError, apiGet } from "../shared/api/client";
import { ENDPOINTS } from "../shared/api/endpoints";

/** Named edges rather than the corner pairs a mapping API tends to use. */
export type OutlineBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type RoofSegmentOutline = {
  bounding_box: OutlineBounds;
  area_square_meters: number;
  /**
   * Ground covered by the plane, where `area_square_meters` is measured along
   * the slope. Optional because a payload predating the field still fits, and
   * the pitch recovers it well enough when it is missing.
   */
  ground_area_square_meters?: number | null;
  pitch_degrees: number | null;
  azimuth_degrees: number | null;
};

export type BuildingOutline = {
  center: { latitude: number; longitude: number } | null;
  bounding_box: OutlineBounds | null;
  segments: RoofSegmentOutline[];
};

function isBounds(value: unknown): value is OutlineBounds {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const bounds = value as Partial<OutlineBounds>;
  return (
    typeof bounds.south === "number" &&
    typeof bounds.west === "number" &&
    typeof bounds.north === "number" &&
    typeof bounds.east === "number" &&
    bounds.south < bounds.north &&
    bounds.west < bounds.east
  );
}

/**
 * Fetches the footprint under a point, or null when there is none.
 *
 * Null rather than a throw: an outline is a convenience, and a building the
 * provider has never surveyed is an ordinary outcome rather than a failure.
 * The caller draws its own starting shape instead.
 *
 * A 404 and a provider failure are not the same nothing, though. A building
 * never surveyed will still not be surveyed a second later, so a 404 settles
 * it. A 5xx or a dropped connection is transient, and treating it as "never
 * surveyed" silently downgraded the whole session to the plain square; one
 * immediate retry is the cheapest way to tell the two apart.
 */
export async function fetchBuildingOutline(position: {
  latitude: number;
  longitude: number;
}): Promise<BuildingOutline | null> {
  const params = new URLSearchParams({
    latitude: String(position.latitude),
    longitude: String(position.longitude),
  });
  const path = `${ENDPOINTS.roofOutline}?${params.toString()}`;

  try {
    return normalised(await apiGet<BuildingOutline>(path));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    try {
      return normalised(await apiGet<BuildingOutline>(path));
    } catch {
      return null;
    }
  }
}

function normalised(payload: BuildingOutline | null): BuildingOutline | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const segments = Array.isArray(payload.segments)
    ? payload.segments.filter((segment) => isBounds(segment?.bounding_box))
    : [];
  const bounds = isBounds(payload.bounding_box) ? payload.bounding_box : null;

  if (!bounds && segments.length === 0) {
    return null;
  }

  return { center: payload.center ?? null, bounding_box: bounds, segments };
}

/**
 * Roughly 11 m of slack, in degrees.
 *
 * A pin dropped on the edge of a roof, or placed from an address rather than
 * by hand, should still count as standing on the building. Five metres was the
 * first guess and turned out to be tighter than the pins people actually drop:
 * a real pin landed 5.2 m short of its own roof and the whole fit was thrown
 * away over it.
 */
const EDGE_TOLERANCE_DEGREES = 0.0001;

/**
 * Roughly 3 m of slack, in degrees.
 *
 * The slack a pin needs and the slack two roof planes need are different
 * questions, and answering both with the pin's figure was too generous by far.
 * Planes of one roof meet along a shared edge, so a few metres covers every
 * gap the provider's boxes leave between them, while 11 m in every direction
 * reached across a firewall and pulled the neighbour's roof into the outline.
 */
const MERGE_TOLERANCE_DEGREES = 0.00003;

function padded(
  bounds: OutlineBounds,
  tolerance: number = EDGE_TOLERANCE_DEGREES,
): OutlineBounds {
  return {
    south: bounds.south - tolerance,
    west: bounds.west - tolerance,
    north: bounds.north + tolerance,
    east: bounds.east + tolerance,
  };
}

function contains(bounds: OutlineBounds, point: OutlinePoint) {
  return (
    point.latitude >= bounds.south &&
    point.latitude <= bounds.north &&
    point.longitude >= bounds.west &&
    point.longitude <= bounds.east
  );
}

/** Squared degree distance from a box's centre. Only ever compared, never read. */
function distanceFromCentre(bounds: OutlineBounds, point: OutlinePoint) {
  const latitude = (bounds.south + bounds.north) / 2 - point.latitude;
  const longitude = (bounds.west + bounds.east) / 2 - point.longitude;
  return latitude * latitude + longitude * longitude;
}

export type OutlinePoint = { latitude: number; longitude: number };

function overlaps(a: OutlineBounds, b: OutlineBounds) {
  return (
    a.west <= b.east &&
    a.east >= b.west &&
    a.south <= b.north &&
    a.north >= b.south
  );
}

function union(a: OutlineBounds, b: OutlineBounds): OutlineBounds {
  return {
    south: Math.min(a.south, b.south),
    west: Math.min(a.west, b.west),
    north: Math.max(a.north, b.north),
    east: Math.max(a.east, b.east),
  };
}

function clip(bounds: OutlineBounds, limit: OutlineBounds | null | undefined) {
  if (!limit) {
    return bounds;
  }

  return {
    south: Math.max(bounds.south, limit.south),
    west: Math.max(bounds.west, limit.west),
    north: Math.min(bounds.north, limit.north),
    east: Math.min(bounds.east, limit.east),
  };
}

/**
 * Grows the starting shape from one roof plane out across the planes it meets.
 *
 * A single plane is a slice of a roof, not a roof. A hip roof is four of them
 * and a gable two, so seeding from the one under the pin covered a quarter of
 * the house and left the person dragging corners across the other three.
 *
 * Spreading only through planes that actually touch is what keeps this from
 * becoming "the whole building": a detached extension or a shared wall next
 * door is a separate run of planes and never joins the union.
 */
function growThroughTouchingPlanes(
  start: RoofSegmentOutline,
  segments: RoofSegmentOutline[],
): RoofSegmentOutline[] {
  let bounds = start.bounding_box;
  const joinedPlanes = [start];
  const remaining = segments.filter((segment) => segment !== start);

  // Each pass can bring the union into contact with planes the previous pass
  // could not reach, so this repeats until a pass adds nothing.
  let joined = true;
  while (joined) {
    joined = false;
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      if (
        overlaps(
          padded(bounds, MERGE_TOLERANCE_DEGREES),
          candidate.bounding_box,
        )
      ) {
        bounds = union(bounds, candidate.bounding_box);
        joinedPlanes.push(candidate);
        remaining.splice(index, 1);
        joined = true;
      }
    }
  }

  return joinedPlanes;
}

function boundsAround(segments: RoofSegmentOutline[]): OutlineBounds | null {
  return segments.reduce<OutlineBounds | null>(
    (total, segment) =>
      total ? union(total, segment.bounding_box) : segment.bounding_box,
    null,
  );
}

/**
 * Ground the plane stands over, rather than metres measured along its slope.
 *
 * The provider states this directly. Where it does not, the pitch converts: a
 * plane at `p` degrees covers `cos p` of its own area. Getting this wrong tilts
 * every fitted outline the same way, since a roof's stated area is always the
 * larger of the two figures and a footprint has to be the flat one.
 */
function groundArea(segment: RoofSegmentOutline) {
  const stated = segment.ground_area_square_meters;
  if (typeof stated === "number" && stated > 0) {
    return stated;
  }

  if (segment.pitch_degrees === null) {
    return segment.area_square_meters;
  }

  return (
    segment.area_square_meters * Math.cos(toRadians(segment.pitch_degrees))
  );
}

const METRES_PER_DEGREE_LATITUDE = 111_320;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Metres east and north of a reference point, which is where the geometry runs.
 *
 * Degrees of longitude are shorter than degrees of latitude everywhere but the
 * equator, so any shape reasoned about in degrees is reasoned about stretched.
 * A flat local frame is exact enough over a building and lets angles, lengths
 * and areas all mean what they say.
 */
function localFrame(reference: OutlinePoint) {
  const metresPerDegreeLongitude =
    METRES_PER_DEGREE_LATITUDE * Math.cos(toRadians(reference.latitude));

  return {
    metresPerDegreeLongitude,
    box: (bounds: OutlineBounds): LocalBox => ({
      minX: (bounds.west - reference.longitude) * metresPerDegreeLongitude,
      maxX: (bounds.east - reference.longitude) * metresPerDegreeLongitude,
      minY: (bounds.south - reference.latitude) * METRES_PER_DEGREE_LATITUDE,
      maxY: (bounds.north - reference.latitude) * METRES_PER_DEGREE_LATITUDE,
    }),
    toGeographic: (point: LocalPoint): OutlinePoint => ({
      latitude: reference.latitude + point.y / METRES_PER_DEGREE_LATITUDE,
      longitude: reference.longitude + point.x / metresPerDegreeLongitude,
    }),
  };
}

/**
 * How far the joined-up shape may sit from the area the planes were measured at.
 *
 * The shape is assembled from plane extents and the area is measured
 * independently, so the two agreeing is real corroboration. When they do not,
 * one of the reads is wrong and there is no telling which, so the plainer
 * answer wins.
 */
const FOOTPRINT_AREA_AGREEMENT = { min: 0.7, max: 1.3 } as const;

/**
 * The corners to open tracing on.
 *
 * Picked by where the pin is, not by which plane is biggest. Choosing the
 * largest looked reasonable and put the starting shape on the neighbour's roof:
 * the provider answers with the nearest *building*, a building is several
 * planes, and its largest plane can sit tens of metres from the pin. The plane
 * under the pin is the roof the person means, and when the pin falls between
 * planes the nearest one is the closest honest guess.
 *
 * Falls back to the building footprint, and to nothing when neither is there.
 */
export function outlineToCorners(
  outline: BuildingOutline | null,
  pin?: OutlinePoint | null,
) {
  // The provider answers with the *nearest* building, which in a dense row is
  // regularly not the one under the pin. Seeding from a neighbour's footprint
  // is worse than a plain square at the pin, because it looks deliberate.
  if (
    pin &&
    outline?.bounding_box &&
    !contains(padded(outline.bounding_box), pin)
  ) {
    return null;
  }

  const segments = outline?.segments ?? [];
  const chosen = pin
    ? (segments.find((segment) =>
        contains(padded(segment.bounding_box), pin),
      ) ??
      [...segments].sort(
        (a, b) =>
          distanceFromCentre(a.bounding_box, pin) -
          distanceFromCentre(b.bounding_box, pin),
      )[0])
    : segments[0];

  // Only the planes that join up with the chosen one. The rest belong to a
  // detached extension or to next door, and both the shape and the area below
  // are about this roof.
  const roofPlanes = chosen ? growThroughTouchingPlanes(chosen, segments) : [];
  const grown = boundsAround(roofPlanes);
  const bounds = grown
    ? clip(grown, outline?.bounding_box)
    : outline?.bounding_box;
  if (!bounds) {
    return null;
  }

  const reference = {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: (bounds.west + bounds.east) / 2,
  };
  const frame = localFrame(reference);
  if (frame.metresPerDegreeLongitude <= 0) {
    return null;
  }

  const planes: RoofPlane[] = roofPlanes.map((segment) => ({
    groundAreaSquareMeters: groundArea(segment),
    pitchDegrees: segment.pitch_degrees,
    azimuthDegrees: segment.azimuth_degrees,
    box: frame.box(segment.bounding_box),
  }));
  const measuredArea = planes.reduce(
    (total, plane) => total + plane.groundAreaSquareMeters,
    0,
  );

  const azimuthRotation = buildingRotationDegrees(planes);

  /*
   * The joined-up shape first, because a house is not always a rectangle.
   *
   * Laid at the angle the planes themselves report, and taken only when the
   * ground it covers agrees with what those planes were measured at. This runs
   * before the angle is reconsidered below on purpose: that reconsideration
   * asks which rectangle best explains the building, and asking it of a house
   * that is not one produces a confident answer to the wrong question.
   */
  if (azimuthRotation !== null) {
    const footprint = rectilinearFootprint(planes, azimuthRotation);
    if (footprint) {
      const ratio = polygonArea(footprint) / measuredArea;
      if (
        ratio >= FOOTPRINT_AREA_AGREEMENT.min &&
        ratio <= FOOTPRINT_AREA_AGREEMENT.max
      ) {
        return footprint.map(frame.toGeographic);
      }
    }
  }

  // A rectangle, then — so the angle is now the angle of the rectangle that
  // best explains this building, which the directions the planes face and the
  // shape of the box they sit in answer between them.
  const rotation = resolveRotationDegrees(
    frame.box(bounds),
    measuredArea,
    azimuthRotation,
  );
  const rectangle = orientedRectangle(
    frame.box(bounds),
    rotation,
    measuredArea,
  );
  if (rectangle) {
    return rectangle.map(frame.toGeographic);
  }

  return [
    { latitude: bounds.north, longitude: bounds.west },
    { latitude: bounds.north, longitude: bounds.east },
    { latitude: bounds.south, longitude: bounds.east },
    { latitude: bounds.south, longitude: bounds.west },
  ];
}
