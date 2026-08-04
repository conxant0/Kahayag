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
  verdictLabel: string;
  verdictTone: "positive" | "caution" | "review";
  pros: string[];
  cons: string[];
  questionsForInstaller: string[];
  auditFindings: QuoteAuditResponse["findings"];
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
      label: "Solar panels",
      value:
        typeof result.extracted_panel_count === "number"
          ? `${result.extracted_panel_count} panels on your roof`
          : panel
            ? `${panel.qty} × ${panel.model}`
            : "Not listed clearly",
    },
    {
      label: "Inverter",
      value: inverter
        ? `${inverter.brand} ${inverter.model}`
        : "Not listed clearly",
    },
    {
      label: "Battery backup",
      value:
        battery && battery.qty > 0
          ? `${battery.brand} ${battery.model}`
          : "None — grid power only",
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
      ? `₱${(result.extracted_total_php / (result.extracted_system_kwp * 1000)).toFixed(0)} per watt`
      : "—";

  return [
    {
      label: "System size",
      value:
        typeof result.extracted_system_kwp === "number"
          ? `${result.extracted_system_kwp.toFixed(1)} kW`
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
      label: "Solar panels",
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
          : "None",
    },
    {
      label: "Quoted price",
      value:
        typeof result.extracted_total_php === "number"
          ? peso(result.extracted_total_php)
          : "—",
    },
    {
      label: "Price per watt",
      value: costPerWatt,
    },
    {
      label: "Parts subtotal",
      value: partsTotal > 0 ? peso(partsTotal) : "—",
    },
    {
      label: "Expected for your roof",
      value: peso(result.benchmark_total_php),
    },
    {
      label: "Review notes",
      value: `${result.findings.length} point${result.findings.length === 1 ? "" : "s"} checked`,
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
      deltaLabel: "We couldn't compare this price to our estimate",
      ratioPct: 100,
    };
  }

  const delta = extracted - benchmark;
  const pct = (delta / benchmark) * 100;
  const direction =
    delta === 0
      ? "About the same as we'd expect for your roof"
      : delta > 0
        ? `${peso(delta)} higher than expected (${pct.toFixed(1)}%)`
        : `${peso(Math.abs(delta))} lower than expected (${Math.abs(pct).toFixed(1)}%)`;

  return {
    deltaLabel: direction,
    ratioPct: Math.min(150, Math.max(40, (extracted / benchmark) * 100)),
  };
}

function verdictPresentation(
  verdict: QuoteAuditResponse["verdict"],
): { label: string; tone: CompareQuoteView["verdictTone"] } {
  switch (verdict) {
    case "favorable":
      return { label: "Looks like a fair deal", tone: "positive" };
    case "caution":
      return { label: "Worth a closer look", tone: "caution" };
    default:
      return { label: "Review carefully before signing", tone: "review" };
  }
}

export function compareQuotes(results: QuoteAuditResponse[]): CompareQuoteView[] {
  return results.map((result, index) => {
    const comparison = benchmarkComparison(result);
    const verdict = verdictPresentation(result.verdict ?? "needs_review");

    return {
      result,
      index,
      label: quoteAuditLabel(result, index),
      trait: "Uploaded quote",
      capacityLabel:
        typeof result.extracted_system_kwp === "number"
          ? `${result.extracted_system_kwp.toFixed(1)} kW system`
          : "Size unclear",
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
      verdictLabel: verdict.label,
      verdictTone: verdict.tone,
      pros: result.pros ?? [],
      cons: result.cons ?? [],
      questionsForInstaller: result.questions_for_installer ?? [],
      auditFindings: result.findings,
    };
  });
}
