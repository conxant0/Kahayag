// Defines the geometry that turns a provider's boxes into the shape of a roof.
//
// Every box a mapping API reports is square to north, and buildings are not.
// This is where that gap is closed: work out which way the building is turned,
// recover the real rectangle each box is the shadow of, and join those
// rectangles into the outline of the building.
//
// Plain metres in, plain metres out. Nothing here knows about a provider, a
// map, or a coordinate system; `buildingOutline` does that conversion on the
// way in and back on the way out.

/** A point in the local frame: metres east and north of a reference point. */
export type LocalPoint = { x: number; y: number };

/** A box square to the compass, in local metres. */
export type LocalBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** One roof plane, as much as the geometry here needs to know about it. */
export type RoofPlane = {
  /** Metres of *ground* the plane stands over, not metres along its slope. */
  groundAreaSquareMeters: number;
  pitchDegrees: number | null;
  azimuthDegrees: number | null;
  box: LocalBox;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const width = (box: LocalBox) => box.maxX - box.minX;
const height = (box: LocalBox) => box.maxY - box.minY;
const centreOf = (box: LocalBox): LocalPoint => ({
  x: (box.minX + box.maxX) / 2,
  y: (box.minY + box.maxY) / 2,
});

/**
 * Below this pitch a plane's stated direction carries no information.
 *
 * A flat roof faces nowhere in particular and the provider still has to put a
 * number in the field, so what comes back is close to arbitrary. Letting those
 * planes vote turned buildings that their pitched planes had described
 * perfectly well, and spun flat-roofed buildings to a random angle.
 */
const MIN_PITCH_FOR_DIRECTION_DEGREES = 5;

/**
 * How much the planes have to agree before their angle is worth using.
 *
 * The length of the summed direction vector against the total weight: one when
 * every plane points the same way once folded to a quarter turn, zero when they
 * cancel out. A roof whose planes genuinely disagree is not a turned rectangle,
 * and forcing an average angle onto it is worse than leaving it square to
 * north, which at least is wrong in a way that reads as a default.
 */
const MIN_DIRECTION_AGREEMENT = 0.5;

/**
 * How far the building is turned off the compass, in degrees, or null.
 *
 * Each plane reports the direction it faces, and a plane faces square to the
 * wall below it, so the azimuths carry the building's angle. Only the angle
 * modulo 90 matters: a rectangle turned 90 degrees is the same rectangle.
 *
 * Averaged as directions rather than as numbers. Plain arithmetic on 1 degree
 * and 89 degrees gives 45, which is the one answer that is wrong in both
 * directions; folding to a quarter turn and averaging the vectors puts it at 0
 * where it belongs. Weighted by ground area so a large plane outvotes a dormer.
 */
export function buildingRotationDegrees(planes: RoofPlane[]): number | null {
  let east = 0;
  let north = 0;
  let total = 0;

  for (const plane of planes) {
    if (plane.azimuthDegrees === null) {
      continue;
    }

    if (
      plane.pitchDegrees !== null &&
      plane.pitchDegrees < MIN_PITCH_FOR_DIRECTION_DEGREES
    ) {
      continue;
    }

    // Scaled by four so a quarter turn spans a full circle, which is what
    // makes 89 degrees and 1 degree land next to each other.
    const angle = toRadians((plane.azimuthDegrees % 90) * 4);
    const weight = Math.max(plane.groundAreaSquareMeters, 0);
    east += Math.sin(angle) * weight;
    north += Math.cos(angle) * weight;
    total += weight;
  }

  if (total <= 0) {
    return null;
  }

  if (Math.hypot(east, north) / total < MIN_DIRECTION_AGREEMENT) {
    return null;
  }

  const mean = (Math.atan2(east, north) * 180) / Math.PI / 4;
  return ((mean % 90) + 90) % 90;
}

/**
 * Where the two shadow equations stop being independent enough to invert.
 *
 * Roughly 40 to 50 degrees. There they say almost the same thing, and any
 * imprecision in the box comes back multiplied.
 */
const NEAR_45_DETERMINANT = 0.15;

type Sides = { along: number; across: number };

/**
 * The rectangle a box is the shadow of, from the box alone.
 *
 * A turned rectangle casts an axis-aligned box, and the box's sides are two
 * equations in the rectangle's own:
 *
 *   boxWidth  = along·|cos| + across·|sin|
 *   boxHeight = along·|sin| + across·|cos|
 *
 * Solved as a pair. Returns null in the band where the pair is degenerate.
 */
function sidesFromShadow(
  box: LocalBox,
  cos: number,
  sin: number,
): Sides | null {
  const determinant = cos * cos - sin * sin;
  if (Math.abs(determinant) < NEAR_45_DETERMINANT) {
    return null;
  }

  const boxWidth = width(box);
  const boxHeight = height(box);
  const along = (boxWidth * cos - boxHeight * sin) / determinant;
  const across = (boxHeight * cos - boxWidth * sin) / determinant;

  if (!(along > 0) || !(across > 0)) {
    return null;
  }

  return { along, across };
}

/**
 * The same rectangle, recovered from the box and the roof's measured area.
 *
 * *Adding* the two shadow equations gives `along + across`, and that sum never
 * degenerates: it divides by `|cos| + |sin|`, which stays between 1 and √2 at
 * every angle. The provider's own ground-area figure supplies the product, and
 * a sum with a product is a quadratic.
 *
 * So the band the pair of equations cannot answer is exactly the band this one
 * handles best. Only which side is the long one still comes from the difference
 * of the equations, and a sign survives conditioning that a value does not.
 */
function sidesFromArea(
  box: LocalBox,
  cos: number,
  sin: number,
  groundAreaSquareMeters: number,
): Sides | null {
  if (!(groundAreaSquareMeters > 0)) {
    return null;
  }

  const boxWidth = width(box);
  const boxHeight = height(box);
  const sum = (boxWidth + boxHeight) / (cos + sin);

  // Negative means no rectangle of that area fits in a box that size, so the
  // two measurements are describing different things and neither is trusted.
  const discriminant = sum * sum - 4 * groundAreaSquareMeters;
  if (discriminant < 0) {
    return null;
  }

  const spread = Math.sqrt(discriminant);
  const longer = (sum + spread) / 2;
  const shorter = (sum - spread) / 2;
  if (!(shorter > 0)) {
    return null;
  }

  const alongIsLonger = (boxWidth - boxHeight) * (cos - sin) >= 0;
  return alongIsLonger
    ? { along: longer, across: shorter }
    : { along: shorter, across: longer };
}

/**
 * The angles at which a rectangle of the measured area fits the box exactly.
 *
 * The azimuths are one witness to how a building is turned, and on a quarter of
 * real roofs they are no witness at all: a complex roof's planes scatter and a
 * flat one faces nowhere, so the fit fell back to square with the compass over
 * houses that plainly were not. The box and the measured area are a second,
 * wholly independent witness, and they pin the angle down on their own.
 *
 * Three facts about the rectangle, writing `k` for `sin(2θ)/2`:
 *
 *   W = w·c + d·s      H = w·s + d·c      A = w·d
 *
 * Multiply the first two together, and add their squares. Both come out in
 * terms of `w² + d²` and `k` alone:
 *
 *   W·H     = k(w² + d²) + A
 *   W² + H² = (w² + d²) + 4Ak
 *
 * Eliminating `w² + d²` leaves a quadratic in `k` and nothing else:
 *
 *   4A·k² − (W² + H²)·k + (W·H − A) = 0
 *
 * So the angle is a root, with no azimuth anywhere in it. A root is thrown out
 * when the `w² + d²` it implies falls below `2A`, which no real rectangle can
 * do, and that is what disposes of the spurious second root.
 *
 * Both `θ` and `90° − θ` satisfy it — a rectangle turned left and the same one
 * turned right cast the same shadow — and that is the one thing this cannot
 * settle. The azimuths settle it, which is what they are for.
 */
function consistentRotations(box: LocalBox, groundAreaSquareMeters: number) {
  const boxWidth = width(box);
  const boxHeight = height(box);
  if (!(groundAreaSquareMeters > 0) || !(boxWidth > 0) || !(boxHeight > 0)) {
    return [];
  }

  const sumOfSquares = boxWidth * boxWidth + boxHeight * boxHeight;
  const product = boxWidth * boxHeight;
  const discriminant =
    sumOfSquares * sumOfSquares -
    16 * groundAreaSquareMeters * (product - groundAreaSquareMeters);

  // No angle fits a rectangle of that area into a box that shape, which is how
  // a building that is not a rectangle announces itself.
  if (discriminant < 0) {
    return [];
  }

  const spread = Math.sqrt(discriminant);
  const rotations: number[] = [];

  for (const k of [
    (sumOfSquares - spread) / (8 * groundAreaSquareMeters),
    (sumOfSquares + spread) / (8 * groundAreaSquareMeters),
  ]) {
    // `k` is half a sine, so anything outside this range is not an angle.
    if (!(k >= 0) || k > 0.5) {
      continue;
    }

    const squares =
      k < 1e-9 ? sumOfSquares : (product - groundAreaSquareMeters) / k;
    if (squares < 2 * groundAreaSquareMeters - 1e-6) {
      continue;
    }

    const turn = (Math.asin(Math.min(1, 2 * k)) / 2) * (180 / Math.PI);
    rotations.push(turn, 90 - turn);
  }

  return rotations;
}

/** Separation between two angles that only mean anything modulo a quarter turn. */
function angularDistance(a: number, b: number) {
  const gap = Math.abs(a - b) % 90;
  return Math.min(gap, 90 - gap);
}

/**
 * How badly a rotation explains the box and the area it is meant to.
 *
 * Zero when the rectangle it implies casts exactly this box and covers exactly
 * the measured ground. Both terms are relative, so neither a large building nor
 * a small one dominates the comparison.
 */
function misfit(
  box: LocalBox,
  rotationDegrees: number,
  groundAreaSquareMeters: number,
) {
  const angle = toRadians(rotationDegrees);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  const sides =
    sidesFromShadow(box, cos, sin) ??
    sidesFromArea(box, cos, sin, groundAreaSquareMeters);
  if (!sides) {
    return null;
  }

  const boxWidth = width(box);
  const boxHeight = height(box);
  const castWidth = sides.along * cos + sides.across * sin;
  const castHeight = sides.along * sin + sides.across * cos;
  const shapeError =
    (Math.abs(castWidth - boxWidth) + Math.abs(castHeight - boxHeight)) /
    (boxWidth + boxHeight);

  const areaError =
    groundAreaSquareMeters > 0
      ? Math.abs(sides.along * sides.across - groundAreaSquareMeters) /
        groundAreaSquareMeters
      : 0;

  return shapeError + areaError;
}

/**
 * How far a rotation may be preferred purely for agreeing with the azimuths.
 *
 * The two witnesses answer different halves of the question, so this is a
 * tie-break rather than a contest: geometry cannot tell a building turned left
 * from the same one turned right, and the azimuths can. They are overridden
 * only when they are demonstrably describing a different building than the box.
 */
const AZIMUTH_TIE_BREAK = 0.05;

/**
 * The angle to lay the starting shape at.
 *
 * Every angle either witness puts forward, scored on how well it explains the
 * box and the measured area, with the azimuths breaking the tie only they can
 * break.
 */
export function resolveRotationDegrees(
  box: LocalBox,
  groundAreaSquareMeters: number,
  azimuthRotation: number | null,
): number {
  const candidates = [
    ...(azimuthRotation === null ? [] : [azimuthRotation]),
    ...consistentRotations(box, groundAreaSquareMeters),
  ];

  let best = azimuthRotation ?? 0;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const error = misfit(box, candidate, groundAreaSquareMeters);
    if (error === null) {
      continue;
    }

    const disagreement =
      azimuthRotation === null
        ? 0
        : (angularDistance(candidate, azimuthRotation) / 45) *
          AZIMUTH_TIE_BREAK;

    if (error + disagreement < bestScore) {
      bestScore = error + disagreement;
      best = candidate;
    }
  }

  return best;
}

