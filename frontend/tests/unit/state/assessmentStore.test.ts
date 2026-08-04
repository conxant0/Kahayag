// Verifies session hydration, validation of stored data, and persistence rules.
import { beforeEach, describe, expect, it } from "vitest";

import type {
  RoofPolygon,
  SelectedProperty,
} from "../../../src/state/assessmentStore";
import {
  ASSESSMENT_SESSION_STORAGE_KEY as KEY,
  DEFAULT_ASSESSMENT_PLANS,
  DEFAULT_CONTACT_DETAILS,
  DEFAULT_ENERGY_INPUTS,
  readStoredSession,
  useAssessmentStore,
} from "../../../src/state/assessmentStore";

const PROPERTY: SelectedProperty = {
  placeId: "place-pajo",
  name: "Pajo",
  address: "Pajo, Lapu-Lapu City",
  latitude: 10.3103,
  longitude: 123.9494,
  source: "search",
};

const ROOF: RoofPolygon = {
  id: "roof-1",
  propertyId: "place-pajo",
  perimeterMeters: 28,
  createdAt: "2026-08-03T00:00:00.000Z",
  coordinates: [
    { latitude: 10.3103, longitude: 123.9494 },
    { latitude: 10.3104, longitude: 123.9494 },
    { latitude: 10.3104, longitude: 123.9495 },
    { latitude: 10.3103, longitude: 123.9495 },
  ],
  areaSquareMeters: 48,
};

