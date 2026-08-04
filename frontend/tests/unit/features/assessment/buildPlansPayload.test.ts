import { describe, expect, it } from "vitest";

import { buildPlansPayload } from "../../../../src/features/assessment/buildPlansPayload";
import { DEFAULT_ASSESSMENT_PLANS } from "../../../../src/state/assessmentStore";

describe("buildPlansPayload", () => {
  it("returns undefined when no plan answers exist", () => {
    expect(buildPlansPayload(DEFAULT_ASSESSMENT_PLANS)).toBeUndefined();
  });

  it("serializes answered plans for design bootstrap", () => {
    expect(
      buildPlansPayload({
        ...DEFAULT_ASSESSMENT_PLANS,
        primaryGoal: "backup-outages",
        usagePattern: "nighttime",
        futureLoads: ["aircon"],
        roofMaterial: "metal",
      }),
    ).toEqual({
      primary_goal: "backup-outages",
      usage_pattern: "nighttime",
      future_loads: ["aircon"],
      roof_material: "metal",
      property_kind: null,
      owns_property: null,
      timeline: null,
    });
  });
});
