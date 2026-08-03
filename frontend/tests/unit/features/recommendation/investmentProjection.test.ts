import { describe, expect, it } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import {
  buildInvestmentDefaults,
  computeInvestmentProjection,
} from "../../../../src/features/recommendation/investmentProjection";

describe("investment projection", () => {
  it("starts from backend financials and keeps today's-peso assumptions", () => {
    const defaults = buildInvestmentDefaults(fixture);
    const projection = computeInvestmentProjection(defaults);

    expect(defaults.systemCostPhp).toBe(216000);
    expect(defaults.annualSavingsPhp).toBe(22704);
    expect(projection.assumptions.electricityEscalationRatio).toBe(0);
    expect(projection.assumptions.annualPanelDegradationRatio).toBe(0.005);
    expect(projection.growthBars).toHaveLength(4);
  });
});
