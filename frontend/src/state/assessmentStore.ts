// Defines the assessment session state shared across the input journey.
import { create } from "zustand";

import { readJson, removeJson, writeJson } from "../integrations/storage";
import { useDesignStore } from "./designStore";

/**
 * One key holds the whole session. The pieces are written and read together —
 * a roof polygon without the property it was traced on is not useful — so
 * splitting them across keys would only create ways for them to disagree.
 */
export const ASSESSMENT_SESSION_STORAGE_KEY = "kahayag-assessment-session";

/**
 * Meralco's residential rate, rounded — for display and for the live preview
 * only.
 *
 * It is not a session value. A rate nobody typed is left null all the way to
 * the request, so the backend applies its own default and discloses that it
 * did; writing 12 in here would make every assessment look like the homeowner
 * had confirmed their tariff.
 */
export const DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH = 12;

/** A polygon needs three corners before it encloses any area at all. */
const MINIMUM_POLYGON_POINTS = 3;

/**
 * Where a property came from.
 *
 * Kept closed so that reading it is a check the compiler can see. An
 * approximate pin from an IP lookup has to be worded differently to an address
 * someone chose, and a free string makes that difference easy to get wrong.
 */
export type PropertySource =
  | "search"
  | "map"
  | "manual"
  | "demo"
  | "geolocation"
  | "geolocation-approximate";

const PROPERTY_SOURCES: readonly PropertySource[] = [
  "search",
  "map",
  "manual",
  "demo",
  "geolocation",
  "geolocation-approximate",
];

function parseSource(value: unknown): PropertySource {
  return PROPERTY_SOURCES.includes(value as PropertySource)
    ? (value as PropertySource)
    : "search";
}

export type SelectedProperty = {
  /** The provider's identifier when the pick came from search; null otherwise. */
  placeId: string | null;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** How the pick was made. A closed set, because screens branch on it. */
  source: PropertySource;
};

export type RoofCoordinate = {
  latitude: number;
  longitude: number;
};

export type RoofPolygon = {
  id: string;
  /** Ties the trace to the property it was drawn on, so a new pick clears it. */
  propertyId: string | null;
  coordinates: RoofCoordinate[];
  areaSquareMeters: number;
  perimeterMeters: number;
  createdAt: string;
};

export type EnergyInputs = {
  monthlyBillPhp: number | null;
  /** Optional. Null means "nobody said", which the backend answers with its
   *  own default tariff and reports as such — never a figure invented here. */
  electricityRatePhpPerKwh: number | null;
  /** Optional. Absent means "no ceiling", never a silent default figure. */
  budgetPhp: number | null;
};

// The plan answers are closed sets for the same reason `PropertySource` is:
// screens and proposal copy branch on them, and a free string makes the
// branch that was never written silently render nothing.
export type PrimaryGoal =
  | "reduce-bill"
  | "stay-in-budget"
  | "backup-outages"
  | "maximize-production";

export type UsagePattern = "daytime" | "nighttime" | "balanced";

export type FutureLoad = "aircon" | "ev" | "water-pump" | "appliances";

export type RoofMaterial = "metal" | "concrete" | "tile" | "shingle" | "unsure";

export type PropertyKind = "house" | "commercial" | "other";

export type InstallTimeline =
  | "three-months"
  | "six-months"
  | "one-year"
  | "exploring";

/**
 * What the homeowner wants from the system, kept beside — not inside — the
 * numbers the assessment is computed from.
 *
 * These answers feed the design solver at bootstrap (goal, consumption uplift,
 * mounting kit) and give the design agent context for explanations. They do not
 * alter the POST /assessments recommendation. Every field is null until
 * answered, which is how an answer nobody gave stays distinguishable from any
 * answer somebody did.
 */
export type AssessmentPlans = {
  primaryGoal: PrimaryGoal | null;
  usagePattern: UsagePattern | null;
  /** Null is "not answered"; an empty array is an explicit "none planned". */
  futureLoads: FutureLoad[] | null;
  roofMaterial: RoofMaterial | null;
  propertyKind: PropertyKind | null;
  ownsProperty: boolean | null;
  timeline: InstallTimeline | null;
};

/**
 * Where a proposal could reach the homeowner. Demo-only: kept on this device
 * with the session, never sent anywhere.
 */
export type ContactDetails = {
  fullName: string;
  email: string;
  mobile: string;
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
  electricityRatePhpPerKwh: null,
  budgetPhp: null,
});

