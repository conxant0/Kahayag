import { describe, expect, it } from "vitest";

import { mockDesignSession, mockDesignSessionWithCustom } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  compareColumns,
  comparisonMatrix,
  defaultComparePair,
  resolveComparePair,
} from "../../../../src/features/compare/compareColumnsViewModel";
import { quoteAuditId } from "../../../../src/features/compare/quoteAuditIds";

const sampleQuote = {
  filename: "installer.pdf",
  extracted_total_php: 250_000,
  extracted_system_kwp: 5.2,
  extracted_panel_count: 12,
  benchmark_total_php: 440_000,
  benchmark_system_kwp: 5.85,
  findings: [],
  summary: "Quote summary",
  diagram_components: mockDesignSession.builds[0]!.components.slice(0, 4),
};

describe("compareColumnsViewModel", () => {
  it("builds solver columns and adds quote when diagram components exist", () => {
    const columns = compareColumns(mockDesignSession, []);
    expect(columns).toHaveLength(1);
    expect(columns.map((column) => column.label)).toEqual(["AI suggested"]);

    const withQuote = compareColumns(mockDesignSessionWithCustom, [sampleQuote]);

    expect(withQuote).toHaveLength(3);
    expect(withQuote[2]?.label).toBe("installer.pdf");
  });

  it("includes custom builds only when present in the session", () => {
    const columns = compareColumns(mockDesignSessionWithCustom, []);
    expect(columns).toHaveLength(2);
    expect(columns.map((column) => column.label)).toEqual([
      "AI suggested",
      "Custom build A",
    ]);
  });

  it("aligns spec values across columns in a matrix", () => {
    const columns = compareColumns(mockDesignSessionWithCustom, []);
    const pair = resolveComparePair(
      columns,
      columns[0]!.id,
      columns[1]!.id,
    );
    const rows = comparisonMatrix(pair);

    expect(rows.find((row) => row.label === "System size")?.values).toEqual([
      "5.85 kWp",
      "5.85 kWp",
    ]);
    expect(rows.find((row) => row.label === "Inverter")?.values[0]).toContain(
      "Solis",
    );
    expect(rows.find((row) => row.label === "Inverter")?.values[1]).toContain(
      "GoodWe",
    );
  });

  it("defaults to suggested vs quote when a quote diagram exists", () => {
    const columns = compareColumns(mockDesignSessionWithCustom, [sampleQuote]);

    const [left, right] = defaultComparePair(columns);
    expect(left).toBe(columns[0]!.id);
    expect(right).toBe(quoteAuditId(sampleQuote, 0));
  });

  it("adds a compare column for each uploaded quote", () => {
    const secondQuote = {
      ...sampleQuote,
      filename: "installer-b.pdf",
      extracted_total_php: 260_000,
    };
    const columns = compareColumns(mockDesignSessionWithCustom, [sampleQuote, secondQuote]);

    expect(columns.filter((column) => column.kind === "quote")).toHaveLength(2);
    const [left, right] = defaultComparePair(columns);
    expect(right).toBe(quoteAuditId(secondQuote, 1));
    expect(left).toBe(columns[0]!.id);
  });
});
