import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  askEngineChangeRedirectCopy,
  askEngineFollowUpQuestions,
  askEngineTopChips,
  askEngineWelcomeCopy,
  formatQuestionForExplain,
} from "../../../../src/features/quotation/askEngineViewModel";

describe("askEngineViewModel", () => {
  const build = mockDesignSession.builds[0]!;

  it("builds a welcome message from the active build", () => {
    expect(
      askEngineWelcomeCopy({ mode: "build", build, quote: null }),
    ).toMatch(/5\.85 kWp \(13 panels\)/);
    expect(
      askEngineWelcomeCopy({ mode: "build", build, quote: null }),
    ).toMatch(/no battery \(grid-tie\)/);
  });

  it("builds a welcome message for uploaded quotes", () => {
    const welcome = askEngineWelcomeCopy({
      mode: "quote",
      build: null,
      quote: {
        filename: "installer.pdf",
        extracted_total_php: 465_000,
        extracted_system_kwp: 5.2,
        extracted_panel_count: 12,
        benchmark_total_php: 440_000,
        benchmark_system_kwp: 5.85,
        findings: [],
        summary: "Uploaded quote summary.",
        diagram_components: [],
      },
    });

    expect(welcome).toContain("₱465,000");
    expect(welcome).toContain("5.2 kW");
    expect(welcome).toContain("₱25,000 above");
  });

  it("returns quote-specific chips and follow-ups in quote mode", () => {
    expect(askEngineTopChips({ mode: "quote" })[0]).toContain("higher");
    expect(askEngineFollowUpQuestions({ mode: "quote" })[0]).toContain("compatible");
  });

  it("augments explain questions with quote audit context", () => {
    const question = formatQuestionForExplain("Why is this high?", {
      mode: "quote",
      quote: {
        filename: "installer.pdf",
        extracted_total_php: 465_000,
        extracted_system_kwp: 5.2,
        extracted_panel_count: 12,
        benchmark_total_php: 440_000,
        benchmark_system_kwp: 5.85,
        findings: [{ category: "price", severity: "warning", message: "Labour missing" }],
        summary: "Needs review.",
        diagram_components: [],
        verdict: "caution",
      },
    });

    expect(question).toContain("uploaded installer quote");
    expect(question).toContain("Labour missing");
    expect(question).toContain("Why is this high?");
  });

  it("redirects change requests on the quotation page", () => {
    expect(askEngineChangeRedirectCopy()).toContain("Design page");
  });
});
