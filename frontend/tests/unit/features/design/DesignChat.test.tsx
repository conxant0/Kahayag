import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DesignChat } from "../../../../src/features/design/DesignChat";

const explainMutateAsync = vi.fn();
const agentMutateAsync = vi.fn();
const optimiseMutateAsync = vi.fn();

vi.mock("../../../../src/features/design/useDesignActions", () => ({
  useExplainDesign: () => ({
    mutateAsync: explainMutateAsync,
    isPending: false,
    error: null,
  }),
  useDesignAgent: () => ({
    mutateAsync: agentMutateAsync,
    isPending: false,
    error: null,
  }),
  useOptimiseDesign: () => ({
    mutateAsync: optimiseMutateAsync,
    isPending: false,
    error: null,
  }),
}));

describe("DesignChat", () => {
  it("answers questions in build mode without applying changes", async () => {
    explainMutateAsync.mockResolvedValue({
      explanation: "This inverter matches your roof size.",
    });

    render(<DesignChat />);

    fireEvent.change(screen.getByLabelText("Design assistant message"), {
      target: { value: "Why this inverter?" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() =>
      expect(screen.getByText("This inverter matches your roof size.")).toBeInTheDocument(),
    );
    expect(explainMutateAsync).toHaveBeenCalledWith("Why this inverter?");
    expect(agentMutateAsync).not.toHaveBeenCalled();
  });

  it("shows a confirmation card for change requests in ask mode", async () => {
    agentMutateAsync.mockResolvedValue({
      reply: "I can apply design update: Add two more panels. Apply when you're ready.",
      requires_confirmation: true,
      planned_actions: [{ name: "update_build", arguments: {} }],
    });

    render(<DesignChat />);
    fireEvent.click(screen.getByRole("tab", { name: "Ask" }));
    fireEvent.change(screen.getByLabelText("Design assistant message"), {
      target: { value: "Add two more panels" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument(),
    );
    expect(agentMutateAsync).toHaveBeenCalledWith({
      user_text: "Add two more panels",
      dry_run: true,
    });
  });
});
