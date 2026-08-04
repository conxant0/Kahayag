// Maps design session builds into compare-page view models.
import type { DesignBuild, DesignSession } from "../../shared/api/types";
import { peso, pesoRange, pesoRangeCompact } from "../../shared/lib/currency";

export type CompareMetric = {
  label: string;
  value: string;
};

export type CompareSpecRow = {
  label: string;
  value: string;
};

export type CompareBuildView = {
  build: DesignBuild;
  isSuggested: boolean;
  trait: string;
  capacityLabel: string;
  monthlySavingsLabel: string;
  paybackLabel: string;
  totalInvestmentLabel: string;
  utilisationPct: number;
  insight: string;
  overviewSpecs: CompareSpecRow[];
  metrics: CompareMetric[];
  technicalRows: CompareMetric[];
};

export function formatInvestmentRange(build: DesignBuild): string {
  const useCompact =
    build.total_investment_low_php >= 1_000_000 ||
    build.total_investment_high_php >= 1_000_000;
  return useCompact
    ? pesoRangeCompact(
        build.total_investment_low_php,
        build.total_investment_high_php,
      )
    : pesoRange(build.total_investment_low_php, build.total_investment_high_php);
}

export function compareBuilds(session: DesignSession): CompareBuildView[] {
  const suggested =
    session.builds.find((build) => build.source === "ai_suggested") ??
    [...session.builds].sort((a, b) => b.fit_score - a.fit_score)[0];
  const customBuilds = session.builds.filter((build) => build.source === "custom");

  const ordered = [suggested, ...customBuilds].filter(
    (build, index, builds): build is DesignBuild =>
      build !== undefined && builds.indexOf(build) === index,
  );

  return ordered.map((build) => {
    const isSuggested = build.id === suggested?.id;
    return {
      build,
      isSuggested,
      trait: primaryTrait(build, isSuggested),
      capacityLabel: `${build.system_kwp.toFixed(1)} kWp`,
      monthlySavingsLabel: peso(build.monthly_savings_php),
      paybackLabel: build.payback_years
        ? `${build.payback_years.toFixed(1)} years`
        : "—",
      totalInvestmentLabel: formatInvestmentRange(build),
      utilisationPct: build.inverter_utilisation_pct,
      insight: build.insight,
      overviewSpecs: overviewSpecs(build),
      metrics: overviewMetrics(build),
      technicalRows: technicalMetrics(build),
    };
  });
}

function primaryTrait(build: DesignBuild, isSuggested: boolean): string {
  const nonRibbon = build.tags.find(
    (tag) => tag.toUpperCase() !== "BEST ALL-ROUND",
  );
  if (nonRibbon) {
    return nonRibbon;
  }
  if (isSuggested) {
    return "Highest performance";
  }
  return "Fastest payback";
}

function overviewSpecs(build: DesignBuild): CompareSpecRow[] {
  const panel = build.components.find((component) => component.slot === "panel");
  const inverter = build.components.find(
    (component) => component.slot === "inverter",
  );
  const battery = build.components.find(
    (component) => component.slot === "battery",
  );
  const panelWatts =
    typeof panel?.specs.wattage_w === "number" ? panel.specs.wattage_w : null;

  return [
    {
      label: "Panels",
      value: panel
        ? `${build.panel_count} × ${panelWatts ? `${panelWatts} W` : panel.model}`
        : `${build.panel_count} panels`,
    },
    {
      label: "Power inverter",
      value: inverter
        ? `${build.inverter_kw} kW · ${inverter.brand}`
        : `${build.inverter_kw} kW`,
    },
    {
      label: "Battery storage",
      value: battery
        ? `${build.battery_kwh ?? "—"} kWh ${battery.brand}`
        : build.battery_kwh
          ? `${build.battery_kwh} kWh`
          : "None included",
    },
  ];
}

function overviewMetrics(build: DesignBuild): CompareMetric[] {
  return [
    { label: "Total cost", value: peso(build.total_investment_php) },
    {
      label: "Payback",
      value: build.payback_years ? `${build.payback_years.toFixed(1)} years` : "—",
    },
    {
      label: "Inverter utilisation",
      value: `${build.inverter_utilisation_pct.toFixed(0)}%`,
    },
    { label: "Fit score", value: build.fit_score.toFixed(1) },
  ];
}

function technicalMetrics(build: DesignBuild): CompareMetric[] {
  const panel = build.components.find((component) => component.slot === "panel");
  const inverter = build.components.find(
    (component) => component.slot === "inverter",
  );
  const battery = build.components.find(
    (component) => component.slot === "battery",
  );

  return [
    { label: "System size", value: `${build.system_kwp.toFixed(2)} kWp` },
    { label: "Panel count", value: `${build.panel_count} panels` },
    {
      label: "Panels",
      value: panel ? `${panel.brand} ${panel.model}` : "—",
    },
    {
      label: "Inverter",
      value: inverter
        ? `${inverter.brand} ${inverter.model} (${build.inverter_kw} kW)`
        : `${build.inverter_kw} kW`,
    },
    {
      label: "Battery",
      value: battery
        ? `${battery.brand} ${battery.model}`
        : build.battery_kwh
          ? `${build.battery_kwh} kWh`
          : "None (grid-tie)",
    },
    {
      label: "DC:AC ratio",
      value:
        build.system_kwp > 0 && build.inverter_kw > 0
          ? (build.system_kwp / build.inverter_kw).toFixed(2)
          : "—",
    },
    {
      label: "Annual savings",
      value: peso(build.annual_savings_php),
    },
    {
      label: "CO₂ avoided",
      value: `${build.co2_tonnes_avoided_yearly.toFixed(1)} t/yr`,
    },
    { label: "Fit score", value: build.fit_score.toFixed(1) },
  ];
}
