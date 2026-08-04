import type { RoofCoordinate, RoofPolygon } from "../../state/assessmentStore";

const EARTH_RADIUS_METERS = 6_371_000;
/**
 * The smallest roof this step will accept, in square metres.
 *
 * One panel's footprint, which is the same floor the solar domain applies when
 * it rejects a polygon as too small. The frontend must not be stricter: a roof
 * refused here that the backend would have assessed is a user blocked from an
 * answer the system could have given them.
 *
 * It was 100 m², which sounded cautious and was wrong. Real roof planes come
 * back from the imagery provider at 30 to 60 m², so that floor rejected most
 * actual houses, including the fitted outline this step now starts from.
 */
export const MIN_VALID_ROOF_AREA_SQUARE_METERS = 1.9888;

export type RoofMetrics = {
  areaSquareMeters: number;
  perimeterMeters: number;
};

export type RoofValidation = RoofMetrics & {
  isValid: boolean;
  message: string;
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function safeUuid() {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function haversineDistanceMeters(a: RoofCoordinate, b: RoofCoordinate) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = lat2 - lat1;
  const dLng = toRadians(b.longitude - a.longitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const square =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(square), Math.sqrt(1 - square));

  return EARTH_RADIUS_METERS * c;
}

/**
 * How far a corner may sit from the property pin, in metres.
 *
 * A roof is being traced, not a neighbourhood. 60 m still covers a large
 * compound with outbuildings, while catching the drag that has wandered onto
 * the next street — usually because someone grabbed a corner and flicked it
 * while meaning to pan the map.
 */
export const MAX_VERTEX_DISTANCE_METERS = 60;

/**
 * Whether any corner has been dragged away from the property being assessed.
 *
 * The pin is the one fixed point on this screen: it is what the previous step
 * confirmed. A corner beyond this radius is not a roof detail, it is a mistake,
 * and it would silently inflate the area the whole assessment is built on.
 */
export function hasVertexBeyondPin(
  coordinates: RoofCoordinate[],
  pin: RoofCoordinate | null | undefined,
  maxDistanceMeters: number = MAX_VERTEX_DISTANCE_METERS,
) {
  if (!pin) {
    return false;
  }

  return coordinates.some(
    (coordinate) =>
      haversineDistanceMeters(pin, coordinate) > maxDistanceMeters,
  );
}

/**
 * Whether the property pin stands inside the traced outline.
 *
 * Ray casting: count the edges directly left of the point, and an odd count
 * means it is enclosed. The `!=` on the two north tests is what stops a vertex
 * exactly level with the point being counted by both of its edges.
 *
 * The pin is what the previous step confirmed, so a trace that does not cover
 * it is a trace of some other roof, however carefully it was drawn.
 */
export function isPointInsidePolygon(
  coordinates: RoofCoordinate[],
  point: RoofCoordinate | null | undefined,
) {
  if (!point || coordinates.length < 3) {
    return false;
  }

  let inside = false;
  for (
    let current = 0, previous = coordinates.length - 1;
    current < coordinates.length;
    previous = current, current += 1
  ) {
    const a = coordinates[current];
    const b = coordinates[previous];

    const straddles =
      a.latitude > point.latitude !== b.latitude > point.latitude;
    if (!straddles) {
      continue;
    }

    const crossingLongitude =
      ((b.longitude - a.longitude) * (point.latitude - a.latitude)) /
        (b.latitude - a.latitude) +
      a.longitude;

    if (point.longitude < crossingLongitude) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Slides an outline over so it sits on the pin, keeping its size and angle.
 *
 * The fitted shape can be a good read of the roof and still miss the pin, on a
 * long building where the planes near the pin are small. Moving it is better
 * than discarding it: the shape and angle came from the imagery and are worth
 * keeping, and only its position was ever in doubt.
 */
export function centreOutlineOn(
  coordinates: RoofCoordinate[],
  point: RoofCoordinate,
): RoofCoordinate[] {
  if (!coordinates.length) {
    return coordinates;
  }

  const total = coordinates.reduce(
    (sum, coordinate) => ({
      latitude: sum.latitude + coordinate.latitude,
      longitude: sum.longitude + coordinate.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  const latitudeShift = point.latitude - total.latitude / coordinates.length;
  const longitudeShift = point.longitude - total.longitude / coordinates.length;

  return coordinates.map((coordinate) => ({
    latitude: coordinate.latitude + latitudeShift,
    longitude: coordinate.longitude + longitudeShift,
  }));
}

/**
 * Slides an outline the shortest distance that puts it over the pin.
 *
 * The centroid-on-pin move above turned out to cause the misalignment it was
 * meant to prevent: replayed against 98 captured provider payloads, it fired
 * on two thirds of fitted outlines and dragged shapes the imagery had placed
 * correctly by 8 to 37 metres, planting them over streets and neighbouring
 * roofs. The pin still has to end up covered — it is what the previous step
 * confirmed — but the shortest slide that covers it keeps the fit as close as
 * possible to where the imagery put it.
 *
 * The pin lands a metre inside the nearest edge rather than exactly on it, so
 * the containment check that prompted the slide does not fail again on a
 * boundary case; a smaller margin covers shapes too small to absorb a metre.
 * A shape that still cannot cover the pin falls back to the centroid move.
 */
export function slideOutlineToCover(
  coordinates: RoofCoordinate[],
  point: RoofCoordinate,
): RoofCoordinate[] {
  if (!coordinates.length || isPointInsidePolygon(coordinates, point)) {
    return coordinates;
  }

  const metresPerDegreeLatitude = EARTH_RADIUS_METERS * toRadians(1);
  const metresPerDegreeLongitude =
    metresPerDegreeLatitude * Math.cos(toRadians(point.latitude));
  const toLocal = (coordinate: RoofCoordinate) => ({
    x: coordinate.longitude * metresPerDegreeLongitude,
    y: coordinate.latitude * metresPerDegreeLatitude,
  });

  const pin = toLocal(point);
  const points = coordinates.map(toLocal);

  // The closest point to the pin anywhere on the outline's boundary.
  let nearest = points[0];
  let nearestDistance = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const alongX = b.x - a.x;
    const alongY = b.y - a.y;
    const lengthSquared = alongX * alongX + alongY * alongY;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((pin.x - a.x) * alongX + (pin.y - a.y) * alongY) / lengthSquared,
            ),
          );
    const candidate = { x: a.x + t * alongX, y: a.y + t * alongY };
    const distance = Math.hypot(pin.x - candidate.x, pin.y - candidate.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }

  if (nearestDistance > 0) {
    for (const marginMetres of [1, 0.25]) {
      const scale = (nearestDistance + marginMetres) / nearestDistance;
      const slid = coordinates.map((coordinate) => ({
        latitude:
          coordinate.latitude +
          ((pin.y - nearest.y) * scale) / metresPerDegreeLatitude,
        longitude:
          coordinate.longitude +
          ((pin.x - nearest.x) * scale) / metresPerDegreeLongitude,
      }));
      if (isPointInsidePolygon(slid, point)) {
        return slid;
      }
    }
  }

  return centreOutlineOn(coordinates, point);
}

function projectCoordinates(coordinates: RoofCoordinate[]) {
  if (!coordinates.length) {
    return [];
  }

  const avgLat =
    coordinates.reduce((sum, point) => sum + point.latitude, 0) /
    coordinates.length;
  const latFactor = Math.cos(toRadians(avgLat));

  return coordinates.map((point) => ({
    x: EARTH_RADIUS_METERS * toRadians(point.longitude) * latFactor,
    y: EARTH_RADIUS_METERS * toRadians(point.latitude),
  }));
}

export function calculateRoofMetrics(
  coordinates: RoofCoordinate[] | null | undefined,
): RoofMetrics {
  if (!coordinates || coordinates.length < 3) {
    return {
      areaSquareMeters: 0,
      perimeterMeters: 0,
    };
  }

  const perimeterMeters = coordinates.reduce((sum, point, index) => {
    const next = coordinates[(index + 1) % coordinates.length];
    return sum + haversineDistanceMeters(point, next);
  }, 0);

  const projected = projectCoordinates(coordinates);
  const signedArea = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);

  const areaSquareMeters = Math.abs(signedArea) / 2;

  return {
    areaSquareMeters,
    perimeterMeters,
  };
}

export function validateRoofPolygon(
  coordinates: RoofCoordinate[] | null | undefined,
): RoofValidation {
  if (!coordinates || coordinates.length < 3) {
    return {
      isValid: false,
      message: "Add at least 3 vertices to create a usable roof polygon.",
      areaSquareMeters: 0,
      perimeterMeters: 0,
    };
  }

  const metrics = calculateRoofMetrics(coordinates);

  if (isSelfIntersecting(coordinates)) {
    return {
      isValid: false,
      message:
        "The outline crosses itself. Drag the corner back so the edges do not overlap.",
      ...metrics,
    };
  }

  if (metrics.areaSquareMeters < MIN_VALID_ROOF_AREA_SQUARE_METERS) {
    return {
      isValid: false,
      message:
        "That outline is too small to fit a solar panel. Drag the corners out to cover the usable roof.",
      ...metrics,
    };
  }

  return {
    isValid: true,
    message: "Roof polygon is ready.",
    ...metrics,
  };
}

export function buildRoofPolygonModel({
  propertyId,
  coordinates,
}: {
  propertyId: string | null;
  coordinates: RoofCoordinate[];
}): RoofPolygon {
  const { areaSquareMeters, perimeterMeters } =
    calculateRoofMetrics(coordinates);

  return {
    id: safeUuid(),
    propertyId,
    coordinates,
    areaSquareMeters,
    perimeterMeters,
    createdAt: new Date().toISOString(),
  };
}

export function isValidRoofTrace(
  coordinates: RoofCoordinate[] | null | undefined,
) {
  return validateRoofPolygon(coordinates).isValid;
}

/**
 * The starting shape, so tracing begins with something to adjust.
 *
 * A blank map asks someone to produce a polygon from nothing, which is both
 * the hardest way to start and the easiest to get wrong. A square over the
 * property is wrong in a way that is obvious and quick to correct: drag four
 * corners onto the roof rather than invent them.
 *
 * Sized like a modest single-storey roof, so the fallback is in the right
 * neighbourhood when the imagery provider has no footprint to offer.
 */
export const DEFAULT_OUTLINE_SIDE_METERS = 12;

export function createDefaultRoofOutline(
  centre: RoofCoordinate,
  sideMeters: number = DEFAULT_OUTLINE_SIDE_METERS,
): RoofCoordinate[] {
  const half = sideMeters / 2;
  const latitudeDelta = (half / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const longitudeDelta =
    latitudeDelta / Math.max(Math.cos(toRadians(centre.latitude)), 1e-6);

  return [
    {
      latitude: centre.latitude + latitudeDelta,
      longitude: centre.longitude - longitudeDelta,
    },
    {
      latitude: centre.latitude + latitudeDelta,
      longitude: centre.longitude + longitudeDelta,
    },
    {
      latitude: centre.latitude - latitudeDelta,
      longitude: centre.longitude + longitudeDelta,
    },
    {
      latitude: centre.latitude - latitudeDelta,
      longitude: centre.longitude - longitudeDelta,
    },
  ];
}

/**
 * Whether an outline crosses itself.
 *
 * A bowtie has an area the shoelace formula will happily report, and it is
 * always wrong: the two lobes cancel, so a crossed shape reads smaller than
 * either half. The backend rejects these outright, so catching it here is the
 * difference between "that will not work" while the corner is still under the
 * pointer and a failure three steps later.
 *
 * Compared in projected metres rather than degrees, so a longitude near the
 * pole cannot make two edges look further apart than they are.
 */
function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
) {
  const cross = (
    o: { x: number; y: number },
    p: { x: number; y: number },
    q: { x: number; y: number },
  ) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);

  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);

  // Strict signs only: edges that share a corner touch there by definition,
  // and treating that as a crossing would reject every valid polygon.
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

export function isSelfIntersecting(
  coordinates: RoofCoordinate[] | null | undefined,
): boolean {
  if (!coordinates || coordinates.length < 4) {
    return false;
  }

  const points = projectCoordinates(coordinates);
  const count = points.length;

  for (let i = 0; i < count; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % count];

    for (let j = i + 1; j < count; j += 1) {
      // Skip edges that share a corner with this one, including the wrap-around
      // pair where the last edge meets the first.
      if (j === i || (j + 1) % count === i || (i + 1) % count === j) {
        continue;
      }

      if (segmentsIntersect(a1, a2, points[j], points[(j + 1) % count])) {
        return true;
      }
    }
  }

  return false;
}
