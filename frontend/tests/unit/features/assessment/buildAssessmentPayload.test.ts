// Verifies the request body sent to POST /assessments matches the backend contract.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAssessmentPayload } from "../../../../src/features/assessment/buildAssessmentPayload";
import {
  DEFAULT_ENERGY_INPUTS,
  type EnergyInputs,
  type RoofPolygon,
  type SelectedProperty,
} from "../../../../src/state/assessmentStore";

const PROPERTY: SelectedProperty = {
  placeId: "place-1",
  name: "Pajo",
  address: "Pajo, Lapu-Lapu City",
  latitude: 10.31034567,
  longitude: 123.94941234,
  source: "search",
};

const ROOF: RoofPolygon = {
  id: "roof-1",
  propertyId: "place-1",
  coordinates: [
    { latitude: 10.3103, longitude: 123.9494 },
    { latitude: 10.3104, longitude: 123.9494 },
    { latitude: 10.3104, longitude: 123.9495 },
  ],
  areaSquareMeters: 48,
  perimeterMeters: 28,
  createdAt: "2026-08-03T00:00:00.000Z",
};

function energy(changes: Partial<EnergyInputs> = {}): EnergyInputs {
  return { ...DEFAULT_ENERGY_INPUTS, monthlyBillPhp: 4800, ...changes };
}

describe("buildAssessmentPayload", () => {
  beforeEach(() => {
    // The assessment date is the homeowner's calendar day, so the clock is
    // pinned rather than the timezone.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the full contract from a complete session", () => {
    const payload = buildAssessmentPayload({
      selectedProperty: PROPERTY,
      roofPolygon: ROOF,
      energyInputs: energy(),
    });

    expect(payload).toEqual({
      property: {
        address: "Pajo, Lapu-Lapu City",
        latitude: "10.3103",
        longitude: "123.9494",
        assessment_date: "2026-08-03",
      },
      roof: { area_m2: "48.00", usable_area_m2: "48.00" },
      inputs: {
        monthly_bill_php: 4800,
        monthly_consumption_kwh: "400.00",
        electricity_rate_php_per_kwh: "12.00",
        panel_category_id: "standard-450",
      },
    });
  });

  it("uses the default rate when the session carries no override", () => {
    const payload = buildAssessmentPayload({
      selectedProperty: PROPERTY,
      roofPolygon: ROOF,
      energyInputs: energy(),
    });

    expect(payload.inputs.electricity_rate_php_per_kwh).toBe("12.00");
  });

  it("rejects a missing property rather than standing in a demo one", () => {
    expect(() =>
      buildAssessmentPayload({
        selectedProperty: null,
        roofPolygon: ROOF,
        energyInputs: energy(),
      }),
    ).toThrow(/choose a property/i);
  });

  it("rejects a missing roof rather than assuming a nominal area", () => {
    expect(() =>
      buildAssessmentPayload({
        selectedProperty: PROPERTY,
        roofPolygon: null,
        energyInputs: energy(),
      }),
    ).toThrow(/trace your roof/i);
  });

  it("rejects a missing bill rather than inventing one", () => {
    expect(() =>
      buildAssessmentPayload({
        selectedProperty: PROPERTY,
        roofPolygon: ROOF,
        energyInputs: energy({ monthlyBillPhp: null }),
      }),
    ).toThrow(/monthly electricity bill/i);
  });

  it("rejects a non-positive electricity rate", () => {
    expect(() =>
      buildAssessmentPayload({
        selectedProperty: PROPERTY,
        roofPolygon: ROOF,
        energyInputs: energy({ electricityRatePhpPerKwh: 0 }),
      }),
    ).toThrow(/greater than zero/i);
  });

  it("includes the budget only when one was entered", () => {
    const withBudget = buildAssessmentPayload({
      selectedProperty: PROPERTY,
      roofPolygon: ROOF,
      energyInputs: energy({ budgetPhp: 300000 }),
    });
    const withoutBudget = buildAssessmentPayload({
      selectedProperty: PROPERTY,
      roofPolygon: ROOF,
      energyInputs: energy({ budgetPhp: null }),
    });

    expect(withBudget.inputs.budget_php).toBe(300000);
    expect(withoutBudget.inputs).not.toHaveProperty("budget_php");
  });

  it("rounds coordinates to four places and areas to two", () => {
    const payload = buildAssessmentPayload({
      selectedProperty: PROPERTY,
      roofPolygon: { ...ROOF, areaSquareMeters: 61.239 },
      energyInputs: energy(),
    });

    expect(payload.property.latitude).toBe("10.3103");
    expect(payload.property.longitude).toBe("123.9494");
    expect(payload.roof.area_m2).toBe("61.24");
  });

  it("dates the assessment by the local calendar day", () => {
    // Late evening UTC is already tomorrow in Manila. Whichever zone the suite
    // runs in, the date has to be the one on the homeowner's own calendar —
    // `toISOString().slice(0, 10)` would report the UTC day instead.
    const instant = new Date("2026-08-03T20:00:00Z");
    vi.setSystemTime(instant);

    const payload = buildAssessmentPayload({
      selectedProperty: PROPERTY,
      roofPolygon: ROOF,
      energyInputs: energy(),
    });

    expect(payload.property.assessment_date).toBe(
      instant.toLocaleDateString("en-CA"),
    );
  });
});
