import { describe, expect, it } from "vitest";

import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import {
  buildPanelCountAdjustmentPayload,
  mergePanelAdjustment,
} from "../../../../src/features/results/panelCountAdjustment";

describe("panel count adjustment", () => {
  it("builds the request from the authoritative result context", () => {
    const payload = buildPanelCountAdjustmentPayload(fixture, 10);

    expect(payload.property).toEqual(fixture.property);
    expect(payload.roof).toEqual(fixture.roof);
    expect(payload.inputs).toEqual(fixture.inputs);
    expect(payload.requested_panel_count).toBe(10);
  });

  it("does not mutate the original result when merging a candidate", () => {
    const adjustment = {
      recommendation: { ...fixture.recommendation, panel_count: 10 },
      financials: { ...fixture.financials, estimated_base_cost_php: 270000 },
    };
    const next = mergePanelAdjustment(fixture, adjustment);

    expect(fixture.recommendation.panel_count).toBe(8);
    expect(next.recommendation.panel_count).toBe(10);
    expect(next.assumptions).toEqual(fixture.assumptions);
  });
});
