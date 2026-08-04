// Builds quotation documents from solver-backed build BOM lines.
import type { DesignBuild, QuotationDocument } from "../../shared/api/types";

export const QUOTE_VALIDITY_DAYS = 30;
export const PAYMENT_TERMS =
  "50% upon contract signing, 40% upon delivery, 10% upon commissioning";
export const WARRANTY_SUMMARY =
  "Component warranties per manufacturer; installation workmanship 1 year.";

export function quoteNumberForBuild(buildId: string): string {
  return `KH-${buildId.slice(0, 8).toUpperCase()}`;
}

export function buildQuotationFromBuild(build: DesignBuild): QuotationDocument {
  return {
    build_id: build.id,
    quote_number: quoteNumberForBuild(build.id),
    quote_date: new Date().toISOString().slice(0, 10),
    validity_days: QUOTE_VALIDITY_DAYS,
    lines: build.components.map((component) => ({
      item: component.summary,
      description: `${component.brand} ${component.model}`,
      brand: component.brand,
      uom: component.unit,
      qty: component.qty,
      unit_price_php: component.unit_price_php,
      amount_php: component.line_total_php,
      price_as_of: component.price_as_of,
    })),
    subtotal_php: build.subtotal_php,
    vat_php: build.vat_php,
    total_php: build.total_investment_php,
    payment_terms: PAYMENT_TERMS,
    warranty_summary: WARRANTY_SUMMARY,
    is_draft: true,
  };
}

export function quoteValidUntil(quoteDate: string, validityDays: number): string {
  const start = new Date(`${quoteDate}T00:00:00`);
  start.setDate(start.getDate() + validityDays);
  return start.toISOString().slice(0, 10);
}

export type WhyThisPaysRow = {
  label: string;
  value: string;
};

export function whyThisPaysRows(build: DesignBuild): WhyThisPaysRow[] {
  return [
    {
      label: "Monthly savings",
      value: `₱${Math.round(build.monthly_savings_php).toLocaleString("en-PH")}`,
    },
    {
      label: "Annual savings",
      value: `₱${Math.round(build.annual_savings_php).toLocaleString("en-PH")}`,
    },
    {
      label: "Payback",
      value: build.payback_years
        ? `${build.payback_years.toFixed(1)} years`
        : "Not within model horizon",
    },
    {
      label: "CO₂ avoided",
      value: `${build.co2_tonnes_avoided_yearly.toFixed(1)} tonnes per year`,
    },
  ];
}
