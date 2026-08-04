import { describe, expect, it } from "vitest";

import { mockDesignSession } from "../../../../src/features/design/fixtures/mockDesignSession";
import {
  quoteMetrics,
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
});
