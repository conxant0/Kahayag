import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  canvasBomGroups,
  canvasSlots,
  getActiveBuild,
  summaryTiles,
} from "../../../../src/features/design/designViewModel";

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
});
