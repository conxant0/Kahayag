import { describe, expect, it } from "vitest";

import type { AssessmentResult } from "../../../../src/shared/api/types";
import {
  formatCostRange,
  formatOffset,
  formatPaybackYears,
  formatPeso,
  readAssessmentResult,
} from "../../../../src/features/assessment/formatAssessmentResult";
import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";

describe("assessment result formatting", () => {
  it("narrows and formats the representative completed assessment", () => {
    const result = readAssessmentResult(fixture);

    expect(result).not.toBeNull();
    expect(formatPeso(result?.financials.annual_savings_php)).toBe("₱22,704");
    expect(formatCostRange(result!)).toBe("₱180,000–₱252,000");
    expect(formatOffset(result!)).toBe("32%");
    expect(formatPaybackYears(result!)).toBe("9.5 years");
  });

  it("returns null for an absent or non-object result", () => {
    expect(readAssessmentResult(null)).toBeNull();
    expect(readAssessmentResult({} as AssessmentResult)).toBeNull();
  });
});