export const DEFAULT_ASSESSMENT_PLANS: AssessmentPlans = Object.freeze({
  primaryGoal: null,
  usagePattern: null,
  futureLoads: null,
  roofMaterial: null,
  propertyKind: null,
  ownsProperty: null,
  timeline: null,
});

export const DEFAULT_CONTACT_DETAILS: ContactDetails = Object.freeze({
  fullName: "",
  email: "",
  mobile: "",
});

/** The slice that survives a reload. `result` is deliberately not in it. */
export type PersistedSession = {
  selectedProperty: SelectedProperty | null;
  roofPolygon: RoofPolygon | null;
  energyInputs: EnergyInputs;
  plans: AssessmentPlans;
  contactDetails: ContactDetails;
};

export type AssessmentState = PersistedSession & {
  result: CompletedAssessment | null;
  setResult: (result: CompletedAssessment | null) => void;
  setPropertySelection: (property: SelectedProperty | null) => void;
  setRoofPolygon: (polygon: RoofPolygon | null) => void;
  setEnergyInputs: (changes: Partial<EnergyInputs>) => void;
  setPlans: (changes: Partial<AssessmentPlans>) => void;
  setContactDetails: (changes: Partial<ContactDetails>) => void;
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

  return {
    placeId: typeof value.placeId === "string" ? value.placeId : null,
    name: typeof value.name === "string" ? value.name : value.address,
    address: value.address,
    latitude,
    longitude,
    // How it was picked is provenance, not identity: a stored value with an
    // unknown source is still a usable property, so it falls back to the
    // commonest rather than discarding the pick.
    source: parseSource(value.source),
  };
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

  return {
    // Identity and provenance are recoverable; geometry is not. A stored trace
    // missing them is still a usable trace, so these fall back rather than
    // discarding a shape the user drew.
    id: typeof value.id === "string" ? value.id : "",
    propertyId: typeof value.propertyId === "string" ? value.propertyId : null,
    coordinates,
    areaSquareMeters,
    perimeterMeters: finiteNumber(value.perimeterMeters) ?? 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
  };
}

/**
 * Unlike the other two, this never returns null — the energy step always has a
 * shape to render. Every field inside it can still be null, which is how an
 * answer nobody gave is told apart from one that was.
 */
function parseEnergyInputs(value: unknown): EnergyInputs {
  if (!isRecord(value)) {
    return { ...DEFAULT_ENERGY_INPUTS };
  }

  return {
    monthlyBillPhp: positiveOrNull(value.monthlyBillPhp),
    electricityRatePhpPerKwh: positiveOrNull(value.electricityRatePhpPerKwh),
    budgetPhp: positiveOrNull(value.budgetPhp),
  };
}

/** A stored answer outside its closed set reads as "not answered". */
function memberOrNull<T extends string>(
  values: readonly T[],
  value: unknown,
): T | null {
  return values.includes(value as T) ? (value as T) : null;
}

const PRIMARY_GOALS: readonly PrimaryGoal[] = [
  "reduce-bill",
  "stay-in-budget",
  "backup-outages",
  "maximize-production",
];
const USAGE_PATTERNS: readonly UsagePattern[] = [
  "daytime",
  "nighttime",
  "balanced",
];
const FUTURE_LOADS: readonly FutureLoad[] = [
  "aircon",
  "ev",
  "water-pump",
  "appliances",
];
const ROOF_MATERIALS: readonly RoofMaterial[] = [
  "metal",
  "concrete",
  "tile",
  "shingle",
  "unsure",
];
const PROPERTY_KINDS: readonly PropertyKind[] = [
  "house",
  "commercial",
  "other",
];
const INSTALL_TIMELINES: readonly InstallTimeline[] = [
  "three-months",
  "six-months",
  "one-year",
  "exploring",
];

/**
 * The future-loads list keeps its two kinds of nothing: an absent list is
 * "not answered", an empty one is an explicit "none planned". A stored list
 * that loses every entry to validation is the first kind — nothing valid was
 * ever answered, so it must not come back as the explicit "none".
 */
function parseFutureLoads(value: unknown): FutureLoad[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const kept = value.filter(
    (entry): entry is FutureLoad => memberOrNull(FUTURE_LOADS, entry) !== null,
  );
  if (kept.length === 0 && value.length > 0) {
    return null;
  }

  return kept;
}

/**
 * Like the energy inputs, always a shape to render; each answer stands or
 * falls on its own.
 */