/**
 * How far the measured area may pull the recovered rectangle.
 *
 * The box is an outer bound on the building, so a rectangle larger than the box
 * implies is never right and the ceiling sits at 1. The floor is what an
 * L-shaped house needs: two equal wings fill three quarters of their box, which
 * is a scale of 0.87, and a cross-shaped one five ninths, which is 0.75. Below
 * 0.55 the box and the area are no longer describing the same building, and the
 * honest move is to leave the geometry alone rather than shrink to fit.
 */
const MIN_AREA_SCALE = 0.55;
const MAX_AREA_SCALE = 1.05;

/**
 * Shrinks the rectangle until it covers the area the provider actually measured.
 *
 * The box grows with every plane joined into it and with eaves and overhang
 * noise besides, so the rectangle recovered from it runs large. The ground area
 * is a direct measurement of how much roof is really there, and it is the
 * number the assessment downstream is built on, so the seed had better start at
 * it rather than a third above it.
 */
function scaledToArea(sides: Sides, groundAreaSquareMeters: number): Sides {
  if (!(groundAreaSquareMeters > 0)) {
    return sides;
  }

  const scale = Math.sqrt(
    groundAreaSquareMeters / (sides.along * sides.across),
  );
  if (scale < MIN_AREA_SCALE || scale > MAX_AREA_SCALE) {
    return sides;
  }

  const capped = Math.min(scale, 1);
  return { along: sides.along * capped, across: sides.across * capped };
}

