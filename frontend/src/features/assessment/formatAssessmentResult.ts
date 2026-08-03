// Formats assessment API results for UI display.
import { peso } from "../../shared/lib/currency";
import type { AssessmentResult } from "../../shared/api/types";

const number = (value: number) => Number(value).toLocaleString("en-PH");

export function formatMonthlySavings(result: AssessmentResult | null): string {
  return peso(Number(result?.financials?.monthly_savings_php ?? 0));
}

export function formatSystemCapacity(result: AssessmentResult | null): string {
  const kwp = result?.recommendation?.system_capacity_kwp;
  if (kwp == null) {
    return "—";
  }
  return `${Number(kwp).toFixed(1)} kW`;
}

export function formatAnnualGeneration(
  result: AssessmentResult | null,
): string {
  const kwh = result?.recommendation?.annual_generation_kwh;
  if (kwh == null) {
    return "—";
  }
  return `${number(Number(kwh))} kWh`;
}

export function formatPaybackYears(result: AssessmentResult | null): string {
  const years = result?.financials?.payback_years;
  if (years == null) {
    return "—";
  }
  return `${Number(years).toFixed(1)} years`;
}

export function formatAnnualSavings(result: AssessmentResult | null): string {
  return peso(Number(result?.financials?.annual_savings_php ?? 0));
}

export function formatShadingImpact(
  result: AssessmentResult | null,
): string | null {
  const shading = result?.shading;
  if (!shading) {
    return null;
  }

  const labels: Record<string, string> = {
    low: "Low impact",
    moderate: "Moderate impact",
    high: "High impact",
    severe: "Severe impact",
  };

  return labels[shading.shading_impact] ?? shading.shading_impact;
}

export function formatConfidenceLabel(result: AssessmentResult | null): string {
  const shading = result?.shading;
  if (shading?.sunshine_retention_ratio != null) {
    const percent = Math.round(Number(shading.sunshine_retention_ratio) * 100);
    return `Your results · ${percent}% sunshine retained`;
  }

  if (result?.assumptions?.solar_resource_source === "google_solar_api") {
    return "Your results · location-specific sunshine";
  }

  return "Your results · planning estimate";
}

export type ResultsStat = [label: string, value: string];

export function buildResultsStats(
  result: AssessmentResult | null,
): ResultsStat[] {
  const stats: ResultsStat[] = [
    ["System size", formatSystemCapacity(result)],
    ["Yearly yield", formatAnnualGeneration(result)],
    ["Payback", formatPaybackYears(result)],
    ["Back per year", `≈ ${formatAnnualSavings(result)}`],
  ];

  const shadingLabel = formatShadingImpact(result);
  if (shadingLabel) {
    stats.push(["Shading", shadingLabel]);
  }

  return stats;
}
