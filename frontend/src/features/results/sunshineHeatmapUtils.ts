// Converts optional shading data to map-ready heatmap values.
import type { ShadingSummary } from "../../shared/api/types";

const HEATMAP_STOPS = [
  { ratio: 0.55, color: [191, 54, 12] },
  { ratio: 0.65, color: [230, 81, 0] },
  { ratio: 0.75, color: [255, 143, 0] },
  { ratio: 0.85, color: [255, 179, 0] },
  { ratio: 0.95, color: [255, 213, 79] },
  { ratio: 1, color: [255, 236, 120] },
] as const;

export const MAP_VIEW_MODES = {
  panels: "panels",
  flux: "flux",
  combined: "combined",
} as const;

export const FLUX_LEGEND = [
  { label: "Low flux", ratio: 0.15 },
  { label: "Moderate", ratio: 0.5 },
  { label: "High flux", ratio: 0.85 },
] as const;

function channelColor(ratio: number): [number, number, number] {
  const clamped = Math.min(Math.max(ratio, HEATMAP_STOPS[0].ratio), 1);
  for (let index = 0; index < HEATMAP_STOPS.length - 1; index += 1) {
    const current = HEATMAP_STOPS[index]!;
    const next = HEATMAP_STOPS[index + 1]!;
    if (clamped <= next.ratio) {
      const amount = (clamped - current.ratio) / (next.ratio - current.ratio);
      return current.color.map((channel, channelIndex) =>
        Math.round(channel + (next.color[channelIndex] - channel) * amount),
      ) as [number, number, number];
    }
  }
  return [...HEATMAP_STOPS.at(-1)!.color];
}

export function retentionRatioToColor(ratio: number): string {
  return `rgb(${channelColor(Number(ratio)).join(", ")})`;
}

export function segmentRadiusMeters(areaM2: number | string): number {
  return Math.sqrt(Number(areaM2) / Math.PI);
}

export function normalizeShadingSegments(
  shading: Pick<ShadingSummary, "roof_segments"> | null | undefined,
) {
  return (shading?.roof_segments ?? []).map((segment) => ({
    segmentIndex: segment.segment_index,
    center: {
      latitude: Number(segment.center_latitude),
      longitude: Number(segment.center_longitude),
    },
    areaM2: Number(segment.area_m2),
    medianSunshineHours: Number(segment.median_sunshine_hours_per_year),
    retentionRatio: Number(segment.sunshine_retention_ratio),
  }));
}
