import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { compareQuotes } from "../../../../src/features/compare/quoteCompareViewModel";

const sampleQuote = {
  filename: "installer.pdf",
  extracted_total_php: 465_000,
  extracted_system_kwp: 5.2,
  extracted_panel_count: 12,
  benchmark_total_php: 440_000,
  benchmark_system_kwp: 5.85,
  findings: [{ category: "pricing", severity: "warning" as const, message: "Above benchmark" }],
  summary: "The uploaded quote runs above the Kahayag benchmark.",
  diagram_components: mockDesignSession.builds[0]!.components.slice(0, 4),
};

describe("quote compare view model", () => {
  it("maps uploaded quotes into overview and technical rows", () => {
    const [view] = compareQuotes([sampleQuote]);

    expect(view?.label).toBe("installer.pdf");
    expect(view?.overviewSpecs.some((row) => row.label === "Panels")).toBe(true);
    expect(view?.technicalRows.some((row) => row.label === "System size")).toBe(true);
    expect(view?.technicalRows.some((row) => row.label === "Kahayag benchmark")).toBe(true);
    expect(view?.benchmarkDeltaLabel).toContain("above benchmark");
  });

  it("creates one card view per uploaded quote", () => {
    const views = compareQuotes([
      sampleQuote,
      { ...sampleQuote, filename: "installer-b.pdf", extracted_total_php: 420_000 },
    ]);

    expect(views).toHaveLength(2);
    expect(views.map((view) => view.label)).toEqual([
      "installer.pdf",
      "installer-b.pdf",
    ]);
  });
});
