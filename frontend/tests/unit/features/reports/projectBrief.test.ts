import { describe, expect, it } from "vitest";

import {
  buildProjectBrief,
  buildReportPreview,
  formatBriefLocation,
  formatReportDate,
  PANEL_CLASS_OPTIONS,
  resolveReportDateLabel,
} from "../../../../src/features/reports/projectBrief";
import { MOCK_ASSESSMENT_RESPONSE } from "./mockAssessmentResponse";

describe("buildProjectBrief", () => {
  it("returns demo content when no assessment exists", () => {
    const brief = buildProjectBrief();

    expect(brief.locationLabel).toBe("Pajo, Lapu-Lapu City");
    expect(brief.confidencePercent).toBe(92);
    expect(brief.systemRows).toHaveLength(5);
    expect(brief.financialRows[2]!.value).toBe("≈ 88%");
  });

  it("maps the mock assessment into live system and financial rows", () => {
    const brief = buildProjectBrief({
      result: MOCK_ASSESSMENT_RESPONSE,
      selectedProperty: { address: "Demo property, Cebu City, Philippines" },
      roofPolygon: {
        coordinates: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 1, longitude: 1 },
        ],
      },
      energyInputs: { electricityRatePhpPerKwh: 12 },
      panelCategoryId: "standard-450",
    });

    expect(brief.locationLabel).toBe("Cebu City");
    expect(brief.confidencePercent).toBe(92);
    expect(brief.systemRows[0]!.value).toBe("4.1 kW");
    expect(brief.systemRows[1]!.value).toBe("9 · Tier 1 premium");
    expect(
      brief.systemRows.find((row) => row.label === "Orientation")?.value,
    ).toMatch(/° S$/);
    expect(
      brief.systemRows.find((row) => row.label === "Roof pitch")?.value,
    ).toMatch(/°$/);
    expect(brief.financialRows[0]!.value).toBe("₱4,800");
    expect(brief.financialRows[3]!.value).toBe("4.2 years");
  });

  it("recalculates sizing when high-output panels are selected", () => {
    const standard = buildProjectBrief({
      result: MOCK_ASSESSMENT_RESPONSE,
      panelCategoryId: "standard-450",
    });
    const highOutput = buildProjectBrief({
      result: MOCK_ASSESSMENT_RESPONSE,
      panelCategoryId: "high-output-550",
    });

    expect(highOutput.systemRows[1]!.value).not.toBe(standard.systemRows[1]!.value);
    expect(Number.parseInt(highOutput.systemRows[1]!.value, 10)).toBeLessThan(9);
    expect(highOutput.panelClassHint).toContain("High Output");
  });
});

describe("formatBriefLocation", () => {
  it("shortens demo addresses to the city", () => {
    expect(
      formatBriefLocation(
        { address: "Demo property, Cebu City, Philippines" },
        null,
      ),
    ).toBe("Cebu City");
  });
});

describe("PANEL_CLASS_OPTIONS", () => {
  it("matches backend panel categories", () => {
    expect(PANEL_CLASS_OPTIONS.map((option) => option.id)).toEqual([
      "standard-450",
      "high-output-550",
    ]);
  });
});

describe("buildReportPreview", () => {
  it("returns demo metadata when no assessment exists", () => {
    const report = buildReportPreview({
      generatedAt: new Date("2026-07-28T12:00:00"),
    });

    expect(report.title).toBe("Kahayag Solar Brief");
    expect(report.metaLine).toBe("Pajo, Lapu-Lapu City · 25 Jul 2026 · 8 pages");
    expect(report.footerCaption).toBe("No account needed · about 2 MB");
    expect(report.contents).toHaveLength(4);
  });

  it("maps the mock assessment into live report metadata", () => {
    const report = buildReportPreview({
      result: MOCK_ASSESSMENT_RESPONSE,
      selectedProperty: { address: "Demo property, Cebu City, Philippines" },
      generatedAt: new Date("2026-07-28T12:00:00"),
    });

    expect(report.metaLine).toBe("Cebu City · 28 Jul 2026 · 8 pages");
    expect(report.locationLabel).toBe("Cebu City");
    expect(report.dateLabel).toBe("28 Jul 2026");
  });
});

describe("resolveReportDateLabel", () => {
  it("prefers the assessment date over the generated timestamp", () => {
    expect(
      resolveReportDateLabel(
        MOCK_ASSESSMENT_RESPONSE,
        new Date("2026-01-01T12:00:00"),
      ),
    ).toBe("28 Jul 2026");
  });

  it("formats generated timestamps when no assessment date exists", () => {
    expect(
      resolveReportDateLabel(
        { property: { address: "", latitude: "0", longitude: "0", assessment_date: "" } },
        new Date("2026-07-28T12:00:00"),
      ),
    ).toBe("28 Jul 2026");
  });
});

describe("formatReportDate", () => {
  it("uses a compact day-month-year label", () => {
    expect(formatReportDate(new Date("2026-07-25T12:00:00"))).toBe("25 Jul 2026");
  });
});
