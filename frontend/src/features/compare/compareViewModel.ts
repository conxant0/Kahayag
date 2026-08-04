// Maps design session builds into compare-page view models.
import type { DesignBuild, DesignSession } from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";

export type CompareMetric = {
  label: string;
  value: string;
};

export type CompareBuildView = {
  build: DesignBuild;
  isSuggested: boolean;
  metrics: CompareMetric[];
  technicalRows: CompareMetric[];
};

export function costPerWatt(build: DesignBuild): number {
  const watts = build.system_kwp * 1000;
  if (watts <= 0) {
    return 0;
  }
  return build.total_investment_php / watts;
}

export function formatCostPerWatt(build: DesignBuild): string {
  return `₱${costPerWatt(build).toFixed(0)}/W`;
}

export function compareBuilds(session: DesignSession): CompareBuildView[] {
  const suggested =
    session.builds.find((build) => build.source === "ai_suggested") ??
    [...session.builds].sort((a, b) => b.fit_score - a.fit_score)[0];
  const alternate =
    session.builds.find((build) => build.source === "custom") ??
    session.builds.find((build) => build.id !== suggested?.id);

  const ordered = [suggested, alternate].filter(
    (build): build is DesignBuild => build !== undefined,
  );

  return ordered.map((build) => ({
    build,
    isSuggested: build.id === suggested?.id,
    metrics: overviewMetrics(build),
    technicalRows: technicalMetrics(build),
  }));
}

function overviewMetrics(build: DesignBuild): CompareMetric[] {
  return [
    { label: "Total cost", value: peso(build.total_investment_php) },
    { label: "Cost per watt", value: formatCostPerWatt(build) },
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
      value: build.system_kwp > 0 && build.inverter_kw > 0
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
  ];
}
