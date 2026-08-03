import type { GeoPoint } from "../../../shared/api/types";
import { MapSurface } from "../../../shared/components/ui";
import type { LayoutPanel } from "../panelLayoutUtils";

function allPoints(roofCoordinates: readonly GeoPoint[], panels: LayoutPanel[]) {
  return [
    ...roofCoordinates,
    ...panels.flatMap((panel) => panel.corners),
  ];
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
}: {
  roofCoordinates: readonly GeoPoint[];
  panels: LayoutPanel[];
  status?: string;
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
      <p className="sr-only">
        {panels.length} panels shown in the roof layout.
        {status ? ` ${status}` : ""}
      </p>
    </MapSurface>
  );
}
