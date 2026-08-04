import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { peso } from "../../../../src/shared/lib/currency";
import {
  compareBuilds,
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
    const suggested = mockDesignSession.builds[0]!;
    const custom = mockDesignSession.builds[1]!;
    expect(views[0]?.metrics.find((row) => row.label === "Total cost")?.value).toBe(
      peso(suggested.total_investment_php),
    );
    expect(views[1]?.metrics.find((row) => row.label === "Total cost")?.value).toBe(
      peso(custom.total_investment_php),
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

  it("shows no client-computed figures among the metrics", () => {
    const views = compareBuilds(mockDesignSession);
    for (const view of views) {
      expect(view.metrics.map((row) => row.label)).not.toContain("Cost per watt");
      expect(view.technicalRows.map((row) => row.label)).not.toContain(
        "Cost per watt",
      );
    }
  });
});
