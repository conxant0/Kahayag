// Builds the /brief view model from assessment data and panel-class choice.
import { peso } from "../../shared/lib/currency";
import type { AssessmentResult, RoofPolygon } from "../../shared/api/types";
import { formatShadingImpact } from "../assessment/formatAssessmentResult";
import {
  buildPredictionConfidence,
  type PredictionConfidence,
} from "../recommendation/predictionConfidence";
import {
  formatRoofOrientation,
  formatRoofPitch,
  summarizeRoofGeometry,
} from "./roofGeometry";

// Fallbacks only, for the no-result demo view. Whenever assessment
// assumptions are available, resolvePanelAreaM2/resolveCostBasePhpPerKwp/
// resolveAnnualYieldPerKwpKwh below derive these from the backend's
// domain/solar/assumptions.py values instead, so the two stay in sync.
const PANEL_AREA_M2 = 1.13 * 1.76;
const COST_BASE_PHP_PER_KWP = 60_000;
const PERFORMANCE_RATIO = 0.8;
const PEAK_SUN_HOURS_PER_DAY = 5;

export interface PanelClassOption {
  id: string;
  label: string;
  wattageW: number;
}

export const PANEL_CLASS_OPTIONS: readonly PanelClassOption[] = Object.freeze([
  {
    id: "standard-450",
    label: "Standard · 450 W",
    wattageW: 450,
  },
  {
    id: "high-output-550",
    label: "High Output · 550 W",
    wattageW: 550,
  },
]);

export const REPORT_TITLE = "Kahayag Solar Brief";
export const REPORT_PAGE_COUNT = 8;
export const REPORT_ESTIMATED_SIZE_MB = 2;

export const REPORT_CONTENTS: readonly string[] = Object.freeze([
  "Results & system specs",
  "Panel layout on your roof",
  "25-year financial projection",
  "Prediction confidence breakdown",
]);

const DEMO_REPORT_DATE_ISO = "2026-08-03";

const REPORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export interface BriefRow {
  label: string;
  value: string;
  cobalt?: boolean;
}

const DEMO_BRIEF = Object.freeze({
  locationLabel: "Pajo, Lapu-Lapu City",
  confidencePercent: 92,
  defaultPanelCategoryId: "high-output-550",
  usableAreaM2: 48,
  panelCount: 10,
  panelWidthM: 1.13,
  panelHeightM: 1.76,
  systemRows: [
    { label: "System size", value: "5.2 kW" },
    { label: "Solar panels", value: "10 · Tier 1 premium" },
    { label: "Orientation", value: "172° S" },
    { label: "Roof pitch", value: "15°" },
    { label: "Shading", value: "Low impact", cobalt: true },
  ] as BriefRow[],
  financialRows: [
    { label: "Monthly savings", value: "₱4,850" },
    { label: "Annual savings", value: "₱58,200" },
    { label: "Bill coverage", value: "≈ 88%", cobalt: true },
    { label: "Payback", value: "4.8 years" },
  ] as BriefRow[],
  disclaimer:
    "Preliminary assessment — not a substitute for a licensed engineer's site inspection. Based on Cebu meteorological averages, VECO rates and your inputs.",
});

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatKwp(systemCapacityKwp: number): string {
  const rounded = Math.round(Number(systemCapacityKwp) * 10) / 10;
  return `${rounded.toFixed(1)} kW`;
}

function maxPanelsByRoof(usableAreaM2: number, panelAreaM2: number): number {
  return Math.floor(usableAreaM2 / panelAreaM2);
}

function maxPanelsByBudget(
  budgetPhp: number | null | undefined,
  panelWattageW: number,
  costBasePhpPerKwp: number,
): number | null {
  if (budgetPhp == null || budgetPhp <= 0) {
    return null;
  }

  const costPerPanel = (panelWattageW / 1000) * costBasePhpPerKwp;
  return Math.floor(budgetPhp / costPerPanel);
}

function maxPanelsByDemand(
  consumptionLimitedSystemSizeKwp: number,
  panelWattageW: number,
): number {
  return Math.floor((consumptionLimitedSystemSizeKwp * 1000) / panelWattageW);
}

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

