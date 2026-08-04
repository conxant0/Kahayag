import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  canvasBomGroups,
  canvasSlots,
  diagramSourceOptions,
  getActiveBuild,
  summaryTiles,
} from "../../../../src/features/design/designViewModel";
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

  it("lists both solver builds and uploaded quotes as diagram sources", () => {
    const withoutQuote = diagramSourceOptions(mockDesignSession, []);
    expect(withoutQuote.map((option) => option.label)).toEqual([
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
    const withQuote = diagramSourceOptions(mockDesignSession, [quote]);
    expect(withQuote).toHaveLength(3);
    expect(withQuote[2]).toMatchObject({
      value: quoteAuditId(quote, 0),
      label: "installer.pdf",
      description: "From uploaded quote",
    });
  });
});
