// Verifies the display-only estimate shown while the bill is being typed.
import { describe, expect, it } from "vitest";

import {
  computeLiveEstimate,
  formatLiveEstimatePayback,
  formatLiveEstimateSystemSize,
  resolveRoofAreaSquareMeters,
} from "../../../../src/features/assessment/liveEstimate";
import { MIN_VALID_ROOF_AREA_SQUARE_METERS } from "../../../../src/features/roof/roofUtils";
import type { RoofPolygon } from "../../../../src/state/assessmentStore";

const ROOF: RoofPolygon = {
  id: "roof-1",
  propertyId: null,
  coordinates: [],
  areaSquareMeters: 60,
  perimeterMeters: 31,
  createdAt: "2026-08-03T00:00:00.000Z",
};

describe("resolveRoofAreaSquareMeters", () => {
  it("uses the traced area when there is one", () => {
    expect(resolveRoofAreaSquareMeters(ROOF)).toBe(60);
  });

  it("floors a sliver at the smallest area the tracer accepts", () => {
    expect(
      resolveRoofAreaSquareMeters({ ...ROOF, areaSquareMeters: 0.4 }),
    ).toBe(MIN_VALID_ROOF_AREA_SQUARE_METERS);
  });
});

describe("computeLiveEstimate", () => {
  it("returns nothing until there is a bill to estimate from", () => {
    expect(
      computeLiveEstimate({ monthlyBillPhp: null, roofAreaSquareMeters: 60 }),
    ).toBeNull();
    expect(
      computeLiveEstimate({ monthlyBillPhp: 0, roofAreaSquareMeters: 60 }),
    ).toBeNull();
  });

  it("returns nothing when the rate is not usable", () => {
    expect(
      computeLiveEstimate({
        monthlyBillPhp: 4800,
        electricityRatePhpPerKwh: 0,
        roofAreaSquareMeters: 60,
      }),
    ).toBeNull();
  });

  it("sizes the system to demand when the roof has room to spare", () => {
    // 4800 / 12 = 400 kWh a month, 4800 a year; at 1460 kWh per kWp that is
    // 3.29 kWp, which is 7 panels of 450 W.
    const estimate = computeLiveEstimate({
      monthlyBillPhp: 4800,
      roofAreaSquareMeters: 200,
    });

    expect(estimate).not.toBeNull();
    expect(estimate?.panelCount).toBe(7);
    expect(estimate?.systemCapacityKwp).toBe(3.15);
    expect(estimate?.paybackYears).toBeGreaterThan(0);
  });

  it("is limited by the roof when the roof is the smaller constraint", () => {
    const roomy = computeLiveEstimate({
      monthlyBillPhp: 40000,
      roofAreaSquareMeters: 200,
    });
    const cramped = computeLiveEstimate({
      monthlyBillPhp: 40000,
      roofAreaSquareMeters: 20,
    });

    expect(cramped?.panelCount).toBe(10);
    expect(roomy?.panelCount).toBeGreaterThan(cramped?.panelCount ?? 0);
  });

  it("is limited by the budget when one is set", () => {
    const unbudgeted = computeLiveEstimate({
      monthlyBillPhp: 12000,
      roofAreaSquareMeters: 200,
    });
    const budgeted = computeLiveEstimate({
      monthlyBillPhp: 12000,
      roofAreaSquareMeters: 200,
      budgetPhp: 150000,
    });

    // 150,000 buys five panels at 27,000 each.
    expect(budgeted?.panelCount).toBe(5);
    expect(unbudgeted?.panelCount).toBeGreaterThan(5);
  });

  it("still shows one panel when the budget cannot afford even that", () => {
    const estimate = computeLiveEstimate({
      monthlyBillPhp: 4800,
      roofAreaSquareMeters: 200,
      budgetPhp: 1000,
    });

    expect(estimate?.panelCount).toBe(1);
  });

  it("returns nothing when the roof cannot hold a single panel", () => {
    expect(
      computeLiveEstimate({ monthlyBillPhp: 4800, roofAreaSquareMeters: 1 }),
    ).toBeNull();
  });
});

describe("live estimate formatting", () => {
  it("shows a dash rather than a zero before there is an estimate", () => {
    expect(formatLiveEstimateSystemSize(null)).toBe("—");
    expect(formatLiveEstimatePayback(null)).toBe("—");
  });

  it("shows one decimal place", () => {
    expect(formatLiveEstimateSystemSize(3.6)).toBe("3.6");
    expect(formatLiveEstimatePayback(6)).toBe("6.0");
  });
});
