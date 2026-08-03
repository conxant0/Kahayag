// Loads provider GeoTIFF layers into a browser-friendly WGS84 raster.
import geokeysToProj4 from "geotiff-geokeys-to-proj4";
import type { GeoKeys } from "geotiff-geokeys-to-proj4";
import { fromArrayBuffer } from "geotiff";
import proj4 from "proj4";

import {
  computeFluxRequestFromRoof,
  type FluxRequest,
} from "../../features/results/roofFluxRequest";
import type {
  FluxVisualizationSummary,
  GeoPoint,
} from "../../shared/api/types";
import { apiPost } from "../../shared/api/client";
import { API_BASE_URL } from "../../shared/config/env";

export const INVALID_FLUX_VALUE = -9999;

export interface GeoTiffBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoTiffRaster {
  width: number;
  height: number;
  rasters: number[][];
  bounds: GeoTiffBounds;
}

export interface SolarFluxLayers {
  flux: GeoTiffRaster;
  mask: GeoTiffRaster;
  fluxVisualization: FluxVisualizationSummary;
  fluxRequest: FluxRequest;
}

export async function fetchGeoTiff(path: string): Promise<GeoTiffRaster> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : `GeoTIFF request failed: ${response.status}`,
    );
  }

  return parseGeoTiffArrayBuffer(await response.arrayBuffer());
}

export async function parseGeoTiffArrayBuffer(
  arrayBuffer: ArrayBuffer,
): Promise<GeoTiffRaster> {
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const geoKeys = image.getGeoKeys();
  if (!geoKeys) {
    throw new Error("GeoTIFF is missing projection metadata.");
  }
  const projectionParameters = geokeysToProj4.toProj4(geoKeys as GeoKeys);
  const projection = proj4(projectionParameters.proj4, "WGS84");
  const [west, south, east, north] = image.getBoundingBox();
  const conversion = projectionParameters.coordinatesConversionParameters;
  const southwest = projection.forward([
    west! * conversion.x,
    south! * conversion.y,
  ]);
  const northeast = projection.forward([
    east! * conversion.x,
    north! * conversion.y,
  ]);

  return {
    width: rasters.width,
    height: rasters.height,
    rasters: Array.from({ length: rasters.length }, (_, index) =>
      Array.from(rasters[index]!),
    ),
    bounds: {
      north: northeast[1],
      south: southwest[1],
      east: northeast[0],
      west: southwest[0],
    },
  };
}

export async function prepareFluxVisualization({
  propertyCoordinates,
  roofCoordinates,
}: {
  propertyCoordinates: GeoPoint | null;
  roofCoordinates: readonly GeoPoint[];
}): Promise<{ visualization: FluxVisualizationSummary; request: FluxRequest }> {
  if (!propertyCoordinates) {
    throw new Error(
      "Property coordinates are required to prepare solar flux layers.",
    );
  }

  const request = computeFluxRequestFromRoof(
    roofCoordinates,
    propertyCoordinates,
  );
  const visualization = await apiPost<FluxVisualizationSummary>(
    "/solar/flux/prepare",
    {
      latitude: request.latitude,
      longitude: request.longitude,
      radius_meters: request.radiusMeters,
    },
  );
  return { visualization, request };
}

export async function loadSolarFluxLayers({
  fluxVisualization = null,
  propertyCoordinates,
  roofCoordinates,
}: {
  fluxVisualization?: FluxVisualizationSummary | null;
  propertyCoordinates: GeoPoint | null;
  roofCoordinates: readonly GeoPoint[];
}): Promise<SolarFluxLayers> {
  let visualization = fluxVisualization;
  let fluxRequest = propertyCoordinates
    ? computeFluxRequestFromRoof(roofCoordinates, propertyCoordinates)
    : null;

  if (!visualization && propertyCoordinates) {
    const prepared = await prepareFluxVisualization({
      propertyCoordinates,
      roofCoordinates,
    });
    visualization = prepared.visualization;
    fluxRequest = prepared.request;
  }
  if (!visualization || !fluxRequest) {
    throw new Error(
      "Solar flux visualization is unavailable for this location.",
    );
  }

  try {
    return { ...(await fetchFluxPair(visualization)), fluxRequest };
  } catch (error) {
    const canRefresh =
      propertyCoordinates &&
      error instanceof Error &&
      /404|502|expired|not found|GeoTIFF request failed/i.test(error.message);
    if (!canRefresh) {
      throw error;
    }

    const prepared = await prepareFluxVisualization({
      propertyCoordinates,
      roofCoordinates,
    });
    return {
      ...(await fetchFluxPair(prepared.visualization)),
      fluxRequest: prepared.request,
    };
  }
}

async function fetchFluxPair(
  fluxVisualization: FluxVisualizationSummary,
): Promise<Omit<SolarFluxLayers, "fluxRequest">> {
  const [flux, mask] = await Promise.all([
    fetchGeoTiff(fluxVisualization.annual_flux_path),
    fetchGeoTiff(fluxVisualization.mask_path),
  ]);
  return { flux, mask, fluxVisualization };
}
