import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  buildQuotationFromBuild,
  buildQuotationFromQuoteAudit,
  formatQuoteTotal,
  quoteNumberForBuild,
  quoteTotalLabel,
} from "../../../../src/features/quotation/quotationViewModel";

describe("quotationViewModel", () => {
  it("builds line items and totals from the active build BOM", () => {
    const build = mockDesignSession.builds[0]!;
    const quote = buildQuotationFromBuild(build);

    expect(quote.lines).toHaveLength(build.components.length);
    expect(quote.subtotal_php).toBe(build.subtotal_php);
    expect(quote.vat_php).toBe(build.vat_php);
    expect(quote.total_php).toBe(build.total_investment_php);
    expect(quote.total_low_php).toBe(build.total_investment_low_php);
    expect(quote.total_high_php).toBe(build.total_investment_high_php);
    expect(quote.lines.reduce((sum, line) => sum + line.amount_php, 0)).toBe(
      build.subtotal_php,
    );
  });

  it("keeps a range when low and high totals differ", () => {
    const build = mockDesignSession.builds[0]!;
    const quote = buildQuotationFromBuild(build);

    expect(formatQuoteTotal(quote)).toBe("₱354,928–₱524,636");
    expect(quoteTotalLabel(quote)).toBe("Estimated total range");
  });

  it("keeps a stable quote number for the session build", () => {
    const build = mockDesignSession.builds[0]!;
    expect(quoteNumberForBuild(build.id)).toBe(
      `KE-2026-${build.id.slice(0, 4).toUpperCase()}`,
    );
  });

  it("falls back to total_php when investment range fields are missing", () => {
    const build = mockDesignSession.builds[0]!;
    const quote = {
      ...buildQuotationFromBuild(build),
      total_low_php: Number.NaN,
      total_high_php: Number.NaN,
    };

    expect(formatQuoteTotal(quote)).toBe("₱439,782");
    expect(quoteTotalLabel(quote)).toBe("Quoted total");
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