function parsePlans(value: unknown): AssessmentPlans {
  if (!isRecord(value)) {
    return { ...DEFAULT_ASSESSMENT_PLANS };
  }

  return {
    primaryGoal: memberOrNull(PRIMARY_GOALS, value.primaryGoal),
    usagePattern: memberOrNull(USAGE_PATTERNS, value.usagePattern),
    futureLoads: parseFutureLoads(value.futureLoads),
    roofMaterial: memberOrNull(ROOF_MATERIALS, value.roofMaterial),
    propertyKind: memberOrNull(PROPERTY_KINDS, value.propertyKind),
    ownsProperty:
      typeof value.ownsProperty === "boolean" ? value.ownsProperty : null,
    timeline: memberOrNull(INSTALL_TIMELINES, value.timeline),
  };
}

function parseContactDetails(value: unknown): ContactDetails {
  if (!isRecord(value)) {
    return { ...DEFAULT_CONTACT_DETAILS };
  }

  return {
    fullName: typeof value.fullName === "string" ? value.fullName : "",
    email: typeof value.email === "string" ? value.email : "",
    mobile: typeof value.mobile === "string" ? value.mobile : "",
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
      plans: { ...DEFAULT_ASSESSMENT_PLANS },
      contactDetails: { ...DEFAULT_CONTACT_DETAILS },
    };
  }

  return {
    selectedProperty: parseProperty(stored.selectedProperty),
    roofPolygon: parseRoofPolygon(stored.roofPolygon),
    energyInputs: parseEnergyInputs(stored.energyInputs),
    plans: parsePlans(stored.plans),
    contactDetails: parseContactDetails(stored.contactDetails),
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
    const { selectedProperty, roofPolygon, energyInputs, plans, contactDetails } =
      get();
    writeJson(ASSESSMENT_SESSION_STORAGE_KEY, {
      selectedProperty,
      roofPolygon,
      energyInputs,
      plans,
      contactDetails,
    });
  };

  /**
   * Applies an input change: stores it, drops the result, and persists.
   *
   * Every input the result was computed from invalidates it on edit. Going back
   * a step, changing an answer, and returning to figures derived from the old
   * one is the same mismatch a reload avoids by not restoring the result at
   * all, the only difference being that nothing reloaded.
   *
   * The setters route through here rather than each clearing `result`
   * themselves, so a fourth input cannot be added that quietly keeps a stale
   * result alive.
   */
  const commitInput = (changes: Partial<PersistedSession>) => {
    useDesignStore.getState().clearDesign();
    set({ ...changes, result: null });
    persist();
  };

  return {
    ...readStoredSession(),

    // Held in memory only, and dropped the moment any input it was computed
    // from changes. A reload means the inputs are still there but the computed
    // result is not, which is the honest outcome: showing figures from a
    // previous run beside inputs that may since have changed would be a lie.
    result: null,

    setResult: (result) => set({ result }),

    /**
     * Choosing a property also drops any roof drawn on the previous one.
     *
     * A trace is a shape on one specific roof. Carrying it to a different
     * address leaves an outline floating over a building nobody drew it on,
     * and every figure downstream would be computed from it. Cleared here
     * rather than in the tracing screen, because the screen can only clear
     * what it is showing, and this has to hold whichever route changed the
     * property.
     */
    setPropertySelection: (selectedProperty) =>
      commitInput({ selectedProperty, roofPolygon: null }),

    setRoofPolygon: (roofPolygon) => commitInput({ roofPolygon }),

    setEnergyInputs: (changes) =>
      commitInput({ energyInputs: { ...get().energyInputs, ...changes } }),

    /**
     * Deliberately not routed through `commitInput`: no calculation reads
     * these answers, so editing one must not discard a result computed from
     * numbers that have not changed. The clearest case is contact details,
     * which are typed on the report screen — where throwing the result away
     * would take the report with it.
     */
    setPlans: (changes) => {
      set({ plans: { ...get().plans, ...changes } });
      persist();
    },

    setContactDetails: (changes) => {
      set({ contactDetails: { ...get().contactDetails, ...changes } });
      persist();
    },

    reset: () => {
      useDesignStore.getState().clearDesign();
      set({
        result: null,
        selectedProperty: null,
        roofPolygon: null,
        energyInputs: { ...DEFAULT_ENERGY_INPUTS },
        plans: { ...DEFAULT_ASSESSMENT_PLANS },
        contactDetails: { ...DEFAULT_CONTACT_DETAILS },
      });
      removeJson(ASSESSMENT_SESSION_STORAGE_KEY);
    },
  };
});
