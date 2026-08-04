import { describe, expect, it } from "vitest";

import { classifyMessageIntent } from "../../../../src/features/design/designChatIntent";

describe("classifyMessageIntent", () => {
  it("treats grounded questions as read-only", () => {
    expect(classifyMessageIntent("Why this inverter size?")).toBe("question");
    expect(classifyMessageIntent("How is payback calculated?")).toBe("question");
    expect(
      classifyMessageIntent("Would a solar panel system work without a battery storage?"),
    ).toBe("question");
  });

  it("treats design edits as change requests", () => {
    expect(classifyMessageIntent("Add two more panels")).toBe("change");
    expect(classifyMessageIntent("Optimise for my budget")).toBe("change");
    expect(classifyMessageIntent("Generate a quotation for this build")).toBe("change");
    expect(classifyMessageIntent("Add backup for blackouts under my budget")).toBe("change");
  });

  it("routes diagnostic agent requests as changes", () => {
    expect(classifyMessageIntent("What got rejected in the last solve?")).toBe("question");
    expect(classifyMessageIntent("List compatible panels")).toBe("change");
  });
});
