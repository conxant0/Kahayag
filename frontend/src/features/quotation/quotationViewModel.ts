// Derives display values for the quotation page. The document itself —
// numbers, quote number, dates, payment terms, warranty summary — comes from
// the backend (`POST /designs/{id}/quotation`); nothing contractual is
// authored here.
import type { DesignBuild } from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";

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

/** Splits the backend's single-string terms into display bullets. Pure
 * formatting — the words themselves are the domain's. */
export function termsLines(terms: string): string[] {
  return terms
    .split(/[;,]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function quoteValidUntil(quoteDate: string, validityDays: number): string {
  // All-UTC arithmetic: parsing local midnight and printing via toISOString
  // lands a day early in any timezone ahead of UTC — including PH (+8).
  const start = new Date(`${quoteDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + validityDays);
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
