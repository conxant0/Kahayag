import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { compareBuilds } from "../../../../src/features/compare/compareViewModel";

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

  it("shows no client-computed figures among the metrics", () => {
    // Hard rule 1: the compare view only formats domain-provided values —
    // a cost-per-watt (or any other derived money figure) must come from
    // the build payload, not a client-side division.
    const views = compareBuilds(mockDesignSession);
    for (const view of views) {
      expect(view.metrics.map((row) => row.label)).not.toContain("Cost per watt");
      expect(view.technicalRows.map((row) => row.label)).not.toContain(
        "Cost per watt",
      );
    }
  });
});
