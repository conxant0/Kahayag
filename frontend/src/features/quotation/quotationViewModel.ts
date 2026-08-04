// Builds quotation documents from solver-backed build BOM lines.
import type {
  DesignBuild,
  DesignComponent,
  QuotationDocument,
  QuoteAuditResponse,
} from "../../shared/api/types";
import { peso, pesoRange } from "../../shared/lib/currency";

export const QUOTE_VALIDITY_DAYS = 30;
export const PAYMENT_TERMS_LINES = [
  "50% downpayment to lock the build and schedule the survey",
  "40% on equipment delivery to site",
  "10% on testing and commissioning",
] as const;
export const PAYMENT_TERMS = PAYMENT_TERMS_LINES.join("; ");
export const WARRANTY_LINES = [
  "25-year panel performance warranty",
  "10-year inverter warranty",
  "5-year workmanship warranty",
] as const;
export const WARRANTY_SUMMARY = WARRANTY_LINES.join("; ");

export const NEXT_STEPS = [
  {
    title: "Accept the quote",
    body: "We lock pricing for 30 days while you decide.",
  },
  {
    title: "Site survey",
    body: "A licensed engineer visits within 5 working days.",
  },
  {
    title: "Permits & net metering",
    body: "We file with your local utility and LGU.",
  },
  {
    title: "Install & commission",
    body: "Typically 2–3 days on the roof, then handover.",
  },
] as const;

const SLOT_ITEM_LABELS: Record<string, string> = {
  inverter: "Inverter",
  panel: "Panels",
  battery: "Battery storage",
  structure: "Structure",
  electrical: "Electrical",
  protection: "Protection",
  install: "Installation",
  installation: "Installation",
  labor: "Installation",
};

export function quoteNumberForBuild(buildId: string): string {
  return `KE-2026-${buildId.slice(0, 4).toUpperCase()}`;
}

export function quoteNumberForUploadedQuote(filename: string): string {
  const slug = filename.replace(/\.[^.]+$/, "").slice(0, 8).toUpperCase();
  return `UP-${slug || "QUOTE"}`;
}

export function lineItemLabel(component: DesignComponent): string {
  return SLOT_ITEM_LABELS[component.slot] ?? component.summary;
}

