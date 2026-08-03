// Keeps optional flux layers in memory for the current assessment session.
import { create } from "zustand";

import type { FluxRequest } from "../features/results/roofFluxRequest";
import type { GeoTiffRaster } from "../integrations/solar/geoTiffLoader";

export interface FluxCacheEntry {
  key: string | null;
  flux: GeoTiffRaster;
  mask: GeoTiffRaster;
  fluxRequest: FluxRequest;
  fluxRange: { min: number; max: number };
  fluxCenteredOnTrace: boolean;
}

interface FluxCacheState {
  entry: FluxCacheEntry | null;
  setEntry: (entry: FluxCacheEntry) => void;
  clear: () => void;
}

export const useFluxCacheStore = create<FluxCacheState>()((set) => ({
  entry: null,
  setEntry: (entry) => set({ entry }),
  clear: () => set({ entry: null }),
}));