function seed(session: unknown) {
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

function storedSession() {
  const raw = window.sessionStorage.getItem(KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

beforeEach(() => {
  window.sessionStorage.clear();
  useAssessmentStore.getState().reset();
});

describe("readStoredSession", () => {
  it("returns an empty session when nothing is stored", () => {
    expect(readStoredSession()).toEqual({
      selectedProperty: null,
      roofPolygon: null,
      energyInputs: DEFAULT_ENERGY_INPUTS,
      plans: DEFAULT_ASSESSMENT_PLANS,
      contactDetails: DEFAULT_CONTACT_DETAILS,
    });
  });

  it("treats unparseable JSON as an empty session rather than throwing", () => {
    window.sessionStorage.setItem(KEY, "{not json");

    expect(() => readStoredSession()).not.toThrow();
    expect(readStoredSession().selectedProperty).toBeNull();
  });

  it("restores a complete session", () => {
    const plans = {
      primaryGoal: "reduce-bill",
      usagePattern: "daytime",
      futureLoads: ["aircon", "ev"],
      roofMaterial: "metal",
      propertyKind: "house",
      ownsProperty: true,
      timeline: "six-months",
    };
    const contactDetails = {
      fullName: "Juana dela Cruz",
      email: "juana@example.com",
      mobile: "0917 123 4567",
    };
    seed({
      selectedProperty: PROPERTY,
      roofPolygon: ROOF,
      energyInputs: {
        monthlyBillPhp: 4800,
        electricityRatePhpPerKwh: 11.5,
        budgetPhp: 250000,
      },
      plans,
      contactDetails,
    });

    expect(readStoredSession()).toEqual({
      selectedProperty: PROPERTY,
      roofPolygon: ROOF,
      energyInputs: {
        monthlyBillPhp: 4800,
        electricityRatePhpPerKwh: 11.5,
        budgetPhp: 250000,
      },
      plans,
      contactDetails,
    });
  });

  it("drops a stored plan answer that is outside its closed set", () => {
    seed({
      plans: {
        primaryGoal: "get-famous",
        usagePattern: "daytime",
        futureLoads: ["ev", "time-machine"],
        ownsProperty: "yes",
      },
    });

    expect(readStoredSession().plans).toEqual({
      ...DEFAULT_ASSESSMENT_PLANS,
      usagePattern: "daytime",
      futureLoads: ["ev"],
    });
  });

  it("keeps an explicit 'none planned' apart from an unanswered question", () => {
    seed({ plans: { futureLoads: [] } });

    // An empty list is an answer somebody gave; null is the question nobody
    // reached. Restoring one as the other would repaint the step wrongly.
    expect(readStoredSession().plans.futureLoads).toEqual([]);
    expect(readStoredSession().contactDetails).toEqual(DEFAULT_CONTACT_DETAILS);
  });

  it("reads a list of only invalid loads as unanswered, not as 'none'", () => {
    // Validation emptied the list; nobody chose the empty list. Restoring it
    // as [] would paint the explicit "None" chip for an answer never given.
    seed({ plans: { futureLoads: ["time-machine", 7] } });

    expect(readStoredSession().plans.futureLoads).toBeNull();
  });

  it("drops only the field that is corrupt", () => {
    seed({ selectedProperty: PROPERTY, roofPolygon: { nonsense: true } });

    const session = readStoredSession();

    expect(session.selectedProperty).toEqual(PROPERTY);
    expect(session.roofPolygon).toBeNull();
  });

  it("rejects a property without usable coordinates", () => {
    seed({
      selectedProperty: {
        address: "Somewhere",
        latitude: "10.3",
        longitude: 123.9,
      },
    });

    expect(readStoredSession().selectedProperty).toBeNull();
  });

  it("fills in the optional property fields a stored pick may lack", () => {
    seed({
      selectedProperty: {
        address: "Pajo, Lapu-Lapu City",
        latitude: 10.3103,
        longitude: 123.9494,
      },
    });

    expect(readStoredSession().selectedProperty).toEqual({
      placeId: null,
      name: "Pajo, Lapu-Lapu City",
      address: "Pajo, Lapu-Lapu City",
      latitude: 10.3103,
      longitude: 123.9494,
      source: "search",
    });
  });

  it("rejects a polygon with fewer than three corners", () => {
    seed({
      roofPolygon: {
        coordinates: ROOF.coordinates.slice(0, 2),
        areaSquareMeters: 48,
      },
    });

    expect(readStoredSession().roofPolygon).toBeNull();
  });

  it("rejects the whole polygon when one vertex is not finite", () => {
    seed({
      roofPolygon: {
        coordinates: [
          ...ROOF.coordinates.slice(0, 3),
          { latitude: 1, longitude: null },
        ],
        areaSquareMeters: 48,
      },
    });

    expect(readStoredSession().roofPolygon).toBeNull();
  });

  it("rejects a polygon with no positive area", () => {
    seed({ roofPolygon: { ...ROOF, areaSquareMeters: 0 } });

    expect(readStoredSession().roofPolygon).toBeNull();
  });

  it("clears non-positive money fields rather than carrying them forward", () => {
    seed({ energyInputs: { monthlyBillPhp: 0, budgetPhp: -5 } });

    expect(readStoredSession().energyInputs).toEqual({
      monthlyBillPhp: null,
      electricityRatePhpPerKwh: null,
      budgetPhp: null,
    });
  });
});

describe("useAssessmentStore", () => {
  it("starts with nothing answered so no field defaults silently", () => {
    const { energyInputs } = useAssessmentStore.getState();

    expect(energyInputs.monthlyBillPhp).toBeNull();
    expect(energyInputs.budgetPhp).toBeNull();
    // Not 12: an unanswered tariff has to reach the backend as unanswered, so
    // the result can disclose that the default was applied.
    expect(energyInputs.electricityRatePhpPerKwh).toBeNull();
  });

  it("persists a property selection", () => {
    useAssessmentStore.getState().setPropertySelection(PROPERTY);

    expect(useAssessmentStore.getState().selectedProperty).toEqual(PROPERTY);
    expect(storedSession()?.selectedProperty).toEqual(PROPERTY);
  });

  it("merges partial energy updates instead of replacing them", () => {
    const { setEnergyInputs } = useAssessmentStore.getState();

    setEnergyInputs({ monthlyBillPhp: 4800 });
    setEnergyInputs({ budgetPhp: 250000 });

    expect(useAssessmentStore.getState().energyInputs).toEqual({
      monthlyBillPhp: 4800,
      electricityRatePhpPerKwh: null,
      budgetPhp: 250000,
    });
  });

  it("persists every field on each write, not just the changed one", () => {
    useAssessmentStore.getState().setPropertySelection(PROPERTY);
    useAssessmentStore.getState().setRoofPolygon(ROOF);

    const stored = storedSession();

    expect(stored?.selectedProperty).toEqual(PROPERTY);
    expect(stored?.roofPolygon).toEqual(ROOF);
  });

  it("keeps the result in memory and out of storage", () => {
    // Something has to persist first, or the assertion proves nothing: with no
    // stored blob at all, "storage has no result field" holds trivially and
    // would keep holding even if `persist` started writing one.
    useAssessmentStore.getState().setPropertySelection(PROPERTY);
    useAssessmentStore.getState().setResult({ is_provisional: true });

    expect(useAssessmentStore.getState().result).toEqual({
      is_provisional: true,
    });
    expect(storedSession()).not.toHaveProperty("result");
  });

  it.each([
    [
      "the property changes",
      () => useAssessmentStore.getState().setPropertySelection(PROPERTY),
    ],
    [
      "the roof is retraced",
      () => useAssessmentStore.getState().setRoofPolygon(ROOF),
    ],
    [
      "an energy input changes",
      () =>
        useAssessmentStore.getState().setEnergyInputs({ budgetPhp: 300000 }),
    ],
  ])("discards a computed result when %s", (_label, editInput) => {
    useAssessmentStore.getState().setResult({ is_provisional: true });

    editInput();

    // Going back a step, changing an answer, and returning to figures derived
    // from the old one is the mismatch a reload avoids by never restoring the
    // result. Editing in place has to reach the same outcome.
    expect(useAssessmentStore.getState().result).toBeNull();
  });

  it("keeps the edited input while discarding the result", () => {
    useAssessmentStore.getState().setPropertySelection(PROPERTY);
    useAssessmentStore.getState().setResult({ is_provisional: true });

    useAssessmentStore.getState().setEnergyInputs({ monthlyBillPhp: 4800 });

    const state = useAssessmentStore.getState();

    expect(state.result).toBeNull();
    expect(state.energyInputs.monthlyBillPhp).toBe(4800);
    expect(state.selectedProperty).toEqual(PROPERTY);
    expect(storedSession()?.selectedProperty).toEqual(PROPERTY);
  });

  it.each([
    [
      "a plan answer changes",
      () => useAssessmentStore.getState().setPlans({ primaryGoal: "reduce-bill" }),
    ],
    [
      "a contact detail is typed",
      () =>
        useAssessmentStore.getState().setContactDetails({ fullName: "Juana" }),
    ],
  ])("keeps a computed result when %s", (_label, editContext) => {
    // No calculation reads these answers, so editing one must not discard a
    // result computed from numbers that have not changed — contact details
    // are typed on the report screen, where losing the result loses the page.
    useAssessmentStore.getState().setResult({ is_provisional: true });

    editContext();

    expect(useAssessmentStore.getState().result).toEqual({
      is_provisional: true,
    });
  });

  it("persists plan answers and contact details with the session", () => {
    useAssessmentStore
      .getState()
      .setPlans({ primaryGoal: "backup-outages", futureLoads: [] });
    useAssessmentStore.getState().setContactDetails({ mobile: "0917 000 111" });

    expect(storedSession()?.plans).toMatchObject({
      primaryGoal: "backup-outages",
      futureLoads: [],
    });
    expect(storedSession()?.contactDetails).toMatchObject({
      mobile: "0917 000 111",
    });
  });

  it("drops a roof trace when a different property is chosen", () => {
    useAssessmentStore.getState().setPropertySelection(PROPERTY);
    useAssessmentStore.getState().setRoofPolygon(ROOF);

    useAssessmentStore.getState().setPropertySelection({
      ...PROPERTY,
      placeId: null,
      address: "Somewhere else, Cebu",
      latitude: 10.4,
      source: "map",
    });

    // The outline belonged to the previous roof. Keeping it would leave a
    // shape floating over a building nobody drew it on.
    expect(useAssessmentStore.getState().roofPolygon).toBeNull();
    expect(storedSession()?.roofPolygon).toBeNull();
  });

  it("clears memory and removes the stored key on reset", () => {
    const store = useAssessmentStore.getState();
    store.setPropertySelection(PROPERTY);
    store.setRoofPolygon(ROOF);
    store.setEnergyInputs({ monthlyBillPhp: 4800 });
    store.setPlans({ primaryGoal: "reduce-bill", usagePattern: "balanced" });
    store.setContactDetails({ fullName: "Juana" });
    store.setResult({ is_provisional: true });

    useAssessmentStore.getState().reset();

    expect(useAssessmentStore.getState()).toMatchObject({
      result: null,
      selectedProperty: null,
      roofPolygon: null,
      energyInputs: DEFAULT_ENERGY_INPUTS,
      plans: DEFAULT_ASSESSMENT_PLANS,
      contactDetails: DEFAULT_CONTACT_DETAILS,
    });
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });
});