/** Turns a point from the building's own frame back onto the compass. */
function toWorld(point: LocalPoint, angle: number): LocalPoint {
  return {
    x: point.x * Math.cos(angle) + point.y * Math.sin(angle),
    y: -point.x * Math.sin(angle) + point.y * Math.cos(angle),
  };
}

/** Turns a point off the compass and into the building's own frame. */
function toBuilding(point: LocalPoint, angle: number): LocalPoint {
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  };
}

/**
 * A rectangle turned to sit square with the building, sized to the roof.
 *
 * Tries the box on its own first, because that answer needs nothing but
 * geometry. Near 45 degrees, where it has none to give, the measured area
 * closes the system instead. Either way the result is then pulled back to the
 * area actually measured.
 */
export function orientedRectangle(
  box: LocalBox,
  rotationDegrees: number,
  groundAreaSquareMeters: number,
): LocalPoint[] | null {
  const angle = toRadians(rotationDegrees);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  const solved =
    sidesFromShadow(box, cos, sin) ??
    sidesFromArea(box, cos, sin, groundAreaSquareMeters);
  if (!solved) {
    return null;
  }

  const sides = scaledToArea(solved, groundAreaSquareMeters);
  const centre = centreOf(box);
  const halfAlong = sides.along / 2;
  const halfAcross = sides.across / 2;

  // Walked in order, so the shape never opens as a bowtie.
  return [
    { x: -halfAlong, y: -halfAcross },
    { x: halfAlong, y: -halfAcross },
    { x: halfAlong, y: halfAcross },
    { x: -halfAlong, y: halfAcross },
  ].map((corner) => {
    const turned = toWorld(corner, angle);
    return { x: centre.x + turned.x, y: centre.y + turned.y };
  });
}

