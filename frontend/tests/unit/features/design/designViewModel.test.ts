import { describe, expect, it } from "vitest";

import { mockDesignSession, mockDesignSessionWithCustom } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  canvasBomGroups,
  canvasSlots,
  canvasSlotsFromComponents,
  diagramSourceOptions,
  getActiveBuild,
  summaryTiles,
} from "../../../../src/features/design/designViewModel";
import type { DesignComponent } from "../../../../src/shared/api/types";
import { quoteAuditId } from "../../../../src/features/compare/quoteAuditIds";

describe("designViewModel", () => {
  it("selects the active build and summary tiles", () => {
    const build = getActiveBuild(mockDesignSession);
    expect(build?.label).toBe("AI suggested");

    const tiles = summaryTiles(build);
    expect(tiles).toHaveLength(3);
    expect(tiles[0]?.label).toBe("Energy capture");
  });

  it("maps canvas slots including optional battery placeholder", () => {
    const build = getActiveBuild(mockDesignSession);
    const slots = canvasSlots(build);
    expect(slots).toHaveLength(4);
    expect(slots.some((slot) => slot.slot === "panel")).toBe(true);
  });

  it("aggregates all balance-of-system costs in simplified canvas slots", () => {
    const build = getActiveBuild(mockDesignSession);
    const groups = canvasBomGroups(build);
    const protectionSlot = canvasSlots(build).find((slot) => slot.slot === "protection");

    const bosTotal = groups.reduce(
      (sum, group) =>
        sum + group.components.reduce((groupSum, component) => groupSum + component.line_total_php, 0),
      0,
    );
    expect(protectionSlot?.line_total_php).toBe(bosTotal);
    expect(protectionSlot?.model).toMatch(/items$/);
    expect(protectionSlot?.summary).toBe("Balance of system");
  });

  it("aggregates uploaded quote balance-of-system lines in simplified slots", () => {
    const quoteBosLine = (
      slot: DesignComponent["slot"],
      summary: string,
      lineTotal: number,
    ): DesignComponent => ({
      slot,
      catalog_id: null,
      brand: "Quoted",
      model: "—",
      summary,
      qty: 1,
      unit: "pcs",
      unit_price_php: lineTotal,
      price_as_of: null,
      line_total_php: lineTotal,
      warranty_note: "From uploaded quote",
      badges: ["FROM QUOTE"],
      specs: {},
    });

    const slots = canvasSlotsFromComponents([
      quoteBosLine("protection", "Circuit Breakers", 788),
      quoteBosLine("structure", "Frames Mounting Panel", 357),
      quoteBosLine("electrical", "Wires", 315),
      quoteBosLine("installation", "Labor Cost", 315),
    ]);
    const bosSlot = slots.find((slot) => slot.slot === "protection");

    expect(bosSlot?.line_total_php).toBe(1_775);
    expect(bosSlot).toMatchObject({
      brand: "Quoted",
      model: "4 items",
      summary: "Balance of system",
      badges: ["FROM QUOTE"],
    });
  });

  it("groups balance-of-system lines for the full canvas view", () => {
    const build = getActiveBuild(mockDesignSession);
    const groups = canvasBomGroups(build);
    expect(groups.map((group) => group.slot)).toEqual([
      "protection",
      "structure",
      "electrical",
      "installation",
    ]);
    expect(groups.find((group) => group.slot === "structure")?.components).toHaveLength(1);
    expect(groups.find((group) => group.slot === "electrical")?.components.length).toBeGreaterThan(
      1,
    );
  });

  it("lists AI suggested and custom builds when present", () => {
    const withoutQuote = diagramSourceOptions(mockDesignSession, []);
    expect(withoutQuote.map((option) => option.label)).toEqual(["AI suggested"]);

    const withCustom = diagramSourceOptions(mockDesignSessionWithCustom, []);
    expect(withCustom.map((option) => option.label)).toEqual([
      "AI suggested",
      "Custom build A",
    ]);

    const quote = {
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
    const withQuote = diagramSourceOptions(mockDesignSessionWithCustom, [quote]);
    expect(withQuote).toHaveLength(3);
    expect(withQuote[2]).toMatchObject({
      value: quoteAuditId(quote, 0),
      label: "installer.pdf",
      description: "From uploaded quote",
    });
  });
});
