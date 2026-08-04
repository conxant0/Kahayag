// Places panel rectangles inside a georeferenced roof polygon, rotated to
// follow the roof's longest edge orientation.
import {
  averageFluxAtCoordinates,
  createFluxSampler,
} from "../../integrations/solar/fluxSampler";
import type { GeoTiffRaster } from "../../integrations/solar/geoTiffLoader";
import type { GeoPoint } from "../../shared/api/types";

const EARTH_RADIUS_METERS = 6_371_000;

interface Point2D {
  x: number;
  y: number;
}

type PanelCorners = [Point2D, Point2D, Point2D, Point2D];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function averageLatitude(coordinates: readonly GeoPoint[]): number {
  return (
    coordinates.reduce((sum, point) => sum + point.latitude, 0) /
    coordinates.length
  );
}

function projectPoint(coordinate: GeoPoint, avgLat: number): Point2D {
  const latFactor = Math.cos(toRadians(avgLat));
  return {
    x: EARTH_RADIUS_METERS * toRadians(coordinate.longitude) * latFactor,
    y: EARTH_RADIUS_METERS * toRadians(coordinate.latitude),
  };
}

function unprojectPoint(point: Point2D, avgLat: number): GeoPoint {
  const latFactor = Math.cos(toRadians(avgLat));
  return {
    latitude: (point.y / EARTH_RADIUS_METERS) * (180 / Math.PI),
    longitude: (point.x / (EARTH_RADIUS_METERS * latFactor)) * (180 / Math.PI),
  };
}