/** Shoelace area, unsigned. */
export function polygonArea(points: LocalPoint[]): number {
  if (points.length < 3) {
    return 0;
  }

  const twice = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0);

  return Math.abs(twice) / 2;
}

/**
 * The smallest step in the outline worth drawing, in metres.
 *
 * Planes of one roof rarely line up to the centimetre, so their recovered
 * rectangles end a few centimetres apart and a plain union grows a staircase of
 * slivers along every join. Edges closer together than this are one edge.
 */
const MIN_FEATURE_METERS = 1.5;

/**
 * Past this many corners the outline is describing noise, not a building.
 *
 * It is also as many as anyone will drag: every corner here is a handle, and a
 * shape with twenty of them is harder to correct than a rectangle that is
 * plainly too big.
 */
const MAX_FOOTPRINT_VERTICES = 12;

/**
 * Groups values that sit within a feature-size of each other onto one line.
 *
 * Grouped against the value that opened the group rather than the last one
 * added, so a run of near-misses cannot walk a group across the building.
 */
function snappedLines(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];

  for (const value of sorted) {
    const current = groups[groups.length - 1];
    if (current && value - current[0] < MIN_FEATURE_METERS) {
      current.push(value);
    } else {
      groups.push([value]);
    }
  }

  return groups.map(
    (group) => group.reduce((total, value) => total + value, 0) / group.length,
  );
}

