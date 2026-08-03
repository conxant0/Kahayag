// Derives the headline confidence score and factor breakdown for /why.
import type { AssessmentResult, RoofPolygon } from "../../shared/api/types";

const FACTOR_WEIGHTS = Object.freeze({
  roofGeometry: 0.25,
  solarIrradiance: 0.3,
  shading: 0.25,
  localGridData: 0.2,
});

const DEFAULT_ELECTRICITY_RATE = 12;

interface ConfidenceFactor {
  name: string;
  source: string;
  confidence: string;
  high: boolean;
}

interface ConfidenceLabel {
  confidence: string;
  high: boolean;
}

function confidenceLabelFromScore(score: number): ConfidenceLabel {
  if (score >= 85) {
    return { confidence: "High", high: true };
  }

  if (score >= 65) {
    return { confidence: "Medium", high: false };
  }

  return { confidence: "Low", high: false };
}

function scoreRoofGeometry(
  roofPolygon: RoofPolygon | null,
  roof: AssessmentResult["roof"] | undefined,
): { score: number; source: string } {
  const hasTrace =
    Array.isArray(roofPolygon?.coordinates) && roofPolygon.coordinates.length >= 3;

  if (hasTrace) {
    return {
      score: 90,
      source: "Your confirmed roof trace",
    };
  }

  if (roof?.usable_area_m2) {
    return {
      score: 78,
      source: "LiDAR 3D mapping",
    };
  }

  return {
    score: 65,
    source: "Planning fallback area",
  };
}

function scoreSolarIrradiance(
  assumptions: AssessmentResult["assumptions"] | undefined,
): { score: number; source: string } {
  const source = assumptions?.solar_resource_source;

  if (source === "google_solar_api") {
    const sunshineHours = Number(assumptions?.annual_sunshine_hours_per_kwp);
    return {
      score: 95,
      source: Number.isFinite(sunshineHours)
        ? `Location-specific · ${Math.round(sunshineHours).toLocaleString("en-PH")} h/kWp/yr`
        : "10-year satellite average",
    };
  }

  return {
    score: 72,
    source: "Nationwide planning average",
  };
}

function scoreShading(
  shading: AssessmentResult["shading"],
): { score: number; source: string; confidence: string; high: boolean } {
  if (!shading) {
    return {
      score: 70,
      source: "Nearby vegetation & obstacles",
      confidence: "Medium",
      high: false,
    };
  }

  const retention = Number(shading.sunshine_retention_ratio);
  const score = Math.round(retention * 100);
  const impact = shading.shading_impact;

  let label: ConfidenceLabel;
  if (impact === "low" || score >= 90) {
    label = { confidence: "High", high: true };
  } else if (impact === "moderate" || score >= 75) {
    label = { confidence: "Medium", high: false };
  } else {
    label = { confidence: "Low", high: false };
  }

  const source =
    shading.data_source === "google_solar_api"
      ? "Nearby vegetation & obstacles · satellite shading map"
      : "Nearby vegetation & obstacles";

  return { score, source, ...label };
}

interface EnergyInputs {
  electricityRatePhpPerKwh?: number;
}

function scoreLocalGrid(
  inputs: AssessmentResult["inputs"] | undefined,
  energyInputs: EnergyInputs | null,
): { score: number; source: string } {
  const rate = Number(
    inputs?.electricity_rate_php_per_kwh ??
      energyInputs?.electricityRatePhpPerKwh ??
      DEFAULT_ELECTRICITY_RATE,
  );

  if (Math.abs(rate - DEFAULT_ELECTRICITY_RATE) < 0.01) {
    return {
      score: 85,
      source: "VECO planning rate · confirm on your bill",
    };
  }

  return {
    score: 92,
    source: "Your entered electricity rate",
  };
}

function buildActualProductionFactor(): ConfidenceFactor {
  return {
    name: "Actual production",
    source: "Syncs after installation",
    confidence: "N/A",
    high: false,
  };
}

