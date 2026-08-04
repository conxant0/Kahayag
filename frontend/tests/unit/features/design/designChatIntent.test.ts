import { describe, expect, it } from "vitest";

import { classifyMessageIntent } from "../../../../src/features/design/designChatIntent";

describe("classifyMessageIntent", () => {
  it("treats grounded questions as read-only", () => {
    expect(classifyMessageIntent("Why this inverter size?")).toBe("question");
    expect(classifyMessageIntent("How is payback calculated?")).toBe("question");
  });

  it("treats design edits as change requests", () => {
    expect(classifyMessageIntent("Add two more panels")).toBe("change");
    expect(classifyMessageIntent("Optimise for my budget")).toBe("change");
  });
});
