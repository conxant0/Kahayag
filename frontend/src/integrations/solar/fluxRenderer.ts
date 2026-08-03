// Renders masked solar flux rasters to a browser canvas.
import type { GeoPoint } from "../../shared/api/types";
import type { GeoTiffRaster } from "./geoTiffLoader";
import {
  chooseFluxDisplayMask,
  computeFluxRangeForMask,
} from "./fluxTraceMask";

export const SOLAR_FLUX_PALETTE = [
  "2b0057",
  "4c007a",
  "7a1f9a",
  "b03a7a",
  "d45c2a",
  "f08c00",
  "ffc947",
  "fff3a3",
] as const;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function colorToRgb(color: string): Rgb {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function createPalette(colors: readonly string[]): Rgb[] {
  const rgb = colors.map(colorToRgb);
  return Array.from({ length: 256 }, (_, index) => {
    const position = (index * (rgb.length - 1)) / 255;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const amount = position - lower;
    return {
      r: rgb[lower]!.r + amount * (rgb[upper]!.r - rgb[lower]!.r),
      g: rgb[lower]!.g + amount * (rgb[upper]!.g - rgb[lower]!.g),
      b: rgb[lower]!.b + amount * (rgb[upper]!.b - rgb[lower]!.b),
    };
  });
}

export function renderSolarFluxPalette({
  data,
  mask,
  colors = SOLAR_FLUX_PALETTE,
  min,
  max,
}: {
  data: GeoTiffRaster;
  mask?: GeoTiffRaster | null;
  colors?: readonly string[];
  min: number;
  max: number;
}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = mask?.width ?? data.width;
  canvas.height = mask?.height ?? data.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D rendering is unavailable.");
  }

  const image = context.createImageData(canvas.width, canvas.height);
  const palette = createPalette(colors);
  const raster = data.rasters[0]!;
  const maskRaster = mask?.rasters[0];

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const sourceX = Math.floor((x / canvas.width) * data.width);
      const sourceY = Math.floor((y / canvas.height) * data.height);
      const value = raster[sourceY * data.width + sourceX]!;
      const normalized =
        max === min
          ? 0.5
          : Math.min(Math.max((value - min) / (max - min), 0), 1);
      const color = palette[Math.round(normalized * 255)]!;
      const pixel = (y * canvas.width + x) * 4;
      image.data[pixel] = color.r;
      image.data[pixel + 1] = color.g;
      image.data[pixel + 2] = color.b;
      image.data[pixel + 3] = maskRaster
        ? maskRaster[y * canvas.width + x]! * 255
        : 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

export function renderSolarFluxOverlay({
  flux,
  mask,
  roofCoordinates,
}: {
  flux: GeoTiffRaster;
  mask?: GeoTiffRaster | null;
  roofCoordinates?: readonly GeoPoint[];
}): {
  canvas: HTMLCanvasElement;
  bounds: GeoTiffRaster["bounds"];
  min: number;
  max: number;
  maskedToTrace: boolean;
} {
  const displayMask = chooseFluxDisplayMask({
    googleMask: mask,
    flux,
    roofCoordinates,
  });
  const { min, max } = computeFluxRangeForMask(
    flux.rasters[0]!,
    displayMask?.rasters[0],
  );
  return {
    canvas: renderSolarFluxPalette({ data: flux, mask: displayMask, min, max }),
    bounds: flux.bounds,
    min,
    max,
    maskedToTrace: Boolean(roofCoordinates && roofCoordinates.length >= 3),
  };
}
