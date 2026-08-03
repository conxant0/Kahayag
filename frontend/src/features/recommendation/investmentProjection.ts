import type { AssessmentResult } from "../../shared/api/types";

const ANALYSIS_YEARS = 25;
const ANNUAL_PANEL_DEGRADATION_RATIO = 0.005;
const ELECTRICITY_ESCALATION_RATIO = 0;
const GRID_CO2_KG_PER_KWH = 0.444;
const COST_SLIDER_STEP = 10_000;
const USAGE_SLIDER_STEP = 10;
const ABSOLUTE_COST_MIN = 150_000;
const ABSOLUTE_USAGE_MIN = 100;

export interface InvestmentDefaults {
  electricityRatePhpPerKwh: number;
  systemCostPhp: number;
  monthlyUsageKwh: number;
  baselineElectricityRatePhpPerKwh: number;
  baselineMonthlyUsageKwh: number;
  year1GenerationKwh: number;
  annualYieldPerKwpKwh: number;
  annualSavingsPhp: number;
  monthlySavingsPhp: number;
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
  baselineElectricityRatePhpPerKwh: number;
  baselineMonthlyUsageKwh: number;
  year1GenerationKwh: number;
  annualSavingsPhp: number;
}

export interface InvestmentProjection {
  systemCostPhp: number;
  monthlySavingsPhp: number;
  annualSavingsPhp: number;
  co2TonnesPerYear: number;
  breakEvenYear: number | null;
  year10Net: number;
  year25Net: number;
  lifetimeGrossSavings: number;
  growthBars: Array<{ year: number; heightPct: number }>;
  assumptions: {
    electricityEscalationRatio: number;
    annualPanelDegradationRatio: number;
  };
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

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundMonthlyUsageKwh(value: number): number {
  return Math.round(value / USAGE_SLIDER_STEP) * USAGE_SLIDER_STEP;
}

function resolveMonthlyUsageKwh(result: AssessmentResult): number {
  const directConsumption = numberValue(result.inputs.monthly_consumption_kwh);
  if (directConsumption > 0) {
    return roundMonthlyUsageKwh(directConsumption);
  }

  const bill = numberValue(result.inputs.monthly_bill_php);
  const rate = numberValue(result.inputs.electricity_rate_php_per_kwh);
  return rate > 0 ? roundMonthlyUsageKwh(bill / rate) : 0;
}

export function buildInvestmentDefaults(result: AssessmentResult): InvestmentDefaults {
  const assumptions = result.assumptions;
  const annualYieldPerKwpKwh =
    numberValue(assumptions.annual_sunshine_hours_per_kwp) *
    numberValue(assumptions.performance_ratio);

  return {
    electricityRatePhpPerKwh: numberValue(result.inputs.electricity_rate_php_per_kwh),
    systemCostPhp: result.financials.estimated_base_cost_php,
    monthlyUsageKwh: resolveMonthlyUsageKwh(result),
    baselineElectricityRatePhpPerKwh: numberValue(
      result.inputs.electricity_rate_php_per_kwh,
    ),
    baselineMonthlyUsageKwh: resolveMonthlyUsageKwh(result),
    year1GenerationKwh: numberValue(result.recommendation.annual_generation_kwh),
    annualYieldPerKwpKwh,
    annualSavingsPhp: result.financials.annual_savings_php,
    monthlySavingsPhp: result.financials.monthly_savings_php,
  };
}

export function buildInvestmentSliderBounds(
  defaults: InvestmentDefaults,
): InvestmentSliderBounds {
  const costMin = Math.max(
    ABSOLUTE_COST_MIN,
    snapToStep(defaults.systemCostPhp * 0.5, COST_SLIDER_STEP),
  );
  const costMax = Math.max(
    defaults.systemCostPhp,
    snapToStep(defaults.systemCostPhp * 1.5, COST_SLIDER_STEP),
  );
  const usageMin = Math.max(
    ABSOLUTE_USAGE_MIN,
    snapToStep(defaults.monthlyUsageKwh * 0.5, USAGE_SLIDER_STEP),
  );
  const usageMax = Math.max(
    defaults.monthlyUsageKwh,
    snapToStep(defaults.monthlyUsageKwh * 1.5, USAGE_SLIDER_STEP),
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
  const cost = clamp(
    snapToStep(defaults.systemCostPhp, bounds.costStep),
    bounds.costMin,
    bounds.costMax,
  );
  const usage = clamp(
    snapToStep(defaults.monthlyUsageKwh, bounds.usageStep),
    bounds.usageMin,
    bounds.usageMax,
  );
  const rate = clamp(
    snapToStep(defaults.electricityRatePhpPerKwh, bounds.rateStep),
    bounds.rateMin,
    bounds.rateMax,
  );

  return {
    electricityRatePhpPerKwh: rate,
    systemCostPhp: cost,
    monthlyUsageKwh: usage,
    baselineElectricityRatePhpPerKwh: defaults.baselineElectricityRatePhpPerKwh,
    baselineMonthlyUsageKwh: defaults.baselineMonthlyUsageKwh,
    year1GenerationKwh: defaults.year1GenerationKwh,
    annualSavingsPhp: defaults.annualSavingsPhp,
  };
}

function yearSavings(
  year: number,
  year1SavingsPhp: number,
): number {
  return (
    year1SavingsPhp *
    (1 - ANNUAL_PANEL_DEGRADATION_RATIO) ** (year - 1) *
    (1 + ELECTRICITY_ESCALATION_RATIO) ** (year - 1)
  );
}

export function computeInvestmentProjection(
  inputs: InvestmentInputs,
): InvestmentProjection {
  const defaultsAnnualSavings = Math.max(inputs.annualSavingsPhp, 0);
  const defaultsUsage = Math.max(inputs.baselineMonthlyUsageKwh, 1);
  const usageFactor = clamp(inputs.monthlyUsageKwh / defaultsUsage, 0.5, 1.5);
  const rateFactor = clamp(
    inputs.electricityRatePhpPerKwh /
      Math.max(inputs.baselineElectricityRatePhpPerKwh, 0.01),
    0.5,
    1.5,
  );
  const annualSavingsPhp = Math.floor(
    defaultsAnnualSavings * usageFactor * rateFactor,
  );
  const monthlySavingsPhp = Math.floor(annualSavingsPhp / 12);
  const annualGenerationKwh = Math.max(inputs.year1GenerationKwh, 0);

  let cumulativeNet = -inputs.systemCostPhp;
  let breakEvenYear: number | null = null;
  let lifetimeGrossSavings = 0;
  const milestoneNets: Record<number, number> = {};

  for (let year = 1; year <= ANALYSIS_YEARS; year += 1) {
    const savings = yearSavings(year, annualSavingsPhp);
    const previousNet = cumulativeNet;
    lifetimeGrossSavings += savings;
    cumulativeNet += savings;

    if (breakEvenYear === null && cumulativeNet >= 0) {
      const gain = cumulativeNet - previousNet;
      breakEvenYear =
        gain > 0 ? roundTo(year - 1 + -previousNet / gain, 1) : year;
    }

    if (year === 10 || year === 25) {
      milestoneNets[year] = cumulativeNet;
    }
  }

  const barYears = [6, 12, 18, 25];
  const barNets = barYears.map((year) => {
    let net = -inputs.systemCostPhp;
    for (let current = 1; current <= year; current += 1) {
      net += yearSavings(current, annualSavingsPhp);
    }
    return net;
  });
  const maxBarNet = Math.max(...barNets, 1);

  return {
    systemCostPhp: inputs.systemCostPhp,
    monthlySavingsPhp,
    annualSavingsPhp,
    co2TonnesPerYear: roundTo(
      (annualGenerationKwh * GRID_CO2_KG_PER_KWH) / 1000,
      1,
    ),
    breakEvenYear,
    year10Net: milestoneNets[10] ?? cumulativeNet,
    year25Net: milestoneNets[25] ?? cumulativeNet,
    lifetimeGrossSavings,
    growthBars: barYears.map((year, index) => ({
      year,
      heightPct: Math.max(8, Math.round((barNets[index]! / maxBarNet) * 100)),
    })),
    assumptions: {
      electricityEscalationRatio: ELECTRICITY_ESCALATION_RATIO,
      annualPanelDegradationRatio: ANNUAL_PANEL_DEGRADATION_RATIO,
    },
  };
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
  if (rounded >= 1_000_000) {
    const millions = rounded / 1_000_000;
    return `₱${millions >= 10 ? Math.round(millions) : millions.toFixed(1).replace(/\.0$/, "")}M+`;
  }
  if (rounded >= 1_000) {
    const thousands = rounded / 1_000;
    return `₱${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}K+`;
  }
  return formatPeso(rounded);
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
