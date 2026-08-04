import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  buildQuotationFromBuild,
  quoteNumberForBuild,
} from "../../../../src/features/quotation/quotationViewModel";

describe("quotationViewModel", () => {
  it("builds line items and totals from the active build BOM", () => {
    const build = mockDesignSession.builds[0]!;
    const quote = buildQuotationFromBuild(build);

    expect(quote.lines).toHaveLength(build.components.length);
    expect(quote.subtotal_php).toBe(build.subtotal_php);
    expect(quote.vat_php).toBe(build.vat_php);
    expect(quote.total_php).toBe(build.total_investment_php);
    expect(quote.lines.reduce((sum, line) => sum + line.amount_php, 0)).toBe(
      build.subtotal_php,
    );
  });

  it("keeps a stable quote number for the session build", () => {
    const build = mockDesignSession.builds[0]!;
    expect(quoteNumberForBuild(build.id)).toBe(
      `KE-2026-${build.id.slice(0, 4).toUpperCase()}`,
    );
  });
});