function nearestLine(value: number, lines: number[]) {
  let best = 0;
  for (let index = 1; index < lines.length; index += 1) {
    if (Math.abs(lines[index] - value) < Math.abs(lines[best] - value)) {
      best = index;
    }
  }
  return best;
}

type GridEdge = { from: [number, number]; to: [number, number] };

const cornerKey = ([column, row]: [number, number]) => `${column},${row}`;

/**
 * Walks the boundary of the covered cells as a single closed ring.
 *
 * Every covered cell contributes the sides that face an uncovered neighbour,
 * directed so the covered side is always on the left. Those sides chain
 * head-to-tail into loops, and the loop enclosing the most ground is the
 * building's outer wall; anything else is a courtyard, which a roof trace has
 * no way to express and no need to.
 */
function traceOuterRing(
  columns: number,
  rows: number,
  covered: boolean[][],
  xs: number[],
  ys: number[],
): LocalPoint[] | null {
  const isCovered = (column: number, row: number) =>
    column >= 0 &&
    column < columns &&
    row >= 0 &&
    row < rows &&
    covered[column][row];

  const edges: GridEdge[] = [];
  const outgoing = new Map<string, GridEdge[]>();

  const add = (from: [number, number], to: [number, number]) => {
    const edge: GridEdge = { from, to };
    edges.push(edge);
    const key = cornerKey(from);
    const existing = outgoing.get(key);
    if (existing) {
      existing.push(edge);
    } else {
      outgoing.set(key, [edge]);
    }
  };

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      if (!isCovered(column, row)) {
        continue;
      }

      if (!isCovered(column, row - 1)) {
        add([column, row], [column + 1, row]);
      }
      if (!isCovered(column + 1, row)) {
        add([column + 1, row], [column + 1, row + 1]);
      }
      if (!isCovered(column, row + 1)) {
        add([column + 1, row + 1], [column, row + 1]);
      }
      if (!isCovered(column - 1, row)) {
        add([column, row + 1], [column, row]);
      }
    }
  }

  const used = new Set<GridEdge>();

  /**
   * Where two parts of the outline meet at a single corner, four sides share
   * that corner and two of them lead onward. Turning as sharply right as the
   * available sides allow keeps the walk hugging the same region, which is what
   * makes each loop come out as a simple ring rather than a figure of eight.
   */
  const nextEdge = (edge: GridEdge): GridEdge | null => {
    const candidates = (outgoing.get(cornerKey(edge.to)) ?? []).filter(
      (candidate) => !used.has(candidate),
    );
    if (candidates.length === 0) {
      return null;
    }

    const incoming = [
      edge.to[0] - edge.from[0],
      edge.to[1] - edge.from[1],
    ] as const;

    const rank = (candidate: GridEdge) => {
      const heading = [
        candidate.to[0] - candidate.from[0],
        candidate.to[1] - candidate.from[1],
      ] as const;
      const cross = incoming[0] * heading[1] - incoming[1] * heading[0];
      const dot = incoming[0] * heading[0] + incoming[1] * heading[1];

      if (cross < 0) return 0; // right
      if (dot > 0) return 1; // straight on
      if (cross > 0) return 2; // left
      return 3; // back the way it came
    };

    return candidates.reduce((best, candidate) =>
      rank(candidate) < rank(best) ? candidate : best,
    );
  };

  let ring: LocalPoint[] | null = null;
  let ringArea = 0;

  for (const start of edges) {
    if (used.has(start)) {
      continue;
    }

    const loop: LocalPoint[] = [];
    let edge: GridEdge | null = start;
    while (edge && !used.has(edge)) {
      used.add(edge);
      loop.push({ x: xs[edge.from[0]], y: ys[edge.from[1]] });
      edge = nextEdge(edge);
    }

    const area = polygonArea(loop);
    if (loop.length >= 4 && area > ringArea) {
      ring = loop;
      ringArea = area;
    }
  }

  return ring;
}