export function buildQuotationFromBuild(build: DesignBuild): QuotationDocument {
  return {
    build_id: build.id,
    quote_number: quoteNumberForBuild(build.id),
    quote_date: new Date().toISOString().slice(0, 10),
    validity_days: QUOTE_VALIDITY_DAYS,
    lines: build.components.map((component) => ({
      item: lineItemLabel(component),
      description: component.summary || `${component.brand} ${component.model}`,
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
    total_low_php: build.total_investment_low_php,
    total_high_php: build.total_investment_high_php,
    payment_terms: PAYMENT_TERMS,
    warranty_summary: WARRANTY_SUMMARY,
    is_draft: true,
  };
}

export function buildQuotationFromQuoteAudit(
  result: QuoteAuditResponse,
): QuotationDocument {
  const subtotal = result.diagram_components.reduce(
    (sum, component) => sum + component.line_total_php,
    0,
  );
  const total =
    typeof result.extracted_total_php === "number"
      ? result.extracted_total_php
      : subtotal;
  const vat = Math.max(0, total - subtotal);

  return {
    build_id: `quote:${result.filename}`,
    quote_number: quoteNumberForUploadedQuote(result.filename),
    quote_date: new Date().toISOString().slice(0, 10),
    validity_days: QUOTE_VALIDITY_DAYS,
    lines: result.diagram_components.map((component) => ({
      item: lineItemLabel(component),
      description: component.summary || `${component.brand} ${component.model}`,
      brand: component.brand,
      uom: component.unit,
      qty: component.qty,
      unit_price_php: component.unit_price_php,
      amount_php: component.line_total_php,
      price_as_of: component.price_as_of,
    })),
    subtotal_php: subtotal,
    vat_php: vat,
    total_php: total,
    total_low_php: total,
    total_high_php: total,
    payment_terms: PAYMENT_TERMS,
    warranty_summary: WARRANTY_SUMMARY,
    is_draft: true,
  };
}

export function formatQuoteTotal(quote: QuotationDocument): string {
  const low = Number.isFinite(quote.total_low_php)
    ? quote.total_low_php
    : quote.total_php;
  const high = Number.isFinite(quote.total_high_php)
    ? quote.total_high_php
    : quote.total_php;

  if (low === high) {
    return peso(low);
  }

  return pesoRange(low, high);
}

export function quoteTotalLabel(quote: QuotationDocument): string {
  const low = Number.isFinite(quote.total_low_php)
    ? quote.total_low_php
    : quote.total_php;
  const high = Number.isFinite(quote.total_high_php)
    ? quote.total_high_php
    : quote.total_php;

  return low === high ? "Quoted total" : "Estimated total range";
}

export function quoteValidUntil(quoteDate: string, validityDays: number): string {
  const start = new Date(`${quoteDate}T00:00:00`);
  start.setDate(start.getDate() + validityDays);
  return start.toISOString().slice(0, 10);
}

export function formatIssuedDate(quoteDate: string): string {
  const date = new Date(`${quoteDate}T00:00:00`);
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

export type QuoteMetric = {
  label: string;
  value: string;
  detail: string;
  highlighted?: boolean;
};

export function quoteMetrics(build: DesignBuild): QuoteMetric[] {
  return [
    {
      label: "System capacity",
      value: `${build.system_kwp.toFixed(1)} kWp`,
      detail: `${build.panel_count} × panels`,
      highlighted: true,
    },
    {
      label: "Annual savings",
      value: peso(build.annual_savings_php),
      detail: `${peso(build.monthly_savings_php)} saved monthly`,
    },
    {
      label: "Payback period",
      value: build.payback_years
        ? `${build.payback_years.toFixed(1)} years`
        : "—",
      detail: "Return on investment",
    },
    {
      label: "Eco impact",
      value: `${build.co2_tonnes_avoided_yearly.toFixed(1)} tonnes`,
      detail: "CO₂ avoided yearly",
    },
  ];
}

export function quoteMetricsFromAudit(result: QuoteAuditResponse): QuoteMetric[] {
  const panel = result.diagram_components.find((component) => component.slot === "panel");
  const total =
    typeof result.extracted_total_php === "number"
      ? peso(result.extracted_total_php)
      : "—";
  const benchmarkDelta =
    typeof result.extracted_total_php === "number" && result.benchmark_total_php > 0
      ? result.extracted_total_php - result.benchmark_total_php
      : null;

  return [
    {
      label: "System capacity",
      value:
        typeof result.extracted_system_kwp === "number"
          ? `${result.extracted_system_kwp.toFixed(1)} kWp`
          : "—",
      detail:
        typeof result.extracted_panel_count === "number"
          ? `${result.extracted_panel_count} × panels`
          : panel
            ? `${panel.qty} × panels`
            : "From uploaded quote",
      highlighted: true,
    },
    {
      label: "Quoted total",
      value: total,
      detail: result.filename,
    },
    {
      label: "Kahayag benchmark",
      value: peso(result.benchmark_total_php),
      detail: `${result.benchmark_system_kwp.toFixed(1)} kWp reference`,
    },
    {
      label: "vs benchmark",
      value:
        benchmarkDelta === null
          ? "—"
          : benchmarkDelta === 0
            ? "Matches"
            : benchmarkDelta > 0
              ? `${peso(benchmarkDelta)} above`
              : `${peso(Math.abs(benchmarkDelta))} below`,
      detail: "Uploaded installer quote",
    },
  ];
}

export function uploadedQuoteWhyThisPaysCopy(result: QuoteAuditResponse): string {
  if (result.summary.trim()) {
    return result.summary;
  }

  const extracted = result.extracted_total_php;
  if (typeof extracted !== "number" || result.benchmark_total_php <= 0) {
    return "This quotation was uploaded from your installer and benchmarked against Kahayag's model for this roof.";
  }

  const delta = extracted - result.benchmark_total_php;
  if (delta === 0) {
    return `This uploaded quote matches Kahayag's benchmark of ${peso(result.benchmark_total_php)} for a ${result.benchmark_system_kwp.toFixed(1)} kWp system.`;
  }

  const direction =
    delta > 0
      ? `${peso(delta)} above Kahayag's benchmark`
      : `${peso(Math.abs(delta))} below Kahayag's benchmark`;
  return `This uploaded quote totals ${peso(extracted)} — ${direction} for a comparable ${result.benchmark_system_kwp.toFixed(1)} kWp roof.`;
}

export function whyThisPaysCopy(build: DesignBuild): string {
  const payback = build.payback_years
    ? `${build.payback_years.toFixed(1)} years`
    : "the modelled horizon";
  return `This build saves ${peso(build.monthly_savings_php)} a month and ${peso(build.annual_savings_php)} a year, with an estimated payback of ${payback}. Figures come from the solver — not the model.`;
}

export type WhyThisPaysRow = {
  label: string;
  value: string;
};

export function whyThisPaysRows(build: DesignBuild): WhyThisPaysRow[] {
  return [
    {
      label: "Monthly savings",
      value: peso(build.monthly_savings_php),
    },
    {
      label: "Annual savings",
      value: peso(build.annual_savings_php),
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
