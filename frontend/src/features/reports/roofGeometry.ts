// Formats roof orientation and pitch from Google Solar roof segments.

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

interface RoofSegmentGeometry {
  area_m2: string | number;
  pitch_degrees: string | number;
  azimuth_degrees: string | number;
}

export interface RoofGeometrySummary {
  pitchDegrees: number;
  azimuthDegrees: number;
}

export function summarizeRoofGeometry(
  segments: readonly RoofSegmentGeometry[] | null | undefined,
): RoofGeometrySummary | null {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  let totalArea = 0;
  let pitchSum = 0;
  let azimuthX = 0;
  let azimuthY = 0;

  for (const segment of segments) {
    const area = Number(segment.area_m2);
    const pitch = Number(segment.pitch_degrees);
    const azimuth = Number(segment.azimuth_degrees);

    if (!Number.isFinite(area) || area <= 0) {
      continue;
    }

    if (!Number.isFinite(pitch) || !Number.isFinite(azimuth)) {
      continue;
    }

    totalArea += area;
    pitchSum += pitch * area;
    const radians = (azimuth * Math.PI) / 180;
    azimuthX += Math.sin(radians) * area;
    azimuthY += Math.cos(radians) * area;
  }

  if (totalArea <= 0) {
    return null;
  }

  const pitchDegrees = pitchSum / totalArea;
  const azimuthDegrees =
    ((Math.atan2(azimuthX, azimuthY) * 180) / Math.PI + 360) % 360;

  return { pitchDegrees, azimuthDegrees };
}

export function formatRoofPitch(pitchDegrees: number): string {
  return `${Math.round(Number(pitchDegrees))}°`;
}

export function formatRoofOrientation(azimuthDegrees: number): string {
  const normalized = ((Number(azimuthDegrees) % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % CARDINALS.length;

  return `${Math.round(normalized)}° ${CARDINALS[index]}`;
}
