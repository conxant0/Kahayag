import type { GeoPoint } from "../../../shared/api/types";
import { MapSurface } from "../../../shared/components/ui";
import type { GeoTiffRaster } from "../../../integrations/solar/geoTiffLoader";
import { renderSolarFluxOverlay } from "../../../integrations/solar/fluxRenderer";
import type { LayoutPanel } from "../panelLayoutUtils";

function allPoints(
  roofCoordinates: readonly GeoPoint[],
  panels: readonly LayoutPanel[],
) {
  return [...roofCoordinates, ...panels.flatMap((panel) => panel.corners)];
}

function pointsForSvg(
  points: readonly GeoPoint[],
  latitude: number,
  longitude: number,
  width: number,
  height: number,
): string {
  return points
    .map((point) => {
      const x = ((point.longitude - longitude) / width) * 100;
      const y = ((latitude - point.latitude) / height) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function projectPoint(
  point: GeoPoint,
  latitude: number,
  longitude: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: ((point.longitude - longitude) / width) * 100,
    y: ((latitude - point.latitude) / height) * 100,
  };
}

// Bilinear interpolation across the panel's 4 projected corners, which are
// an arbitrary (rotated) quadrilateral rather than an axis-aligned rect.
// corners are ordered [top-left, top-right, bottom-right, bottom-left].
function lerpQuad(
  corners: readonly { x: number; y: number }[],
  u: number,
  v: number,
): { x: number; y: number } {
  const [p00, p10, p11, p01] = corners;
  const x =
    (1 - u) * (1 - v) * p00.x +
    u * (1 - v) * p10.x +
    u * v * p11.x +
    (1 - u) * v * p01.x;
  const y =
    (1 - u) * (1 - v) * p00.y +
    u * (1 - v) * p10.y +
    u * v * p11.y +
    (1 - u) * v * p01.y;
  return { x, y };
}

// A few interior lines suggesting photovoltaic cells: 2 columns, 3 rows.
function cellGridLines(corners: readonly { x: number; y: number }[]) {
  const columnSplits = [1 / 2];
  const rowSplits = [1 / 3, 2 / 3];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const u of columnSplits) {
    const a = lerpQuad(corners, u, 0);
    const b = lerpQuad(corners, u, 1);
    lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  for (const v of rowSplits) {
    const a = lerpQuad(corners, 0, v);
    const b = lerpQuad(corners, 1, v);
    lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  return lines;
}

export function PanelLayoutPreview({
  roofCoordinates,
  panels,
  status,
  flux = null,
  mask = null,
  unframed = false,
}: {
  roofCoordinates: readonly GeoPoint[];
  panels: readonly LayoutPanel[];
  status?: string;
  flux?: GeoTiffRaster | null;
  mask?: GeoTiffRaster | null;
  unframed?: boolean;
}) {
  const points = allPoints(roofCoordinates, panels);
  if (!points.length) {
    const empty = (
      <div className="flex size-full min-h-56 items-center justify-center px-6 text-center font-sans text-sm text-secondary">
        Roof layout preview unavailable until the roof is traced.
      </div>
    );
    return unframed ? empty : <MapSurface>{empty}</MapSurface>;
  }

  const minLatitude = Math.min(...points.map((point) => point.latitude));
  const maxLatitude = Math.max(...points.map((point) => point.latitude));
  const minLongitude = Math.min(...points.map((point) => point.longitude));
  const maxLongitude = Math.max(...points.map((point) => point.longitude));
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.00001);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.00001);
  const latitudePadding = latitudeSpan * 0.08;
  const longitudePadding = longitudeSpan * 0.08;
  const viewMinLatitude = minLatitude - latitudePadding;
  const viewMaxLatitude = maxLatitude + latitudePadding;
  const viewMinLongitude = minLongitude - longitudePadding;
  const viewMaxLongitude = maxLongitude + longitudePadding;
  const viewLatitudeSpan = viewMaxLatitude - viewMinLatitude;
  const viewLongitudeSpan = viewMaxLongitude - viewMinLongitude;
  const heatmap = flux
    ? (() => {
        const overlay = renderSolarFluxOverlay({ flux, mask, roofCoordinates });
        return {
          href: overlay.canvas.toDataURL(),
          x:
            ((overlay.bounds.west - viewMinLongitude) / viewLongitudeSpan) *
            100,
          y:
            ((viewMaxLatitude - overlay.bounds.north) / viewLatitudeSpan) * 100,
          width:
            ((overlay.bounds.east - overlay.bounds.west) / viewLongitudeSpan) *
            100,
          height:
            ((overlay.bounds.north - overlay.bounds.south) / viewLatitudeSpan) *
            100,
          min: overlay.min,
          max: overlay.max,
        };
      })()
    : null;

  const preview = (
    <>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="size-full min-h-56"
        role="img"
        aria-label={`${panels.length} panels in the roof layout`}
      >
        <rect width="100" height="100" fill="var(--color-paper)" />
        {heatmap ? (
          <image
            href={heatmap.href}
            x={heatmap.x}
            y={heatmap.y}
            width={heatmap.width}
            height={heatmap.height}
            preserveAspectRatio="none"
            opacity="0.72"
          />
        ) : null}
        {roofCoordinates.length >= 3 ? (
          <polygon
            points={pointsForSvg(
              roofCoordinates,
              viewMaxLatitude,
              viewMinLongitude,
              viewLongitudeSpan,
              viewLatitudeSpan,
            )}
            fill="var(--color-cobalt-veil)"
            fillOpacity="0.46"
            stroke="var(--color-cobalt)"
            strokeWidth="0.7"
          />
        ) : null}
        {panels.map((panel, index) => {
          const svgCorners = panel.corners.map((corner) =>
            projectPoint(
              corner,
              viewMaxLatitude,
              viewMinLongitude,
              viewLongitudeSpan,
              viewLatitudeSpan,
            ),
          );
          return (
            <g key={index}>
              <polygon
                points={svgCorners
                  .map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`)
                  .join(" ")}
                fill="var(--color-ink)"
                stroke="var(--color-ink)"
                strokeWidth="0.28"
              />
              {cellGridLines(svgCorners).map((line, lineIndex) => (
                <line
                  key={lineIndex}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="var(--color-cobalt)"
                  strokeWidth="0.12"
                  strokeOpacity="0.85"
                />
              ))}
            </g>
          );
        })}
      </svg>
      {heatmap ? (
        <div className="absolute right-3 bottom-3 rounded bg-paper/90 px-2 py-1.5 font-sans text-[10px] text-secondary">
          <p>
            Sunshine: {Math.round(heatmap.min)}–{Math.round(heatmap.max)}{" "}
            kWh/kW/yr
          </p>
          <div
            className="mt-1 flex items-center gap-1.5"
            aria-label="Low to high sunshine legend"
          >
            <span>Low</span>
            <span
              className="h-1.5 w-16 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #2b0057, #7a1f9a, #d45c2a, #f08c00, #fff3a3)",
              }}
            />
            <span>High</span>
          </div>
        </div>
      ) : null}
      <p className="sr-only">
        {panels.length} panels shown in the roof layout.
        {status ? ` ${status}` : ""}
      </p>
    </>
  );

  return unframed ? preview : <MapSurface>{preview}</MapSurface>;
}