/** Drops corners that only continue a straight edge. */
function withoutCollinear(points: LocalPoint[]): LocalPoint[] {
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const cross =
      (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x);

    return Math.abs(cross) > 1e-6;
  });
}

/**
 * The building's outline, in the shape the planes actually make.
 *
 * A single rectangle is only ever right for a building that is one. Houses are
 * regularly L-shaped or T-shaped, and for those the rectangle the whole box
 * yields covers a good deal of ground that is not roof, whichever way it is
 * turned.
 *
 * Each plane is recovered as its own rectangle in the building's frame, where
 * they all stand square to the same axes, and their union is the footprint.
 * That union is rectilinear by construction, which is what a house tends to be.
 *
 * Returns null when the planes give nothing better than a rectangle would:
 * near 45 degrees, where the per-plane recovery is noise, and whenever the
 * union comes back as a plain quadrilateral or as more corners than a building
 * has.
 */
export function rectilinearFootprint(
  planes: RoofPlane[],
  rotationDegrees: number,
): LocalPoint[] | null {
  if (planes.length < 2) {
    return null;
  }

  const angle = toRadians(rotationDegrees);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  const rectangles: LocalBox[] = [];
  for (const plane of planes) {
    // Deliberately the box on its own, with no pull towards the plane's area:
    // a hip end is a triangle covering half the rectangle it stands in, and
    // sizing it by area would shrink it out of the wing it belongs to.
    const sides = sidesFromShadow(plane.box, cos, sin);
    if (!sides) {
      return null;
    }

    const centre = toBuilding(centreOf(plane.box), angle);
    rectangles.push({
      minX: centre.x - sides.along / 2,
      maxX: centre.x + sides.along / 2,
      minY: centre.y - sides.across / 2,
      maxY: centre.y + sides.across / 2,
    });
  }

  const xs = snappedLines(
    rectangles.flatMap((rectangle) => [rectangle.minX, rectangle.maxX]),
  );
  const ys = snappedLines(
    rectangles.flatMap((rectangle) => [rectangle.minY, rectangle.maxY]),
  );

  const columns = xs.length - 1;
  const rows = ys.length - 1;
  if (columns < 1 || rows < 1) {
    return null;
  }

  const covered: boolean[][] = Array.from({ length: columns }, () =>
    new Array<boolean>(rows).fill(false),
  );

  for (const rectangle of rectangles) {
    const left = nearestLine(rectangle.minX, xs);
    const right = nearestLine(rectangle.maxX, xs);
    const bottom = nearestLine(rectangle.minY, ys);
    const top = nearestLine(rectangle.maxY, ys);

    // A plane whose sides snapped onto one line is thinner than a feature and
    // cannot move the outline by more than a sliver, so it is left out rather
    // than rounded up into ground it does not cover.
    for (let column = left; column < right; column += 1) {
      for (let row = bottom; row < top; row += 1) {
        covered[column][row] = true;
      }
    }
  }

  const ring = traceOuterRing(columns, rows, covered, xs, ys);
  if (!ring) {
    return null;
  }

  const outline = withoutCollinear(ring);
  if (outline.length <= 4 || outline.length > MAX_FOOTPRINT_VERTICES) {
    return null;
  }

  return outline.map((point) => toWorld(point, angle));
}
