// Defines the assessment session state shared across the input journey.
import { create } from "zustand";

import { readJson, removeJson, writeJson } from "../integrations/storage";

/**
 * One key holds the whole session. The pieces are written and read together —
 * a roof polygon without the property it was traced on is not useful — so
 * splitting them across keys would only create ways for them to disagree.
 */
export const ASSESSMENT_SESSION_STORAGE_KEY = "kahayag-assessment-session";

/** Meralco's residential rate, rounded. The energy step lets it be overridden. */
export const DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH = 12;

/** A polygon needs three corners before it encloses any area at all. */
const MINIMUM_POLYGON_POINTS = 3;

export type SelectedProperty = {
  address: string;
  latitude: number;
  longitude: number;
};

export type RoofCoordinate = {
  latitude: number;
  longitude: number;
};

export type RoofPolygon = {
  coordinates: RoofCoordinate[];
  areaSquareMeters: number;
};

export type EnergyInputs = {
  monthlyBillPhp: number | null;
  electricityRatePhpPerKwh: number;
  /** Optional. Absent means "no ceiling", never a silent default figure. */
  budgetPhp: number | null;
};

/**
 * The assessment response, held opaquely.
 *
 * This store's job is to say whether a result exists, not to describe it. The
 * authoritative shape is the backend's `CompletedAssessment` schema, and the
 * results feature narrows it where the fields are actually read — declaring it
 * here would put the contract in the wrong place and leave two copies to drift.
 */
export type CompletedAssessment = Readonly<Record<string, unknown>>;

export const DEFAULT_ENERGY_INPUTS: EnergyInputs = Object.freeze({
  monthlyBillPhp: null,
  electricityRatePhpPerKwh: DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH,
  budgetPhp: null,
});

/** The slice that survives a reload. `result` is deliberately not in it. */
export type PersistedSession = {
  selectedProperty: SelectedProperty | null;
  roofPolygon: RoofPolygon | null;
  energyInputs: EnergyInputs;
};

export type AssessmentState = PersistedSession & {
  result: CompletedAssessment | null;
  setResult: (result: CompletedAssessment | null) => void;
  setPropertySelection: (property: SelectedProperty | null) => void;
  setRoofPolygon: (polygon: RoofPolygon | null) => void;
  setEnergyInputs: (changes: Partial<EnergyInputs>) => void;
  reset: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Optional money fields: anything not strictly positive reads as "not given". */
function positiveOrNull(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function parseProperty(value: unknown): SelectedProperty | null {
  if (!isRecord(value) || typeof value.address !== "string") {
    return null;
  }

  const latitude = finiteNumber(value.latitude);
  const longitude = finiteNumber(value.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  return { address: value.address, latitude, longitude };
}

/**
 * A partially valid polygon is worse than none: it would pass a length check
 * downstream and then produce a wrong area, so any bad vertex drops the whole
 * trace and the user redraws it.
 */
function parseRoofPolygon(value: unknown): RoofPolygon | null {
  if (!isRecord(value) || !Array.isArray(value.coordinates)) {
    return null;
  }

  const coordinates: RoofCoordinate[] = [];
  for (const entry of value.coordinates) {
    if (!isRecord(entry)) {
      return null;
    }
    const latitude = finiteNumber(entry.latitude);
    const longitude = finiteNumber(entry.longitude);
    if (latitude === null || longitude === null) {
      return null;
    }
    coordinates.push({ latitude, longitude });
  }

  if (coordinates.length < MINIMUM_POLYGON_POINTS) {
    return null;
  }

  const areaSquareMeters = finiteNumber(value.areaSquareMeters);
  if (areaSquareMeters === null || areaSquareMeters <= 0) {
    return null;
  }

  return { coordinates, areaSquareMeters };
}

/**
 * Unlike the other two, this never returns null — the energy step always has a
 * shape to render, and a missing or nonsensical rate falls back to the default
 * rather than leaving the field undefined.
 */
function parseEnergyInputs(value: unknown): EnergyInputs {
  if (!isRecord(value)) {
    return { ...DEFAULT_ENERGY_INPUTS };
  }

  const rate = positiveOrNull(value.electricityRatePhpPerKwh);

  return {
    monthlyBillPhp: positiveOrNull(value.monthlyBillPhp),
    electricityRatePhpPerKwh: rate ?? DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH,
    budgetPhp: positiveOrNull(value.budgetPhp),
  };
}

/**
 * Rebuilds the session from storage, field by field.
 *
 * Every field is validated independently so one bad entry costs only itself —
 * a corrupt roof trace should not also throw away a property the user picked
 * two screens earlier.
 */
export function readStoredSession(): PersistedSession {
  const stored = readJson(ASSESSMENT_SESSION_STORAGE_KEY);
  if (!isRecord(stored)) {
    return {
      selectedProperty: null,
      roofPolygon: null,
      energyInputs: { ...DEFAULT_ENERGY_INPUTS },
    };
  }

  return {
    selectedProperty: parseProperty(stored.selectedProperty),
    roofPolygon: parseRoofPolygon(stored.roofPolygon),
    energyInputs: parseEnergyInputs(stored.energyInputs),
  };
}

export const useAssessmentStore = create<AssessmentState>()((set, get) => {
  /**
   * Writes whatever the store currently holds, rather than taking the changed
   * values as arguments. Reading back through `get()` after the `set()` means
   * the persisted copy cannot drift from the in-memory one when a new field is
   * added and one call site forgets to pass it.
   */
  const persist = () => {
    const { selectedProperty, roofPolygon, energyInputs } = get();
    writeJson(ASSESSMENT_SESSION_STORAGE_KEY, {
      selectedProperty,
      roofPolygon,
      energyInputs,
    });
  };

  return {
    ...readStoredSession(),

    // Held in memory only. A reload means the inputs are still there but the
    // computed result is not, which is the honest outcome: showing figures from
    // a previous run beside inputs that may since have changed would be a lie.
    result: null,

    setResult: (result) => set({ result }),

    setPropertySelection: (selectedProperty) => {
      set({ selectedProperty });
      persist();
    },

    setRoofPolygon: (roofPolygon) => {
      set({ roofPolygon });
      persist();
    },

    setEnergyInputs: (changes) => {
      set({ energyInputs: { ...get().energyInputs, ...changes } });
      persist();
    },

    reset: () => {
      set({
        result: null,
        selectedProperty: null,
        roofPolygon: null,
        energyInputs: { ...DEFAULT_ENERGY_INPUTS },
      });
      removeJson(ASSESSMENT_SESSION_STORAGE_KEY);
    },
  };
});
