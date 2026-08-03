import { describe, expect, it } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { buildPredictionConfidence } from "../../../../src/features/recommendation/predictionConfidence";

describe("prediction confidence", () => {
  it("reports a planning-level fallback when shading is absent", () => {
    const summary = buildPredictionConfidence({
      result: { ...fixture, shading: null },
      roofPolygon: null,
      energyInputs: { electricityRatePhpPerKwh: 12 },
    });

    expect(summary.factors.some((factor) => factor.confidence === "N/A")).toBe(true);
    expect(summary.advancedAnalysis).not.toContain("satellite shading map");
  });

  it("does not manufacture confidence data without a completed result", () => {
    expect(() => buildPredictionConfidence({ result: null })).toThrow(
      "completed assessment result",
    );
  });
});
