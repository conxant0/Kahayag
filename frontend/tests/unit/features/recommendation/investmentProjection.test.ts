import { describe, expect, it } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import {
  buildGrowthBars,
  buildInvestmentDefaults,
  buildInvestmentProjectionPayload,
} from "../../../../src/features/recommendation/investmentProjection";

describe("investment projection display adapter", () => {
  it("uses authoritative resolved assessment inputs for slider defaults", () => {
    expect(buildInvestmentDefaults(fixture)).toMatchObject({
      electricityRatePhpPerKwh: 12,
      systemCostPhp: 216000,
      monthlyUsageKwh: 500,
    });
  });

  it("sends raw what-if inputs and the completed assessment to the backend", () => {
    expect(
      buildInvestmentProjectionPayload(fixture, {
        electricityRatePhpPerKwh: 15,
        systemCostPhp: 250000,
        monthlyUsageKwh: 300,
      }),
    ).toEqual({
      assessment: fixture,
      electricity_rate_php_per_kwh: 15,
      system_cost_php: 250000,
      monthly_consumption_kwh: 300,
    });
  });

  it("normalizes backend milestone values only for bar height display", () => {
    expect(
      buildGrowthBars([
        { year: 6, cumulative_net_php: -80000 },
        { year: 12, cumulative_net_php: 40000 },
        { year: 18, cumulative_net_php: 160000 },
        { year: 25, cumulative_net_php: 240000 },
      ]),
    ).toEqual([
      { year: 6, heightPct: 8 },
      { year: 12, heightPct: 17 },
      { year: 18, heightPct: 67 },
      { year: 25, heightPct: 100 },
    ]);
  });
});
