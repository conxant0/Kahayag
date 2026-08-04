import type {
  AssessmentResult,
  InvestmentProjectionRequest,
  InvestmentProjectionResponse,
} from "../../shared/api/types";

const COST_SLIDER_STEP = 10_000;
const USAGE_SLIDER_STEP = 10;
const ABSOLUTE_COST_MIN = 150_000;
const ABSOLUTE_USAGE_MIN = 100;

// The projection endpoint's validation ceilings (assessment schemas.py:
// system_cost_php le=5_000_000, monthly_consumption_kwh le=10_000). The
// sliders must never offer a value the backend will 422 — a large system's
// ×1.5 headroom used to push costMax past the cap and surface the raw
// "Input should be less than or equal to 5000000" error.
const API_COST_MAX = 5_000_000;
const API_USAGE_MAX = 10_000;

export interface InvestmentDefaults {
  electricityRatePhpPerKwh: number;
  systemCostPhp: number;
  monthlyUsageKwh: number;
}

export interface InvestmentSliderBounds {
  costMin: number;
  costMax: number;
  costStep: number;
  usageMin: number;
  usageMax: number;
  usageStep: number;
  rateMin: number;
  rateMax: number;
  rateStep: number;
}

export interface InvestmentInputs {
  electricityRatePhpPerKwh: number;
  systemCostPhp: number;
  monthlyUsageKwh: number;
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function buildInvestmentDefaults(result: AssessmentResult): InvestmentDefaults {
  return {
    electricityRatePhpPerKwh: numberValue(result.resolved_tariff_php_per_kwh),
    systemCostPhp: result.financials.estimated_base_cost_php,
    monthlyUsageKwh: numberValue(result.estimated_monthly_consumption_kwh),
  };
}

export function buildInvestmentSliderBounds(
  defaults: InvestmentDefaults,
): InvestmentSliderBounds {
  const costMax = Math.min(
    API_COST_MAX,
    Math.max(
      defaults.systemCostPhp,
      snapToStep(defaults.systemCostPhp * 1.5, COST_SLIDER_STEP),
    ),
  );
  const costMin = Math.min(
    costMax,
    Math.max(
      ABSOLUTE_COST_MIN,
      snapToStep(defaults.systemCostPhp * 0.5, COST_SLIDER_STEP),
    ),
  );
  const usageMax = Math.min(
    API_USAGE_MAX,
    Math.max(
      defaults.monthlyUsageKwh,
      snapToStep(defaults.monthlyUsageKwh * 1.5, USAGE_SLIDER_STEP),
    ),
  );
  const usageMin = Math.min(
    usageMax,
    Math.max(
      ABSOLUTE_USAGE_MIN,
      snapToStep(defaults.monthlyUsageKwh * 0.5, USAGE_SLIDER_STEP),
    ),
  );

  return {
    costMin,
    costMax,
    costStep: COST_SLIDER_STEP,
    usageMin,
    usageMax,
    usageStep: USAGE_SLIDER_STEP,
    rateMin: 6,
    rateMax: 18,
    rateStep: 0.5,
  };
}

export function clampInvestmentInputs(
  defaults: InvestmentDefaults,
  bounds: InvestmentSliderBounds,
): InvestmentInputs {
  return {
    electricityRatePhpPerKwh: clamp(
      snapToStep(defaults.electricityRatePhpPerKwh, bounds.rateStep),
      bounds.rateMin,
      bounds.rateMax,
    ),
    systemCostPhp: clamp(
      snapToStep(defaults.systemCostPhp, bounds.costStep),
      bounds.costMin,
      bounds.costMax,
    ),
    monthlyUsageKwh: clamp(
      snapToStep(defaults.monthlyUsageKwh, bounds.usageStep),
      bounds.usageMin,
      bounds.usageMax,
    ),
  };
}

export function buildInvestmentProjectionPayload(
  result: AssessmentResult,
  inputs: InvestmentInputs,
): InvestmentProjectionRequest {
  return {
    assessment: result,
    electricity_rate_php_per_kwh: inputs.electricityRatePhpPerKwh,
    system_cost_php: inputs.systemCostPhp,
    monthly_consumption_kwh: inputs.monthlyUsageKwh,
  };
}

export function buildGrowthBars(
  milestones: InvestmentProjectionResponse["milestones"],
): Array<{ year: number; heightPct: number }> {
  const maxNet = Math.max(...milestones.map((row) => row.cumulative_net_php), 1);
  return milestones.map((row) => ({
    year: row.year,
    heightPct: Math.max(8, Math.round((row.cumulative_net_php / maxNet) * 100)),
  }));
}

export function formatInsightText(breakEvenYear: number | null): string {
  if (breakEvenYear == null) {
    return "Adjust assumptions to see when this system pays off.";
  }
  if (breakEvenYear < 5) {
    return "Profitable in under five years at current rates.";
  }
  if (breakEvenYear <= 10) {
    return `Pays for itself in about ${breakEvenYear.toFixed(1)} years at current rates.`;
  }
  return `Long-term savings build after a ${breakEvenYear.toFixed(1)}-year payback period.`;
}

export function formatPeso(value: number): string {
  return `₱${Math.round(value).toLocaleString("en-PH")}`;
}

export function formatCompactPeso(value: number): string {
  const rounded = Math.round(value);
  // A negative 25-year net is a legitimate outcome at extreme slider values
  // (maximum cost, minimal savings). Format the magnitude and carry the sign
  // explicitly — "−₱1.2M", never "₱-1,234,567" — and drop the "+" suffix,
  // which reads as "and growing" and would lie on a loss.
  const sign = rounded < 0 ? "−" : "";
  const magnitude = Math.abs(rounded);
  const suffix = rounded < 0 ? "" : "+";
  if (magnitude >= 1_000_000) {
    const millions = magnitude / 1_000_000;
    return `${sign}₱${millions >= 10 ? Math.round(millions) : millions.toFixed(1).replace(/\.0$/, "")}M${suffix}`;
  }
  if (magnitude >= 1_000) {
    const thousands = magnitude / 1_000;
    return `${sign}₱${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}K${suffix}`;
  }
  return `${sign}${formatPeso(magnitude)}`;
}

export function formatBreakEvenYear(breakEvenYear: number | null): string {
  return breakEvenYear == null ? "—" : `Year ${breakEvenYear.toFixed(1)}`;
}

export function formatTimelinePeso(value: number): string {
  const rounded = Math.round(value);
  if (rounded >= 1_000_000) {
    return `+₱${(rounded / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (rounded === 0) {
    return "₱0";
  }
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${formatPeso(Math.abs(rounded))}`;
}
