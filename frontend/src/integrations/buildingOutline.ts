// Defines the building footprint used to seed a roof trace, served by our own
// backend.
//
// The provider behind it is the backend's business. This asks for "the roof
// under this point" and gets plain corners back.
import { apiGet } from "../shared/api/client";
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
 */
export async function fetchBuildingOutline(position: {
  latitude: number;
  longitude: number;
}): Promise<BuildingOutline | null> {
  const params = new URLSearchParams({
    latitude: String(position.latitude),
    longitude: String(position.longitude),
  });

  try {
    const payload = await apiGet<BuildingOutline>(
      `${ENDPOINTS.roofOutline}?${params.toString()}`,
    );

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
  } catch {
    return null;
  }
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

function padded(bounds: OutlineBounds): OutlineBounds {
  return {
    south: bounds.south - EDGE_TOLERANCE_DEGREES,
    west: bounds.west - EDGE_TOLERANCE_DEGREES,
    north: bounds.north + EDGE_TOLERANCE_DEGREES,
    east: bounds.east + EDGE_TOLERANCE_DEGREES,
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
): OutlineBounds {
  let bounds = start.bounding_box;
  const remaining = segments.filter((segment) => segment !== start);

  // Each pass can bring the union into contact with planes the previous pass
  // could not reach, so this repeats until a pass adds nothing.
  let joined = true;
  while (joined) {
    joined = false;
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index].bounding_box;
      if (overlaps(padded(bounds), candidate)) {
        bounds = union(bounds, candidate);
        remaining.splice(index, 1);
        joined = true;
      }
    }
  }

  return bounds;
}

const METRES_PER_DEGREE_LATITUDE = 111_320;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * How far the building is turned off the compass, in degrees.
 *
 * Each plane reports the direction it faces, and a plane faces square to the
 * wall below it, so the azimuths carry the building's angle. Only the angle
 * modulo 90 matters: a rectangle turned 90 degrees is the same rectangle.
 *
 * Averaged as directions rather than as numbers. Plain arithmetic on 1 degree
 * and 89 degrees gives 45, which is the one answer that is wrong in both
 * directions; folding to a quarter turn and averaging the vectors puts it at 0
 * where it belongs. Weighted by area so a large plane outvotes a dormer.
 */
function buildingRotationDegrees(segments: RoofSegmentOutline[]) {
  let east = 0;
  let north = 0;

  for (const segment of segments) {
    if (segment.azimuth_degrees === null) {
      continue;
    }

    // Scaled by four so a quarter turn spans a full circle, which is what
    // makes 89 degrees and 1 degree land next to each other.
    const angle = toRadians((segment.azimuth_degrees % 90) * 4);
    const weight = Math.max(segment.area_square_meters, 0);
    east += Math.sin(angle) * weight;
    north += Math.cos(angle) * weight;
  }

  if (east === 0 && north === 0) {
    return null;
  }

  const mean = (Math.atan2(east, north) * 180) / Math.PI / 4;
  return ((mean % 90) + 90) % 90;
}

/**
 * A rectangle turned to sit square with the building, inside the same box.
 *
 * The provider only ever describes a plane by an axis-aligned box around it,
 * so a house standing at 40 degrees to north arrives as a box that overshoots
 * on all four sides, and the starting shape covers as much garden as roof.
 *
 * The box is the shadow the turned rectangle casts on the axes, which is two
 * equations in the rectangle's own width and depth:
 *
 *   boxWidth  = width·|cos| + depth·|sin|
 *   boxHeight = width·|sin| + depth·|cos|
 *
 * Solved for width and depth, this recovers the rectangle. Near 45 degrees the
 * two equations say almost the same thing and the answer is noise, so that
 * band is left to the plain box rather than guessed at.
 */
function orientedCorners(bounds: OutlineBounds, rotationDegrees: number) {
  const centreLatitude = (bounds.south + bounds.north) / 2;
  const centreLongitude = (bounds.west + bounds.east) / 2;
  const metresPerDegreeLongitude =
    METRES_PER_DEGREE_LATITUDE * Math.cos(toRadians(centreLatitude));
  if (metresPerDegreeLongitude <= 0) {
    return null;
  }

  const boxWidth = (bounds.east - bounds.west) * metresPerDegreeLongitude;
  const boxHeight = (bounds.north - bounds.south) * METRES_PER_DEGREE_LATITUDE;

  const angle = toRadians(rotationDegrees);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const determinant = cos * cos - sin * sin;

  // Roughly 40 to 50 degrees, where the inversion stops being trustworthy.
  if (Math.abs(determinant) < 0.15) {
    return null;
  }

  const width = (boxWidth * cos - boxHeight * sin) / determinant;
  const depth = (boxHeight * cos - boxWidth * sin) / determinant;
  if (!(width > 0) || !(depth > 0)) {
    return null;
  }

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  // Walked in order, so the shape never opens as a bowtie.
  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, y]) => {
    const eastMetres = x * Math.cos(angle) + y * Math.sin(angle);
    const northMetres = -x * Math.sin(angle) + y * Math.cos(angle);

    return {
      latitude: centreLatitude + northMetres / METRES_PER_DEGREE_LATITUDE,
      longitude: centreLongitude + eastMetres / metresPerDegreeLongitude,
    };
  });
}

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

  const grown = chosen
    ? clip(growThroughTouchingPlanes(chosen, segments), outline?.bounding_box)
    : null;
  const bounds = grown ?? outline?.bounding_box;
  if (!bounds) {
    return null;
  }

  // Turned to match the building where its planes agree on an angle, square to
  // the compass where they do not.
  const rotation = buildingRotationDegrees(segments);
  const turned = rotation === null ? null : orientedCorners(bounds, rotation);
  if (turned) {
    return turned;
  }

  return [
    { latitude: bounds.north, longitude: bounds.west },
    { latitude: bounds.north, longitude: bounds.east },
    { latitude: bounds.south, longitude: bounds.east },
    { latitude: bounds.south, longitude: bounds.west },
  ];
}
