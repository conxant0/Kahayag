// Maps design session state into canvas and summary view models.
import type {
  BuildSource,
  ComponentSlot,
  DesignBuild,
  DesignComponent,
  DesignSession,
  QuoteAuditResponse,
  RejectionReason,
  SolverGoal,
} from "../../shared/api/types";
import { quoteAuditId, quoteAuditLabel } from "../compare/quoteAuditIds";
import { pesoRange } from "../../shared/lib/currency";

const SLOT_ORDER: ComponentSlot[] = [
  "panel",
  "inverter",
  "protection",
  "battery",
];

const SLOT_LABELS: Record<ComponentSlot, string> = {
  panel: "Energy capture",
  inverter: "Power converter",
  battery: "Energy store",
  protection: "Protection",
  structure: "Structure",
  electrical: "Electrical",
  installation: "Installation",
};

const CANVAS_SLOT_HEADERS: Record<ComponentSlot, string> = {
  panel: "PV equipment",
  inverter: "Power hub",
  battery: "Energy store",
  protection: "Protection layer",
  structure: "Structure",
  electrical: "Electrical",
  installation: "Installation",
};

export type CanvasViewMode = "simplified" | "full";

export const CANVAS_VIEW_OPTIONS: ReadonlyArray<{
  value: CanvasViewMode;
  label: string;
}> = [
  { value: "simplified", label: "Simplified" },
  { value: "full", label: "Full BOM" },
];

const FULL_VIEW_GROUP_ORDER: ComponentSlot[] = [
  "protection",
  "structure",
  "electrical",
  "installation",
];

const BOS_SLOTS: ComponentSlot[] = FULL_VIEW_GROUP_ORDER;

function isFromQuoteComponent(component: DesignComponent): boolean {
  return component.badges.some((badge) => badge.toUpperCase().includes("QUOTE"));
}

export function isAggregatedBosComponent(component: DesignComponent): boolean {
  return (
    BOS_SLOTS.includes(component.slot) &&
    component.model.endsWith(" items") &&
    /^\d+ items$/.test(component.model)
  );
}

function aggregateBosComponents(items: DesignComponent[]): DesignComponent | undefined {
  if (items.length === 0) {
    return undefined;
  }
  if (items.length === 1) {
    return items[0];
  }

  const lineTotal = items.reduce((sum, component) => sum + component.line_total_php, 0);
  const fromQuote = items.every(isFromQuoteComponent);

  return {
    slot: "protection",
    catalog_id: null,
    brand: fromQuote ? "Quoted" : "Included",
    model: `${items.length} items`,
    summary: "Balance of system",
    qty: 1,
    unit: "lot",
    unit_price_php: lineTotal,
    price_as_of: items[0]?.price_as_of ?? null,
    line_total_php: lineTotal,
    warranty_note: "",
    badges: fromQuote ? (["FROM QUOTE"] as DesignComponent["badges"]) : (["INCLUDED"] as DesignComponent["badges"]),
    specs: {},
  };
}

export type CanvasBomGroup = {
  slot: ComponentSlot;
  label: string;
  components: DesignComponent[];
};

export function getActiveBuild(session: DesignSession | null): DesignBuild | null {
  if (!session) {
    return null;
  }
  return (
    session.builds.find((build) => build.id === session.active_build_id) ??
    session.builds[0] ??
    null
  );
}

export const QUOTE_DIAGRAM_SOURCE_PREFIX = "quote:";

export function isQuoteDiagramSource(value: string): boolean {
  return value.startsWith(QUOTE_DIAGRAM_SOURCE_PREFIX);
}

export type DiagramSourceOption = {
  value: string;
  label: string;
  description: string;
  kind: "build" | "quote";
  manageable?: boolean;
};

export function isManageableBuildSource(source: BuildSource): boolean {
  return source === "custom" || source === "user";
}

function compareOrderedBuilds(session: DesignSession): DesignBuild[] {
  const suggested =
    session.builds.find((build) => build.source === "ai_suggested") ??
    [...session.builds].sort((a, b) => b.fit_score - a.fit_score)[0];
  const customBuilds = session.builds.filter((build) => build.source === "custom");
  const userBuilds = session.builds.filter((build) => build.source === "user");

  return [suggested, ...customBuilds, ...userBuilds].filter(
    (build, index, builds): build is DesignBuild =>
      build !== undefined && builds.indexOf(build) === index,
  );
}

