// Builds unified compare columns and spec matrix rows for side-by-side layout.
import type { DesignComponent, DesignSession, QuoteAuditResponse } from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";
import { quoteAuditId, quoteAuditLabel } from "./quoteAuditIds";
import {
  compareBuilds,
  formatInvestmentRange,
  type CompareBuildView,
} from "./compareViewModel";

export type CompareColumn = {
  id: string;
  kind: "build" | "quote";
  label: string;
  trait: string;
  isSuggested: boolean;
  components: DesignComponent[];
  buildView?: CompareBuildView;
  quote?: QuoteAuditResponse;
};

export type CompareMatrixRow = {
  label: string;
  values: [string, string];
};

export const EMPTY_COMPARE_COLUMN_ID = "";

export function compareColumns(
  session: DesignSession,
  quoteResults: QuoteAuditResponse[],
): CompareColumn[] {
  const columns: CompareColumn[] = compareBuilds(session).map((buildView) => ({
    id: buildView.build.id,
    kind: "build",
    label: buildView.build.label,
    trait: buildView.trait,
    isSuggested: buildView.isSuggested,
    components: buildView.build.components,
    buildView,
  }));

  quoteResults.forEach((quoteResult, index) => {
    if (quoteResult.diagram_components.length === 0) {
      return;
    }
    columns.push({
      id: quoteAuditId(quoteResult, index),
      kind: "quote",
      label: quoteAuditLabel(quoteResult, index),
      trait: "Uploaded quote",
      isSuggested: false,
      components: quoteResult.diagram_components,
      quote: quoteResult,
    });
  });

  return columns;
}

function componentLine(
  components: DesignComponent[],
  slot: DesignComponent["slot"],
): DesignComponent | undefined {
  return components.find((component) => component.slot === slot);
}

function buildSpecValue(column: CompareColumn, label: string): string {
  const build = column.buildView?.build;
  if (!build || !column.buildView) {
    return "—";
  }

  const panel = componentLine(build.components, "panel");
  const inverter = componentLine(build.components, "inverter");
  const battery = componentLine(build.components, "battery");

  switch (label) {
    case "System size":
      return `${build.system_kwp.toFixed(2)} kWp`;
    case "Panel count":
      return `${build.panel_count} panels`;
    case "Panels":
      return panel ? `${panel.brand} ${panel.model}` : "—";
    case "Inverter":
      return inverter
        ? `${inverter.brand} ${inverter.model} (${build.inverter_kw} kW)`
        : `${build.inverter_kw} kW`;
    case "Battery":
      return battery
        ? `${battery.brand} ${battery.model}`
        : build.battery_kwh
          ? `${build.battery_kwh} kWh`
          : "None (grid-tie)";
    case "DC:AC ratio":
      return build.system_kwp > 0 && build.inverter_kw > 0
        ? (build.system_kwp / build.inverter_kw).toFixed(2)
        : "—";
    case "Monthly savings":
      return column.buildView.monthlySavingsLabel;
    case "Annual savings":
      return peso(build.annual_savings_php);
    case "Payback":
      return column.buildView.paybackLabel;
    case "Total cost":
      return formatInvestmentRange(build);
    case "Inverter utilisation":
      return `${build.inverter_utilisation_pct.toFixed(0)}%`;
    case "CO₂ avoided":
      return `${build.co2_tonnes_avoided_yearly.toFixed(1)} t/yr`;
    case "Fit score":
      return build.fit_score.toFixed(1);
    case "Parts subtotal":
      return peso(build.subtotal_php);
    default:
      return "—";
  }
}

