// Maps uploaded quote audits into compare-page card view models.
import type { DesignComponent, QuoteAuditResponse } from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";
import { quoteAuditLabel } from "./quoteAuditIds";

export type CompareSpecRow = {
  label: string;
  value: string;
};

export type CompareQuoteView = {
  result: QuoteAuditResponse;
  index: number;
  label: string;
  trait: string;
  capacityLabel: string;
  quotedTotalLabel: string;
  benchmarkDeltaLabel: string;
  benchmarkRatioPct: number;
  overviewSpecs: CompareSpecRow[];
  technicalRows: CompareSpecRow[];
  insight: string;
  hasDiagram: boolean;
};

function componentLine(
  components: DesignComponent[],
  slot: DesignComponent["slot"],
): DesignComponent | undefined {
  return components.find((component) => component.slot === slot);
}

function overviewSpecs(result: QuoteAuditResponse): CompareSpecRow[] {
  const panel = componentLine(result.diagram_components, "panel");
  const inverter = componentLine(result.diagram_components, "inverter");
  const battery = componentLine(result.diagram_components, "battery");

  return [
    {
      label: "Panels",
      value:
        typeof result.extracted_panel_count === "number"
          ? `${result.extracted_panel_count} panels`
          : panel
            ? `${panel.qty} × ${panel.model}`
            : "—",
    },
    {
      label: "Power inverter",
      value: inverter ? `${inverter.brand} · ${inverter.model}` : "—",
    },
    {
      label: "Battery storage",
      value:
        battery && battery.qty > 0
          ? `${battery.brand} ${battery.model}`
          : "None included",
    },
  ];
}

function technicalRows(result: QuoteAuditResponse): CompareSpecRow[] {
  const panel = componentLine(result.diagram_components, "panel");
  const inverter = componentLine(result.diagram_components, "inverter");
  const battery = componentLine(result.diagram_components, "battery");
  const partsTotal = result.diagram_components.reduce(
    (sum, component) => sum + component.line_total_php,
    0,
  );

  const costPerWatt =
    typeof result.extracted_total_php === "number" &&
    typeof result.extracted_system_kwp === "number" &&
    result.extracted_system_kwp > 0
      ? `₱${(result.extracted_total_php / (result.extracted_system_kwp * 1000)).toFixed(0)}/W`
      : "—";

  return [
    {
      label: "System size",
      value:
        typeof result.extracted_system_kwp === "number"
          ? `${result.extracted_system_kwp.toFixed(2)} kWp`
          : "—",
    },
    {
      label: "Panel count",
      value:
        typeof result.extracted_panel_count === "number"
          ? `${result.extracted_panel_count} panels`
          : "—",
    },
    {
      label: "Panels",
      value: panel ? `${panel.brand} ${panel.model}` : "—",
    },
    {
      label: "Inverter",
      value: inverter ? `${inverter.brand} ${inverter.model}` : "—",
    },
    {
      label: "Battery",
      value:
        battery && battery.qty > 0
          ? `${battery.brand} ${battery.model}`
          : "None (grid-tie)",
    },
    {
      label: "Total cost",
      value:
        typeof result.extracted_total_php === "number"
          ? peso(result.extracted_total_php)
          : "—",
    },
    {
      label: "Cost per watt",
      value: costPerWatt,
    },
    {
      label: "Parts subtotal",
      value: partsTotal > 0 ? peso(partsTotal) : "—",
    },
    {
      label: "Kahayag benchmark",
      value: peso(result.benchmark_total_php),
    },
    {
      label: "Audit findings",
      value: `${result.findings.length} item${result.findings.length === 1 ? "" : "s"}`,
    },
  ];
}

function benchmarkComparison(result: QuoteAuditResponse): {
  deltaLabel: string;
  ratioPct: number;
} {
  const extracted = result.extracted_total_php;
  const benchmark = result.benchmark_total_php;

  if (typeof extracted !== "number" || benchmark <= 0) {
    return {
      deltaLabel: "Could not compare to Kahayag benchmark",
      ratioPct: 100,
    };
  }

  const delta = extracted - benchmark;
  const pct = (delta / benchmark) * 100;
  const direction =
    delta === 0
      ? "Matches Kahayag benchmark"
      : delta > 0
        ? `${peso(delta)} above benchmark (${pct.toFixed(1)}%)`
        : `${peso(Math.abs(delta))} below benchmark (${Math.abs(pct).toFixed(1)}%)`;

  return {
    deltaLabel: direction,
    ratioPct: Math.min(150, Math.max(40, (extracted / benchmark) * 100)),
  };
}

export function compareQuotes(results: QuoteAuditResponse[]): CompareQuoteView[] {
  return results.map((result, index) => {
    const comparison = benchmarkComparison(result);

    return {
      result,
      index,
      label: quoteAuditLabel(result, index),
      trait: "Uploaded quote",
      capacityLabel:
        typeof result.extracted_system_kwp === "number"
          ? `${result.extracted_system_kwp.toFixed(1)} kWp`
          : "Size unknown",
      quotedTotalLabel:
        typeof result.extracted_total_php === "number"
          ? peso(result.extracted_total_php)
          : "—",
      benchmarkDeltaLabel: comparison.deltaLabel,
      benchmarkRatioPct: comparison.ratioPct,
      overviewSpecs: overviewSpecs(result),
      technicalRows: technicalRows(result),
      insight: result.summary,
      hasDiagram: result.diagram_components.length > 0,
    };
  });
}
