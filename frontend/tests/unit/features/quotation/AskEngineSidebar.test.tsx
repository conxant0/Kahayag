import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import { AskEngineSidebar } from "../../../../src/features/quotation/AskEngineSidebar";

const explainMutateAsync = vi.fn();

vi.mock("../../../../src/features/design/useDesignActions", () => ({
  useExplainDesign: () => ({
    mutateAsync: explainMutateAsync,
    isPending: false,
    error: null,
  }),
}));

describe("AskEngineSidebar", () => {
  beforeEach(() => {
    explainMutateAsync.mockReset();
  });

  it("shows a build welcome and answers grounded questions", async () => {
    explainMutateAsync.mockResolvedValue({
      explanation: "This inverter matches your roof size.",
    });
    const build = mockDesignSession.builds[0]!;

    render(
      <AskEngineSidebar mode="build" activeBuild={build} activeQuote={null} />,
    );

    expect(screen.getByText(/5\.85 kWp \(13 panels\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How does fit score work?" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type a question…"), {
      target: { value: "Why this inverter?" },
    });
    fireEvent.click(screen.getByLabelText("Send question"));

    await waitFor(() =>
      expect(screen.getByText("This inverter matches your roof size.")).toBeInTheDocument(),
    );
    expect(explainMutateAsync).toHaveBeenCalledWith("Why this inverter?");
  });

  it("answers hypothetical questions through explain", async () => {
    explainMutateAsync.mockResolvedValue({
      explanation: "You can add a battery later if the inverter supports it.",
    });
    const build = mockDesignSession.builds[0]!;

    render(
      <AskEngineSidebar mode="build" activeBuild={build} activeQuote={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Can I drop the battery later?" }));

    await waitFor(() =>
      expect(
        screen.getByText("You can add a battery later if the inverter supports it."),
      ).toBeInTheDocument(),
    );
    expect(explainMutateAsync).toHaveBeenCalledWith("Can I drop the battery later?");
  });

  it("redirects live design change requests without calling explain", async () => {
    const build = mockDesignSession.builds[0]!;

    render(
      <AskEngineSidebar mode="build" activeBuild={build} activeQuote={null} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Why was this inverter chosen?" }),
    );

    await waitFor(() => expect(explainMutateAsync).toHaveBeenCalled());
    explainMutateAsync.mockReset();

    fireEvent.change(screen.getByPlaceholderText("Type a question…"), {
      target: { value: "Add backup for blackouts under my budget" },
    });
    fireEvent.click(screen.getByLabelText("Send question"));

    await waitFor(() =>
      expect(screen.getByText(/Design changes happen on the Design page/)).toBeInTheDocument(),
    );
    expect(explainMutateAsync).not.toHaveBeenCalled();
  });

  it("shows quote-specific prompts in quote mode", async () => {
    explainMutateAsync.mockResolvedValue({
      explanation: "The quote is higher because labour is bundled separately.",
    });

    render(
      <AskEngineSidebar
        mode="quote"
        activeBuild={null}
        activeQuote={{
          filename: "installer.pdf",
          extracted_total_php: 465_000,
          extracted_system_kwp: 5.2,
          extracted_panel_count: 12,
          benchmark_total_php: 440_000,
          benchmark_system_kwp: 5.85,
          findings: [],
          summary: "Uploaded quote summary.",
          diagram_components: [],
        }}
      />,
    );

    expect(screen.getByText(/uploaded installer quote/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Why is this quote higher/i }));

    await waitFor(() =>
      expect(
        screen.getByText("The quote is higher because labour is bundled separately."),
      ).toBeInTheDocument(),
    );
    expect(explainMutateAsync.mock.calls[0]?.[0]).toContain("uploaded installer quote");
  });
});