function resolveAnnualYieldPerKwpKwh(
  assumptions: AssessmentResult["assumptions"] | undefined,
): number {
  const sunshineHours = Number(assumptions?.annual_sunshine_hours_per_kwp);
  const performanceRatio = Number(
    assumptions?.performance_ratio ?? PERFORMANCE_RATIO,
  );

  if (Number.isFinite(sunshineHours) && sunshineHours > 0) {
    return sunshineHours * performanceRatio;
  }

  return PEAK_SUN_HOURS_PER_DAY * 365 * PERFORMANCE_RATIO;
}

function resolvePanelAreaM2(
  assumptions: AssessmentResult["assumptions"] | undefined,
): number {
  const widthM = Number(assumptions?.panel_width_m);
  const heightM = Number(assumptions?.panel_height_m);

  if (
    Number.isFinite(widthM) &&
    widthM > 0 &&
    Number.isFinite(heightM) &&
    heightM > 0
  ) {
    return widthM * heightM;
  }

  return PANEL_AREA_M2;
}

function resolveCostBasePhpPerKwp(
  assumptions: AssessmentResult["assumptions"] | undefined,
): number {
  const low = Number(assumptions?.cost_low_php_per_kwp);
  const high = Number(assumptions?.cost_high_php_per_kwp);

  if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0) {
    return (low + high) / 2;
  }

  return COST_BASE_PHP_PER_KWP;
}

function resolvePanelClass(
  panelCategoryId: string | null | undefined,
): PanelClassOption {
  return (
    PANEL_CLASS_OPTIONS.find((option) => option.id === panelCategoryId) ??
    PANEL_CLASS_OPTIONS[0]!
  );
}

interface Sizing {
  panelCount: number;
  panelWattageW: number;
  systemCapacityKwp: number;
  annualGenerationKwh: number;
  annualSavingsPhp: number;
  monthlySavingsPhp: number;
  paybackYears: number | null;
  billCoverageRatio: number;
  estimatedBaseCostPhp?: number;
}

function computeSizingForPanelClass(
  result: AssessmentResult,
  panelCategoryId: string,
): Sizing | null {
  const panelClass = resolvePanelClass(panelCategoryId);
  const recommendation = result.recommendation;
  const inputs = result.inputs;
  const assumptions = result.assumptions;

  if (recommendation.panel_category_id === panelCategoryId) {
    const annualGenerationKwh = Number(recommendation.annual_generation_kwh);
    const annualConsumptionKwh =
      Number(result.estimated_monthly_consumption_kwh) * 12;
    const billableGenerationKwh = Math.min(
      annualGenerationKwh,
      annualConsumptionKwh,
    );
    const rate = Number(inputs.electricity_rate_php_per_kwh);
    const annualSavingsPhp = Math.floor(billableGenerationKwh * rate);
    const systemCapacityKwp = Number(recommendation.system_capacity_kwp);

    return {
      panelCount: recommendation.panel_count,
      panelWattageW: recommendation.panel_wattage_w,
      systemCapacityKwp,
      annualGenerationKwh,
      annualSavingsPhp,
      monthlySavingsPhp: result.financials.monthly_savings_php,
      paybackYears: Number(result.financials.payback_years),
      billCoverageRatio: Number(recommendation.annual_consumption_offset_ratio),
      estimatedBaseCostPhp: result.financials.estimated_base_cost_php,
    };
  }

  const usableAreaM2 = Number(result.roof.usable_area_m2);
  const annualYieldPerKwpKwh = resolveAnnualYieldPerKwpKwh(assumptions);
  const monthlyConsumptionKwh = Number(result.estimated_monthly_consumption_kwh);
  const annualConsumptionKwh = monthlyConsumptionKwh * 12;
  const consumptionLimitedSystemSizeKwp =
    annualConsumptionKwh / annualYieldPerKwpKwh;
  const panelAreaM2 = resolvePanelAreaM2(assumptions);
  const costBasePhpPerKwp = resolveCostBasePhpPerKwp(assumptions);
  const maxByRoof = maxPanelsByRoof(usableAreaM2, panelAreaM2);
  const maxByBudget = maxPanelsByBudget(
    inputs.budget_php,
    panelClass.wattageW,
    costBasePhpPerKwp,
  );
  const maxByDemand = maxPanelsByDemand(
    consumptionLimitedSystemSizeKwp,
    panelClass.wattageW,
  );
  const panelCount = determinePanelCount(maxByRoof, maxByBudget, maxByDemand);

  if (panelCount == null) {
    return null;
  }

  const systemCapacityKwp = roundTo(
    (panelCount * panelClass.wattageW) / 1000,
    2,
  );
  const annualGenerationKwh = Math.round(
    systemCapacityKwp * annualYieldPerKwpKwh,
  );
  const billableGenerationKwh = Math.min(
    annualGenerationKwh,
    annualConsumptionKwh,
  );
  const rate = Number(inputs.electricity_rate_php_per_kwh);
  const annualSavingsPhp = Math.floor(billableGenerationKwh * rate);
  const monthlySavingsPhp = Math.floor(annualSavingsPhp / 12);
  const estimatedBaseCostPhp = Math.floor(
    systemCapacityKwp * costBasePhpPerKwp,
  );
  const paybackYears =
    annualSavingsPhp > 0
      ? roundTo(estimatedBaseCostPhp / annualSavingsPhp, 1)
      : null;

  return {
    panelCount,
    panelWattageW: panelClass.wattageW,
    systemCapacityKwp,
    annualGenerationKwh,
    annualSavingsPhp,
    monthlySavingsPhp,
    paybackYears,
    billCoverageRatio: Math.min(1, annualGenerationKwh / annualConsumptionKwh),
    estimatedBaseCostPhp,
  };
}

