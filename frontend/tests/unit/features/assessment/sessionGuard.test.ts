// Verifies an incomplete session is sent back to the step that fills the gap.
import { describe, expect, it } from "vitest";

import { resolveRedirectForStep } from "../../../../src/features/assessment/sessionGuard";
import { roofPolygonFixture } from "../../../fixtures/roofPolygonFixture";
import {
  DEFAULT_ASSESSMENT_PLANS,
  DEFAULT_CONTACT_DETAILS,
  DEFAULT_ENERGY_INPUTS,
  type PersistedSession,
  type SelectedProperty,
} from "../../../../src/state/assessmentStore";

const PROPERTY: SelectedProperty = {
  placeId: "place-1",
  name: "Pajo",
  address: "Pajo, Lapu-Lapu City",
  latitude: 10.3103,
  longitude: 123.9494,
  source: "search",
};

const ROOF = roofPolygonFixture({
  coordinates: [
    { latitude: 10.3103, longitude: 123.9494 },
    { latitude: 10.3104, longitude: 123.9494 },
    { latitude: 10.3104, longitude: 123.9495 },
  ],
  areaSquareMeters: 48,
});

function session(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    selectedProperty: PROPERTY,
    roofPolygon: ROOF,
    energyInputs: { ...DEFAULT_ENERGY_INPUTS, monthlyBillPhp: 4800 },
    plans: {
      ...DEFAULT_ASSESSMENT_PLANS,
      primaryGoal: "reduce-bill",
      usagePattern: "daytime",
    },
    contactDetails: { ...DEFAULT_CONTACT_DETAILS },
    ...overrides,
  };
}

describe("resolveRedirectForStep", () => {
  it("lets a complete session stay on any step", () => {
    expect(resolveRedirectForStep("energy", session())).toBeNull();
    expect(resolveRedirectForStep("plans", session())).toBeNull();
    expect(resolveRedirectForStep("loading", session())).toBeNull();
  });

  it("keeps /plans open for the session it is about to collect answers from", () => {
    const unanswered = session({ plans: { ...DEFAULT_ASSESSMENT_PLANS } });

    expect(resolveRedirectForStep("plans", unanswered)).toBeNull();
  });

  it("sends /loading back to the plans step until both required answers exist", () => {
    // Only the goal and the usage pattern gate the flow; every optional
    // answer left blank must not hold it.
    const unanswered = session({ plans: { ...DEFAULT_ASSESSMENT_PLANS } });
    const goalOnly = session({
      plans: { ...DEFAULT_ASSESSMENT_PLANS, primaryGoal: "backup-outages" },
    });

    expect(resolveRedirectForStep("loading", unanswered)).toBe("/plans");
    expect(resolveRedirectForStep("loading", goalOnly)).toBe("/plans");
    expect(resolveRedirectForStep("loading", session())).toBeNull();
  });

  it("keeps /energy open for the session it is about to collect a bill from", () => {
    const withoutBill = session({
      energyInputs: { ...DEFAULT_ENERGY_INPUTS, monthlyBillPhp: null },
    });

    expect(resolveRedirectForStep("energy", withoutBill)).toBeNull();
  });

  it("sends /loading back to the bill when none was entered", () => {
    const withoutBill = session({
      energyInputs: { ...DEFAULT_ENERGY_INPUTS, monthlyBillPhp: null },
    });

    expect(resolveRedirectForStep("loading", withoutBill)).toBe("/energy");
  });

  it("sends both steps back to tracing when no roof was drawn", () => {
    const withoutRoof = session({ roofPolygon: null });

    expect(resolveRedirectForStep("energy", withoutRoof)).toBe("/trace");
    expect(resolveRedirectForStep("loading", withoutRoof)).toBe("/trace");
  });

  it("sends both steps back to the map when no property was chosen", () => {
    const withoutProperty = session({ selectedProperty: null });

    expect(resolveRedirectForStep("energy", withoutProperty)).toBe("/locate");
    expect(resolveRedirectForStep("loading", withoutProperty)).toBe("/locate");
  });

  it("reports the earliest gap, not the nearest one", () => {
    // An empty session is missing all three. Sending it to /energy would ask
    // for a bill against a roof nobody traced on a property nobody picked.
    const empty = session({
      selectedProperty: null,
      roofPolygon: null,
      energyInputs: { ...DEFAULT_ENERGY_INPUTS, monthlyBillPhp: null },
    });

    expect(resolveRedirectForStep("loading", empty)).toBe("/locate");
  });

  it("treats a non-positive bill as no bill", () => {
    const zeroBill = session({
      energyInputs: { ...DEFAULT_ENERGY_INPUTS, monthlyBillPhp: 0 },
    });

    expect(resolveRedirectForStep("loading", zeroBill)).toBe("/energy");
  });
});
