import type { GeoPoint } from "../../shared/api/types";

export function computeFluxCacheKey({
  roofCoordinates,
  selectedProperty,
}: {
  roofCoordinates: readonly GeoPoint[];
  selectedProperty: GeoPoint | null;
}): string | null {
  return roofCoordinates.length && selectedProperty
    ? JSON.stringify({ selectedProperty, roofCoordinates })
    : null;
}

export function needsFluxForPanelLayout({
  shading,
  roofCoordinates,
  panelCount,
}: {
  shading: unknown;
  roofCoordinates: readonly GeoPoint[];
  panelCount: number;
}): boolean {
  return Boolean(shading) && roofCoordinates.length >= 3 && panelCount > 0;
}
