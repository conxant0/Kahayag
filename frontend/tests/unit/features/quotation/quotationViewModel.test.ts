import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  buildQuotationFromQuoteAudit,
  formatQuoteTotal,
  quoteMetrics,
  quoteTotalLabel,
  quoteValidUntil,
  termsLines,
} from "../../../../src/features/quotation/quotationViewModel";

describe("quotationViewModel", () => {
  it("formats quote metrics from domain-provided build figures", () => {
    const build = mockDesignSession.builds[0]!;
    const metrics = quoteMetrics(build);

    expect(metrics.map((metric) => metric.label)).toEqual([
      "System capacity",
      "Annual savings",
      "Payback period",
      "Eco impact",
    ]);
    expect(
      metrics.find((metric) => metric.label === "System capacity")?.value,
    ).toBe(`${build.system_kwp.toFixed(1)} kWp`);
  });

  it("splits backend terms strings into display bullets", () => {
    expect(
      termsLines("50% upon contract signing, 40% upon delivery, 10% upon commissioning"),
    ).toEqual([
      "50% upon contract signing",
      "40% upon delivery",
      "10% upon commissioning",
    ]);
    expect(
      termsLines("Component warranties per manufacturer; installation workmanship 1 year."),
    ).toEqual([
      "Component warranties per manufacturer",
      "installation workmanship 1 year.",
    ]);
  });

  it("computes the validity end date from the backend quote date", () => {
    expect(quoteValidUntil("2026-08-04", 30)).toBe("2026-09-03");
  });

  it("builds a quotation document from an uploaded quote audit", () => {
    const components = mockDesignSession.builds[0]!.components.slice(0, 2);
    const quote = buildQuotationFromQuoteAudit({
      filename: "installer.pdf",
      extracted_total_php: 465_000,
      extracted_system_kwp: 5.2,
      extracted_panel_count: 12,
      benchmark_total_php: 440_000,
      benchmark_system_kwp: 5.85,
      findings: [],
      summary: "Uploaded quote summary.",
      diagram_components: components,
    });

    expect(quote.quote_number).toBe("UP-INSTALLE");
    expect(quote.lines).toHaveLength(components.length);
    expect(quote.total_php).toBe(465_000);
    expect(formatQuoteTotal(quote)).toBe("₱465,000");
    expect(quoteTotalLabel(quote)).toBe("Quoted total");
  });
});