function isPointInPolygon(
  point: Point2D,
  polygon: readonly Point2D[],
): boolean {
  let inside = false;

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function rotatePoint(point: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function rotatePointAround(
  origin: Point2D,
  point: Point2D,
  angle: number,
): Point2D {
  const translated = { x: point.x - origin.x, y: point.y - origin.y };
  const rotated = rotatePoint(translated, angle);
  return { x: rotated.x + origin.x, y: rotated.y + origin.y };
}

function panelCorners(
  x: number,
  y: number,
  panelWidthM: number,
  panelHeightM: number,
): PanelCorners {
  return [
    { x, y },
    { x: x + panelWidthM, y },
    { x: x + panelWidthM, y: y + panelHeightM },
    { x, y: y + panelHeightM },
  ];
}

function isPanelInsidePolygon(
  corners: PanelCorners,
  polygon: readonly Point2D[],
): boolean {
  return corners.every((corner) => isPointInPolygon(corner, polygon));
}

function polygonVertexAverage(polygon: readonly Point2D[]): Point2D {
  return {
    x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
    y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
  };
}

function layoutSeed(polygon: readonly Point2D[]): Point2D {
  const vertexAverage = polygonVertexAverage(polygon);
  if (isPointInPolygon(vertexAverage, polygon)) {
    return vertexAverage;
  }

  return vertexAverage;
}

function distanceSquared(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function centeredGridStarts({
  min,
  max,
  step,
  panelSpan,
}: {
  min: number;
  max: number;
  step: number;
  panelSpan: number;
}): number[] {
  if (max - min < panelSpan) {
    return [];
  }

  const slots = Math.floor((max - min + step - panelSpan) / step);
  if (slots <= 0) {
    return [min];
  }

  const occupiedSpan = panelSpan + (slots - 1) * step;
  const inset = (max - min - occupiedSpan) / 2;
  const starts: number[] = [];

  for (let index = 0; index < slots; index += 1) {
    starts.push(min + inset + index * step);
  }

  return starts;
}

/** Uses the longest roof edge to infer the primary roof bearing. */
export function primaryRoofAngleRadians(polygon: readonly Point2D[]): number {
  let longestLength = 0;
  let angle = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length;
    const dx = polygon[next]!.x - polygon[index]!.x;
    const dy = polygon[next]!.y - polygon[index]!.y;
    const length = Math.hypot(dx, dy);

    if (length > longestLength) {
      longestLength = length;
      angle = Math.atan2(dy, dx);
    }
  }

  return angle;
}

interface PanelCandidate {
  corners: PanelCorners;
  center: Point2D;
}

function layoutAxisAlignedPanels({
  polygon,
  panelCount,
  panelWidthM,
  panelHeightM,
  gapM,
  scorePanel,
}: {
  polygon: readonly Point2D[];
  panelCount: number;
  panelWidthM: number;
  panelHeightM: number;
  gapM: number;
  scorePanel?: (panel: PanelCandidate) => number;
}): PanelCandidate[] {
  const minX = Math.min(...polygon.map((point) => point.x));
  const maxX = Math.max(...polygon.map((point) => point.x));
  const minY = Math.min(...polygon.map((point) => point.y));
  const maxY = Math.max(...polygon.map((point) => point.y));

  const stepX = panelWidthM + gapM;
  const stepY = panelHeightM + gapM;
  const seed = layoutSeed(polygon);
  const xStarts = centeredGridStarts({
    min: minX,
    max: maxX,
    step: stepX,
    panelSpan: panelWidthM,
  });
  const yStarts = centeredGridStarts({
    min: minY,
    max: maxY,
    step: stepY,
    panelSpan: panelHeightM,
  });

  const candidates: PanelCandidate[] = [];

  for (const y of yStarts) {
    for (const x of xStarts) {
      const corners = panelCorners(x, y, panelWidthM, panelHeightM);
      if (!isPanelInsidePolygon(corners, polygon)) {
        continue;
      }

      candidates.push({
        corners,
        center: {
          x: x + panelWidthM / 2,
          y: y + panelHeightM / 2,
        },
      });
    }
  }

  candidates.sort((left, right) => {
    if (scorePanel) {
      const scoreDifference = scorePanel(right) - scorePanel(left);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
    }
    return (
      distanceSquared(left.center, seed) - distanceSquared(right.center, seed)
    );
  });

  return candidates.slice(0, panelCount);
}

export interface LayoutPanel {
  corners: [GeoPoint, GeoPoint, GeoPoint, GeoPoint];
}

function buildFluxScorePanel({
  averageLatitude: avgLat,
  flux,
  roofAngle,
  seed,
}: {
  averageLatitude: number;
  flux: GeoTiffRaster;
  roofAngle: number;
  seed: Point2D;
}): (panel: PanelCandidate) => number {
  const sample = createFluxSampler(flux);
  return (panel) =>
    averageFluxAtCoordinates(
      panel.corners.map((corner) =>
        unprojectPoint(rotatePointAround(seed, corner, roofAngle), avgLat),
      ),
      sample,
    );
}

export function layoutPanelsInPolygon({
  coordinates,
  panelCount,
  panelWidthM = 1.13,
  panelHeightM = 1.76,
  gapM = 0.08,
  flux,
}: {
  coordinates: readonly GeoPoint[];
  panelCount: number;
  panelWidthM?: number;
  panelHeightM?: number;
  gapM?: number;
  flux?: GeoTiffRaster;
}): LayoutPanel[] {
  if (!coordinates?.length || panelCount <= 0) {
    return [];
  }

  const avgLat = averageLatitude(coordinates);
  const projected = coordinates.map((coordinate) =>
    projectPoint(coordinate, avgLat),
  );
  const seed = layoutSeed(projected);
  const roofAngle = primaryRoofAngleRadians(projected);
  const alignedPolygon = projected.map((point) =>
    rotatePointAround(seed, point, -roofAngle),
  );

  // Tried in both directions, independently per call: the panel's physical
  // dimensions never change, but whichever orientation packs more of the
  // requested count into this roof shape is the one kept. Re-run at a
  // different panelCount or a different polygon and the winner can flip —
  // that's the packer re-optimizing, not a size change. This trade-off isn't
  // specified anywhere outside this file; it's an implementation choice
  // preserved from the original packer, not a documented product decision.
  const orientations = [
    { panelWidthM, panelHeightM },
    { panelWidthM: panelHeightM, panelHeightM: panelWidthM },
  ];
  const scorePanel = flux
    ? buildFluxScorePanel({ averageLatitude: avgLat, flux, roofAngle, seed })
    : undefined;

  let bestPanels: PanelCandidate[] = [];

  for (const orientation of orientations) {
    const alignedPanels = layoutAxisAlignedPanels({
      polygon: alignedPolygon,
      panelCount,
      panelWidthM: orientation.panelWidthM,
      panelHeightM: orientation.panelHeightM,
      gapM,
      scorePanel,
    });

    if (alignedPanels.length > bestPanels.length) {
      bestPanels = alignedPanels;
    }
  }

  return bestPanels.map((panel) => {
    const unprojected = panel.corners.map((corner) =>
      unprojectPoint(rotatePointAround(seed, corner, roofAngle), avgLat),
    ) as [GeoPoint, GeoPoint, GeoPoint, GeoPoint];
    return { corners: unprojected };
  });
}