export function formatBriefLocation(
  selectedProperty: { address?: string | null } | null,
  resultProperty: { address?: string | null } | null | undefined,
): string {
  const address = selectedProperty?.address ?? resultProperty?.address;
  if (!address) {
    return DEMO_BRIEF.locationLabel;
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts[0]!.toLowerCase().includes("demo")) {
    return parts[1]!;
  }

  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`;
  }

  return address;
}

function buildPanelClassHint(
  panelCategoryId: string,
  usableAreaM2: number,
): string {
  const roundedArea = Math.round(usableAreaM2);

  if (panelCategoryId === "high-output-550") {
    return `High Output panels fit your ${roundedArea} m² — fewer panels, more power.`;
  }

  return `Standard panels balance cost and coverage across your ${roundedArea} m² roof.`;
}

function buildDisclaimer(result: AssessmentResult): string {
  const resourceLabel =
    result.assumptions?.solar_resource_source === "google_solar_api"
      ? "location-specific sunshine data"
      : "regional meteorological averages";

  return `Preliminary assessment — not a substitute for a licensed engineer's site inspection. Based on ${resourceLabel}, VECO rates and your inputs.`;
}

function buildSystemRows(
  result: AssessmentResult,
  sizing: Pick<Sizing, "systemCapacityKwp" | "panelCount">,
): BriefRow[] {
  const shadingLabel = formatShadingImpact(result) ?? "Not assessed";
  const roofGeometry = summarizeRoofGeometry(result?.shading?.roof_segments);

  const rows: BriefRow[] = [
    {
      label: "System size",
      value: formatKwp(sizing.systemCapacityKwp),
    },
    {
      label: "Solar panels",
      value: `${sizing.panelCount} · Tier 1 premium`,
    },
  ];

  if (roofGeometry) {
    rows.push(
      {
        label: "Orientation",
        value: formatRoofOrientation(roofGeometry.azimuthDegrees),
      },
      {
        label: "Roof pitch",
        value: formatRoofPitch(roofGeometry.pitchDegrees),
      },
    );
  }

  rows.push({
    label: "Shading",
    value: shadingLabel,
    cobalt: true,
  });

  return rows;
}

interface MapPreview {
  panelCount: number;
  panelWidthM: number;
  panelHeightM: number;
  panelWattageW: number;
}