export function diagramSourceOptions(
  session: DesignSession | null,
  quoteResults: QuoteAuditResponse[],
): DiagramSourceOption[] {
  if (!session) {
    return [];
  }

  const options: DiagramSourceOption[] = compareOrderedBuilds(session).map(
    (build) => ({
      value: build.id,
      label: build.label,
      description:
        build.source === "user"
          ? build.system_kwp > 0
            ? `${build.system_kwp.toFixed(1)} kWp · Your build`
            : "Empty · Add components"
          : `${build.system_kwp.toFixed(1)} kWp · Solver build`,
      kind: "build",
      manageable: isManageableBuildSource(build.source),
    }),
  );

  quoteResults.forEach((quoteResult, index) => {
    if (quoteResult.diagram_components.length === 0) {
      return;
    }
    options.push({
      value: quoteAuditId(quoteResult, index),
      label: quoteAuditLabel(quoteResult, index),
      description: "From uploaded quote",
      kind: "quote",
    });
  });

  return options;
}

export type DesignSummaryTile = {
  label: string;
  value: string;
};

export function summaryTiles(build: DesignBuild | null): DesignSummaryTile[] {
  if (!build) {
    return [];
  }

  return [
    {
      label: SLOT_LABELS.panel,
      value: `${build.panel_count} panels`,
    },
    {
      label: SLOT_LABELS.inverter,
      value: `${build.inverter_kw} kW inverter`,
    },
    {
      label: SLOT_LABELS.battery,
      value: build.battery_kwh ? `${build.battery_kwh} kWh battery` : "None",
    },
  ];
}

export function canvasSlots(build: DesignBuild | null): DesignComponent[] {
  return canvasSlotsFromComponents(build?.components ?? []);
}

export function canvasSlotsFromComponents(
  components: DesignComponent[],
): DesignComponent[] {
  const placeholder = (slot: ComponentSlot): DesignComponent => ({
    slot,
    catalog_id: null,
    brand: "—",
    model: slot === "battery" ? "Not included" : "Pending",
    summary: SLOT_LABELS[slot],
    qty: 0,
    unit: "—",
    unit_price_php: 0,
    price_as_of: null,
    line_total_php: 0,
    warranty_note: "",
    badges: [],
    specs: {},
  });

  const bosItems = components.filter((component) => BOS_SLOTS.includes(component.slot));
  const bosSlot = aggregateBosComponents(bosItems);

  const bySlot = new Map<ComponentSlot, DesignComponent>();
  for (const component of components) {
    if (BOS_SLOTS.includes(component.slot)) {
      continue;
    }
    bySlot.set(component.slot, component);
  }
  if (bosSlot) {
    bySlot.set("protection", bosSlot);
  }

  return SLOT_ORDER.map((slot) => bySlot.get(slot) ?? placeholder(slot));
}

export function canvasBomGroups(build: DesignBuild | null): CanvasBomGroup[] {
  return canvasBomGroupsFromComponents(build?.components ?? []);
}

export function canvasBomGroupsFromComponents(
  components: DesignComponent[],
): CanvasBomGroup[] {
  const groups = new Map<ComponentSlot, DesignComponent[]>();
  for (const component of components) {
    if (
      component.slot === "panel" ||
      component.slot === "inverter" ||
      component.slot === "battery"
    ) {
      continue;
    }
    const existing = groups.get(component.slot) ?? [];
    existing.push(component);
    groups.set(component.slot, existing);
  }

  return FULL_VIEW_GROUP_ORDER.filter((slot) => groups.has(slot)).map((slot) => ({
    slot,
    label: CANVAS_SLOT_HEADERS[slot],
    components: groups.get(slot) ?? [],
  }));
}

export function canvasSlotHeader(slot: ComponentSlot): string {
  return CANVAS_SLOT_HEADERS[slot] ?? slot;
}

export function canvasSlotHeaderForComponent(component: DesignComponent): string {
  if (isAggregatedBosComponent(component)) {
    return "Balance of system";
  }
  return canvasSlotHeader(component.slot);
}

export function rejectionsForCombo(
  session: DesignSession | null,
  comboId: string | null,
): RejectionReason[] {
  if (!session?.last_solve || !comboId) {
    return [];
  }
  return session.last_solve.rejections.filter((row) =>
    row.combo_key.includes(comboId.split(":")[0] ?? comboId),
  );
}

export function formatBuildInvestment(build: DesignBuild): string {
  return pesoRange(build.total_investment_low_php, build.total_investment_high_php);
}

export const GOAL_LABELS: Record<SolverGoal, string> = {
  budget: "Maximise for my budget",
  backup: "Ensure backup for blackouts",
  independence: "Full energy independence",
  auto: "AI auto-optimise",
};

export const ASK_AI_CHIPS = [
  "Why was this inverter chosen?",
  "Add backup for blackouts under my budget",
  "What got rejected in the last solve?",
] as const;
