import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  compareBuilds,
  costPerWatt,
  formatCostPerWatt,
  formatInvestmentRange,
} from "../../../../src/features/compare/compareViewModel";

describe("compareViewModel", () => {
  it("orders AI suggested before custom build A", () => {
    const views = compareBuilds(mockDesignSession);
    expect(views).toHaveLength(2);
    expect(views[0]?.isSuggested).toBe(true);
    expect(views[0]?.build.label).toBe("AI suggested");
    expect(views[1]?.build.label).toBe("Custom build A");
  });

  it("computes distinct overview metrics per build", () => {
    const views = compareBuilds(mockDesignSession);
    expect(views[0]?.metrics.find((row) => row.label === "Total cost")?.value).toBe(
      "₱354,928–₱524,636",
    );
    expect(views[1]?.metrics.find((row) => row.label === "Total cost")?.value).toBe(
      "₱356,048–₱525,756",
    );
  });

  it("formats large investment ranges compactly on one line", () => {
    const build = {
      ...mockDesignSession.builds[0]!,
      total_investment_low_php: 6_789_530,
      total_investment_high_php: 9_407_076,
    };

    expect(formatInvestmentRange(build)).toBe("₱6.8M–₱9.4M");
  });

  it("formats cost per watt from domain totals", () => {
    const build = mockDesignSession.builds[0]!;
    expect(costPerWatt(build)).toBeCloseTo(build.total_investment_php / 5850, 2);
    expect(formatCostPerWatt(build)).toBe("₱75/W");
  });
});