function buildMapPreview(
  result: AssessmentResult | null,
  sizing: Pick<Sizing, "panelCount" | "panelWattageW"> | null,
  panelCategoryId: string | null | undefined,
): MapPreview {
  const panelClass = resolvePanelClass(
    panelCategoryId ??
      result?.recommendation?.panel_category_id ??
      "standard-450",
  );

  return {
    panelCount:
      sizing?.panelCount ??
      result?.recommendation?.panel_count ??
      DEMO_BRIEF.panelCount,
    panelWidthM: Number(
      result?.assumptions?.panel_width_m ?? DEMO_BRIEF.panelWidthM,
    ),
    panelHeightM: Number(
      result?.assumptions?.panel_height_m ?? DEMO_BRIEF.panelHeightM,
    ),
    panelWattageW: sizing?.panelWattageW ?? panelClass.wattageW,
  };
}

function buildFinancialRows(sizing: {
  monthlySavingsPhp: number;
  annualSavingsPhp: number;
  billCoverageRatio: number;
  paybackYears: number | null;
}): BriefRow[] {
  const coveragePercent = Math.round(Number(sizing.billCoverageRatio) * 100);

  return [
    { label: "Monthly savings", value: peso(Number(sizing.monthlySavingsPhp)) },
    { label: "Annual savings", value: peso(Number(sizing.annualSavingsPhp)) },
    {
      label: "Bill coverage",
      value: `≈ ${coveragePercent}%`,
      cobalt: true,
    },
    {
      label: "Payback",
      value:
        sizing.paybackYears == null
          ? "—"
          : `${Number(sizing.paybackYears).toFixed(1)} years`,
    },
  ];
}

export interface ProjectBrief extends MapPreview {
  locationLabel: string;
  confidencePercent: number;
  defaultPanelCategoryId: string;
  panelCategoryId: string;
  panelClassHint: string;
  systemRows: BriefRow[];
  financialRows: BriefRow[];
  disclaimer: string;
  shareText: string;
}

interface EnergyInputs {
  electricityRatePhpPerKwh?: number | null;
}

export function buildProjectBrief({
  result = null,
  selectedProperty = null,
  roofPolygon = null,
  energyInputs = null,
  panelCategoryId,
}: {
  result?: AssessmentResult | null;
  selectedProperty?: { address?: string | null } | null;
  roofPolygon?: RoofPolygon | null;
  energyInputs?: EnergyInputs | null;
  panelCategoryId?: string;
} = {}): ProjectBrief {
  if (!result) {
    const resolvedId = panelCategoryId ?? DEMO_BRIEF.defaultPanelCategoryId;
    return {
      locationLabel: DEMO_BRIEF.locationLabel,
      confidencePercent: DEMO_BRIEF.confidencePercent,
      defaultPanelCategoryId: DEMO_BRIEF.defaultPanelCategoryId,
      panelCategoryId: resolvedId,
      panelClassHint: buildPanelClassHint(resolvedId, DEMO_BRIEF.usableAreaM2),
      systemRows: DEMO_BRIEF.systemRows,
      financialRows: DEMO_BRIEF.financialRows,
      disclaimer: DEMO_BRIEF.disclaimer,
      shareText: `Kahayag solar brief · ${DEMO_BRIEF.locationLabel} · ${DEMO_BRIEF.confidencePercent}% confidence`,
      ...buildMapPreview(null, null, resolvedId),
    };
  }

  const resolvedPanelCategoryId =
    panelCategoryId ?? result.recommendation.panel_category_id;
  const sizing = computeSizingForPanelClass(result, resolvedPanelCategoryId);
  const confidence: PredictionConfidence = buildPredictionConfidence({
    result,
    roofPolygon,
    energyInputs,
  });

  if (!sizing) {
    return {
      locationLabel: formatBriefLocation(selectedProperty, result.property),
      confidencePercent: confidence.overallPercent,
      defaultPanelCategoryId: result.recommendation.panel_category_id,
      panelCategoryId: resolvedPanelCategoryId,
      panelClassHint: buildPanelClassHint(
        resolvedPanelCategoryId,
        Number(result.roof.usable_area_m2),
      ),
      systemRows: buildSystemRows(result, {
        panelCount: result.recommendation.panel_count,
        systemCapacityKwp: Number(result.recommendation.system_capacity_kwp),
      }),
      financialRows: buildFinancialRows({
        monthlySavingsPhp: result.financials.monthly_savings_php,
        annualSavingsPhp: result.financials.annual_savings_php,
        billCoverageRatio: Number(
          result.recommendation.annual_consumption_offset_ratio,
        ),
        paybackYears: Number(result.financials.payback_years),
      }),
      disclaimer: buildDisclaimer(result),
      shareText: `Kahayag solar brief · ${formatBriefLocation(selectedProperty, result.property)} · ${confidence.overallPercent}% confidence`,
      ...buildMapPreview(
        result,
        {
          panelCount: result.recommendation.panel_count,
          panelWattageW: result.recommendation.panel_wattage_w,
        },
        resolvedPanelCategoryId,
      ),
    };
  }

  const locationLabel = formatBriefLocation(selectedProperty, result.property);

  return {
    locationLabel,
    confidencePercent: confidence.overallPercent,
    defaultPanelCategoryId: result.recommendation.panel_category_id,
    panelCategoryId: resolvedPanelCategoryId,
    panelClassHint: buildPanelClassHint(
      resolvedPanelCategoryId,
      Number(result.roof.usable_area_m2),
    ),
    systemRows: buildSystemRows(result, sizing),
    financialRows: buildFinancialRows(sizing),
    disclaimer: buildDisclaimer(result),
    shareText: `Kahayag solar brief · ${locationLabel} · ${confidence.overallPercent}% confidence · ${Number(sizing.systemCapacityKwp).toFixed(1)} kW`,
    ...buildMapPreview(result, sizing, resolvedPanelCategoryId),
  };
}