function weightedOverallPercent(scores: {
  roofGeometry: number;
  solarIrradiance: number;
  shading: number;
  localGridData: number;
}): number {
  const total =
    scores.roofGeometry * FACTOR_WEIGHTS.roofGeometry +
    scores.solarIrradiance * FACTOR_WEIGHTS.solarIrradiance +
    scores.shading * FACTOR_WEIGHTS.shading +
    scores.localGridData * FACTOR_WEIGHTS.localGridData;

  return Math.round(total);
}

export interface PredictionConfidence {
  overallPercent: number;
  factors: ConfidenceFactor[];
  intro: string;
  advancedAnalysis: string;
}

export function buildPredictionConfidence({
  result,
  roofPolygon = null,
  energyInputs = null,
}: {
  result: AssessmentResult | null;
  roofPolygon?: RoofPolygon | null;
  energyInputs?: EnergyInputs | null;
}): PredictionConfidence {
  if (!result) {
    throw new Error("A completed assessment result is required for confidence.");
  }

  const roof = scoreRoofGeometry(roofPolygon, result.roof);
  const solar = scoreSolarIrradiance(result.assumptions);
  const shading = scoreShading(result.shading);
  const grid = scoreLocalGrid(result.inputs, energyInputs);

  const overallPercent = weightedOverallPercent({
    roofGeometry: roof.score,
    solarIrradiance: solar.score,
    shading: shading.score,
    localGridData: grid.score,
  });

  const roofLabel = confidenceLabelFromScore(roof.score);
  const solarLabel = confidenceLabelFromScore(solar.score);
  const gridLabel = confidenceLabelFromScore(grid.score);

  const factors: ConfidenceFactor[] = [
    {
      name: "Roof geometry",
      source: roof.source,
      ...roofLabel,
    },
    {
      name: "Solar irradiance",
      source: solar.source,
      ...solarLabel,
    },
    {
      name: "Shading",
      source: shading.source,
      confidence: shading.confidence,
      high: shading.high,
    },
    {
      name: "Local grid data",
      source: grid.source,
      ...gridLabel,
    },
    buildActualProductionFactor(),
  ];

  const utilityHint =
    Math.abs(
      Number(result.inputs?.electricity_rate_php_per_kwh) - DEFAULT_ELECTRICITY_RATE,
    ) < 0.01
      ? "VECO rates"
      : "your electricity rate";

  const intro = `Think of it as a weather forecast for your energy bills — your roof's geometry, ${
    result.assumptions?.solar_resource_source === "google_solar_api"
      ? "location-specific sunshine data"
      : "regional sunshine averages"
  }, and ${utilityHint} in one projection.`;

  return {
    overallPercent,
    factors,
    intro,
    advancedAnalysis: buildAdvancedAnalysisDetail(result),
  };
}

export function buildAdvancedAnalysisDetail(
  result: AssessmentResult,
): string {
  const parts: string[] = [];
  const assumptions = result.assumptions;
  const shading = result.shading;

  if (assumptions) {
    parts.push(
      `Annual yield uses ${Number(assumptions.peak_sun_hours_per_day).toFixed(1)} peak sun hours/day at a ${Math.round(Number(assumptions.performance_ratio) * 100)}% performance ratio.`,
    );
  }

  parts.push(
    "Generation declines by 0.5%/year across the 25-year warranty horizon.",
  );

  if (shading?.sunshine_retention_ratio != null) {
    parts.push(
      `Shading analysis retained ${Math.round(Number(shading.sunshine_retention_ratio) * 100)}% of available sunshine on your roof.`,
    );
  }

  if (shading?.data_source === "google_solar_api") {
    parts.push(
      "A satellite shading map informed panel placement across your traced roof.",
    );
  }

  return parts.join(" ");
}

export function formatConfidenceHeading(percent: number): string {
  return `${percent}%`;
}