function quoteSpecValue(column: CompareColumn, label: string): string {
  const quote = column.quote;
  if (!quote) {
    return "—";
  }

  const panel = componentLine(quote.diagram_components, "panel");
  const inverter = componentLine(quote.diagram_components, "inverter");
  const battery = componentLine(quote.diagram_components, "battery");
  const partsTotal = quote.diagram_components.reduce(
    (sum, component) => sum + component.line_total_php,
    0,
  );

  switch (label) {
    case "System size":
      return typeof quote.extracted_system_kwp === "number"
        ? `${quote.extracted_system_kwp.toFixed(2)} kWp`
        : "—";
    case "Panel count":
      return typeof quote.extracted_panel_count === "number"
        ? `${quote.extracted_panel_count} panels`
        : "—";
    case "Panels":
      return panel ? `${panel.brand} ${panel.model}` : "—";
    case "Inverter":
      return inverter ? `${inverter.brand} ${inverter.model}` : "—";
    case "Battery":
      return battery && battery.qty > 0
        ? `${battery.brand} ${battery.model}`
        : "None (grid-tie)";
    case "DC:AC ratio":
      return "—";
    case "Monthly savings":
    case "Annual savings":
    case "Payback":
    case "Inverter utilisation":
    case "CO₂ avoided":
    case "Fit score":
      return "—";
    case "Total cost":
      return typeof quote.extracted_total_php === "number"
        ? peso(quote.extracted_total_php)
        : "—";
    case "Parts subtotal":
      return partsTotal > 0 ? peso(partsTotal) : "—";
    default:
      return "—";
  }
}

const COMPARISON_ROW_LABELS = [
  "System size",
  "Panel count",
  "Panels",
  "Inverter",
  "Battery",
  "DC:AC ratio",
  "Monthly savings",
  "Annual savings",
  "Payback",
  "Total cost",
  "Inverter utilisation",
  "CO₂ avoided",
  "Fit score",
  "Parts subtotal",
] as const;

export function comparisonMatrix(
  left: CompareColumn,
  right: CompareColumn | null,
): CompareMatrixRow[] {
  const leftValue = (column: CompareColumn, label: string) =>
    column.kind === "build" ? buildSpecValue(column, label) : quoteSpecValue(column, label);

  return COMPARISON_ROW_LABELS.map((label) => ({
    label,
    values: [
      leftValue(left, label),
      right ? leftValue(right, label) : "—",
    ],
  }));
}

export function defaultComparePair(columns: CompareColumn[]): [string, string] {
  if (columns.length === 0) {
    return ["", ""];
  }
  if (columns.length === 1) {
    return [columns[0]!.id, EMPTY_COMPARE_COLUMN_ID];
  }

  const suggested = columns.find((column) => column.isSuggested) ?? columns[0]!;
  const quotes = columns.filter((column) => column.kind === "quote");
  const quote = quotes[quotes.length - 1];
  const other =
    columns.find((column) => column.id !== suggested.id && column.kind === "build") ??
    columns.find((column) => column.id !== suggested.id);

  if (quote) {
    return [suggested.id, quote.id];
  }

  return [suggested.id, other?.id ?? columns[1]!.id];
}

export function resolveComparePair(
  columns: CompareColumn[],
  leftId: string,
  rightId: string,
): [CompareColumn | null, CompareColumn | null] {
  if (columns.length === 0) {
    return [null, null];
  }

  const resolveLeft = (id: string) => columns.find((column) => column.id === id) ?? columns[0]!;
  const resolveRight = (id: string) => {
    if (!id || id === EMPTY_COMPARE_COLUMN_ID) {
      return null;
    }
    const column = columns.find((candidate) => candidate.id === id);
    return column ?? null;
  };

  const left = resolveLeft(leftId);
  const right = resolveRight(rightId);
  if (right && right.id !== left.id) {
    return [left, right];
  }

  const [fallbackLeft, fallbackRight] = defaultComparePair(columns);
  const resolvedLeft = columns.find((column) => column.id === fallbackLeft) ?? left;
  const resolvedRight = resolveRight(fallbackRight);
  if (resolvedRight && resolvedRight.id !== resolvedLeft.id) {
    return [resolvedLeft, resolvedRight];
  }

  return [resolvedLeft, null];
}