export function formatReportDate(date: Date = new Date()): string {
  return REPORT_DATE_FORMATTER.format(date);
}

function parseIsoDate(isoDate: string): Date | null {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function resolveReportDateLabel(
  result: Pick<AssessmentResult, "property"> | null,
  generatedAt: Date = new Date(),
): string {
  const isoDate =
    result?.property?.assessment_date ?? (result ? null : DEMO_REPORT_DATE_ISO);
  const parsed = isoDate ? parseIsoDate(isoDate) : null;

  return formatReportDate(parsed ?? generatedAt);
}

export function formatReportPageCount(
  pageCount: number = REPORT_PAGE_COUNT,
): string {
  return `${pageCount} page${pageCount === 1 ? "" : "s"}`;
}

export function formatReportSizeLabel(
  sizeMb: number = REPORT_ESTIMATED_SIZE_MB,
): string {
  return `about ${sizeMb} MB`;
}

export interface ReportPreview {
  title: string;
  locationLabel: string;
  dateLabel: string;
  pageCountLabel: string;
  sizeLabel: string;
  metaLine: string;
  footerCaption: string;
  contents: readonly string[];
}

export function buildReportPreview({
  result = null,
  selectedProperty = null,
  roofPolygon = null,
  energyInputs = null,
  panelCategoryId,
  generatedAt = new Date(),
}: {
  result?: AssessmentResult | null;
  selectedProperty?: { address?: string | null } | null;
  roofPolygon?: RoofPolygon | null;
  energyInputs?: EnergyInputs | null;
  panelCategoryId?: string;
  generatedAt?: Date;
} = {}): ReportPreview {
  const brief = buildProjectBrief({
    result,
    selectedProperty,
    roofPolygon,
    energyInputs,
    panelCategoryId,
  });
  const dateLabel = resolveReportDateLabel(result, generatedAt);
  const pageCountLabel = formatReportPageCount(REPORT_PAGE_COUNT);
  const sizeLabel = formatReportSizeLabel(REPORT_ESTIMATED_SIZE_MB);

  return {
    title: REPORT_TITLE,
    locationLabel: brief.locationLabel,
    dateLabel,
    pageCountLabel,
    sizeLabel,
    metaLine: `${brief.locationLabel} · ${dateLabel} · ${pageCountLabel}`,
    footerCaption: `No account needed · ${sizeLabel}`,
    contents: REPORT_CONTENTS,
  };
}

export type ShareResult = "shared" | "copied" | "unsupported";

export async function shareProjectBrief(
  shareText: string,
): Promise<ShareResult> {
  const url = window.location.href;

  if (navigator.share) {
    await navigator.share({
      title: "Kahayag project brief",
      text: shareText,
      url,
    });
    return "shared";
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${shareText}\n${url}`);
    return "copied";
  }

  return "unsupported";
}
