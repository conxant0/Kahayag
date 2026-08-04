// Mirrors backend/app/domain/solar/{assumptions,resource,recommendations}.py
// for the step-3 live preview.
// Uses the nationwide planning fallback (same as the backend when Solar API data
// is unavailable). Final results may refine once location-specific sunshine loads.
//
// This is the preview exception to Hard Rule 1 in AGENTS.md, and the only file
// that holds it. The constants below are a deliberate copy of the domain's
// published assumptions, not a second opinion on them: the screen must show
// something the instant a digit is typed, and a round trip per keystroke is not
// that. Nothing computed here is persisted, submitted, or shown as the result —
// every figure the homeowner keeps comes from `POST /assessments`. If these
// constants and the domain's ever disagree, the domain is right.
import { DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH } from "../../state/assessmentStore";
import type { RoofPolygon } from "../../state/assessmentStore";
import { MIN_VALID_ROOF_AREA_SQUARE_METERS } from "../roof/roofUtils";

const STANDARD_PANEL_WATTAGE_W = 450;
const PANEL_AREA_M2 = 1.13 * 1.76;
const PEAK_SUN_HOURS_PER_DAY = 5;
const PERFORMANCE_RATIO = 0.8;
const COST_BASE_PHP_PER_KWP = 60_000;
const ANNUAL_SUNSHINE_HOURS_PER_KWP = PEAK_SUN_HOURS_PER_DAY * 365;

export type LiveEstimate = {
  panelCount: number;
  systemCapacityKwp: number;
  paybackYears: number | null;
};

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * The traced area, floored at the smallest area the tracer treats as a roof.
 *
 * Takes a polygon rather than accepting null: the step that shows this preview
 * cannot be reached without a trace, so there is no area to invent.
 */
export function resolveRoofAreaSquareMeters(roofPolygon: RoofPolygon): number {
  return Math.max(
    roofPolygon.areaSquareMeters,
    MIN_VALID_ROOF_AREA_SQUARE_METERS,
  );
}

function maxPanelsByRoof(usableAreaM2: number): number {
  return Math.floor(usableAreaM2 / PANEL_AREA_M2);
}

function maxPanelsByBudget(
  budgetPhp: number | null,
  panelWattageW: number,
): number | null {
  if (budgetPhp == null || budgetPhp <= 0) {
    return null;
  }

  const costPerPanel = (panelWattageW / 1000) * COST_BASE_PHP_PER_KWP;
  return Math.floor(budgetPhp / costPerPanel);
}

function maxPanelsByDemand(
  consumptionLimitedSystemSizeKwp: number,
  panelWattageW: number,
): number {
  return Math.floor((consumptionLimitedSystemSizeKwp * 1000) / panelWattageW);
}

/**
 * The binding constraint wins, with one exception: a budget too small for a
 * single panel still shows one, because the honest answer there is "this is
 * what one panel costs", not "no system exists".
 */
function determinePanelCount(
  maxByRoof: number,
  maxByBudget: number | null,
  maxByDemand: number,
): number | null {
  if (maxByRoof < 1 || maxByDemand < 1) {
    return null;
  }

  if (maxByBudget != null && maxByBudget < 1) {
    return 1;
  }

  const candidates: number[] = [];
  if (maxByBudget != null) {
    candidates.push(maxByBudget);
  }
  candidates.push(maxByDemand);
  candidates.push(maxByRoof);

  return Math.min(...candidates);
}

function calculatePaybackYears(
  baseCostPhp: number,
  annualSavingsPhp: number,
): number | null {
  if (annualSavingsPhp <= 0) {
    return null;
  }

  return roundTo(baseCostPhp / annualSavingsPhp, 1);
}

export function computeLiveEstimate({
  monthlyBillPhp,
  electricityRatePhpPerKwh = null,
  roofAreaSquareMeters,
  budgetPhp = null,
  panelWattageW = STANDARD_PANEL_WATTAGE_W,
  annualSunshineHoursPerKwp = ANNUAL_SUNSHINE_HOURS_PER_KWP,
  performanceRatio = PERFORMANCE_RATIO,
}: {
  monthlyBillPhp: number | null;
  electricityRatePhpPerKwh?: number | null;
  roofAreaSquareMeters: number;
  budgetPhp?: number | null;
  panelWattageW?: number;
  annualSunshineHoursPerKwp?: number;
  performanceRatio?: number;
}): LiveEstimate | null {
  // The published rate stands in until the homeowner gives their own — the same
  // fallback the backend applies to a request that carries no tariff, so the
  // preview and the result are reading off the same number.
  const rate = electricityRatePhpPerKwh ?? DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH;

  if (monthlyBillPhp == null || monthlyBillPhp <= 0) {
    return null;
  }

  if (rate <= 0) {
    return null;
  }

  const annualYieldPerKwpKwh = annualSunshineHoursPerKwp * performanceRatio;
  const monthlyConsumptionKwh = monthlyBillPhp / rate;
  const annualConsumptionKwh = monthlyConsumptionKwh * 12;
  const consumptionLimitedSystemSizeKwp =
    annualConsumptionKwh / annualYieldPerKwpKwh;

  const panelCount = determinePanelCount(
    maxPanelsByRoof(roofAreaSquareMeters),
    maxPanelsByBudget(budgetPhp, panelWattageW),
    maxPanelsByDemand(consumptionLimitedSystemSizeKwp, panelWattageW),
  );

  if (panelCount == null) {
    return null;
  }

  const systemCapacityKwp = roundTo((panelCount * panelWattageW) / 1000, 2);
  const annualGenerationKwh = Math.round(
    systemCapacityKwp * annualYieldPerKwpKwh,
  );
  // Generation beyond what the household uses earns nothing here: export
  // credits are out of scope, so savings stop at the bill.
  const billableGenerationKwh = Math.min(
    annualGenerationKwh,
    annualConsumptionKwh,
  );
  const annualSavingsPhp = Math.floor(billableGenerationKwh * rate);
  const baseCostPhp = Math.floor(systemCapacityKwp * COST_BASE_PHP_PER_KWP);

  return {
    panelCount,
    systemCapacityKwp,
    paybackYears: calculatePaybackYears(baseCostPhp, annualSavingsPhp),
  };
}

/** An em dash, not a zero: nothing has been estimated yet. */
export function formatLiveEstimateSystemSize(
  systemCapacityKwp: number | null,
): string {
  if (systemCapacityKwp == null) {
    return "—";
  }

  return Number(systemCapacityKwp).toFixed(1);
}

export function formatLiveEstimatePayback(paybackYears: number | null): string {
  if (paybackYears == null) {
    return "—";
  }

  return Number(paybackYears).toFixed(1);
}
