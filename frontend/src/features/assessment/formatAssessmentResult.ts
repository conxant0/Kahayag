// Formats assessment API results for UI display.
import { peso } from "../../shared/lib/currency";
import type { AssessmentResult } from "../../shared/api/types";

const number = (value: number) => Number(value).toLocaleString("en-PH");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrows the opaque in-memory store value at the results boundary. */
export function readAssessmentResult(raw: unknown): AssessmentResult | null {
  if (!isRecord(raw)) {
    return null;
  }

  const requiredSections = [
    "property",
    "roof",
    "inputs",
    "recommendation",
    "financials",
    "assumptions",
  ];

  if (
    requiredSections.some((section) => !isRecord(raw[section])) ||
    !Array.isArray(raw.limitations) ||
    typeof raw.is_provisional !== "boolean"
  ) {
    return null;
  }

  return raw as unknown as AssessmentResult;
}

export function formatPeso(value: number | string | null | undefined): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? peso(parsed) : "—";
}

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

export function formatOffset(result: AssessmentResult | null): string {
  const ratio = Number(result?.recommendation?.annual_consumption_offset_ratio);
  return Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : "—";
}

export function formatCostRange(result: AssessmentResult | null): string {
  const low = Number(result?.financials?.estimated_cost_low_php);
  const high = Number(result?.financials?.estimated_cost_high_php);
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return "—";
  }
  return `${peso(low)}–${peso(high)}`;
}

export function formatBudgetCompatibility(
  result: AssessmentResult | null,
): string {
  if (!result) {
    return "—";
  }
  return result.financials.budget_compatible
    ? "Within your budget"
    : "Above your budget";
}

export function formatRatio(value: number | string | null | undefined): string {
  const ratio = Number(value);
  return Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : "—";
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
