import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  compareBuilds,
  costPerWatt,
  formatCostPerWatt,
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
      "₱379,456",
    );
    expect(views[1]?.metrics.find((row) => row.label === "Total cost")?.value).toBe(
      "₱380,576",
    );
  });

  it("formats cost per watt from domain totals", () => {
    const build = mockDesignSession.builds[0]!;
    expect(costPerWatt(build)).toBeCloseTo(379456 / 5850, 2);
    expect(formatCostPerWatt(build)).toBe("₱65/W");
  });
});
