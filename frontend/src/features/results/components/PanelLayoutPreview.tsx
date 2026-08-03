import type { GeoPoint } from "../../../shared/api/types";
import { MapSurface } from "../../../shared/components/ui";
import type { GeoTiffRaster } from "../../../integrations/solar/geoTiffLoader";
import { renderSolarFluxOverlay } from "../../../integrations/solar/fluxRenderer";
import type { LayoutPanel } from "../panelLayoutUtils";

function allPoints(
  roofCoordinates: readonly GeoPoint[],
  panels: LayoutPanel[],
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

export function PanelLayoutPreview({
  roofCoordinates,
  panels,
  status,
  flux = null,
  mask = null,
}: {
  roofCoordinates: readonly GeoPoint[];
  panels: LayoutPanel[];
  status?: string;
  flux?: GeoTiffRaster | null;
  mask?: GeoTiffRaster | null;
}) {
  const points = allPoints(roofCoordinates, panels);
  if (!points.length) {
    return (
      <MapSurface>
        <div className="flex size-full min-h-56 items-center justify-center px-6 text-center font-sans text-sm text-secondary">
          Roof layout preview unavailable until the roof is traced.
        </div>
      </MapSurface>
    );
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

  return (
    <MapSurface>
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
            stroke="var(--color-cobalt)"
            strokeWidth="0.7"
          />
        ) : null}
        {panels.map((panel, index) => (
          <polygon
            key={index}
            points={pointsForSvg(
              panel.corners,
              viewMaxLatitude,
              viewMinLongitude,
              viewLongitudeSpan,
              viewLatitudeSpan,
            )}
            fill="var(--color-sun)"
            fillOpacity="0.78"
            stroke="var(--color-ink)"
            strokeWidth="0.28"
          />
        ))}
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
    </MapSurface>
  );
}
