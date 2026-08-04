// Maps design session state into canvas and summary view models.
import type {
  ComponentSlot,
  DesignBuild,
  DesignComponent,
  DesignSession,
  RejectionReason,
  SolverGoal,
} from "../../shared/api/types";
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
  "battery",
];

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
  if (!build) {
    return [];
  }
  const bySlot = new Map(build.components.map((c) => [c.slot, c]));
  return SLOT_ORDER.map(
    (slot) =>
      bySlot.get(slot) ?? {
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
      },
  );
}

export function canvasSlotHeader(slot: ComponentSlot): string {
  return CANVAS_SLOT_HEADERS[slot] ?? slot;
}

export function canvasBomGroups(build: DesignBuild | null): CanvasBomGroup[] {
  if (!build) {
    return [];
  }

  const groups = new Map<ComponentSlot, DesignComponent[]>();
  for (const component of build.components) {
    if (component.slot === "panel" || component.slot === "inverter") {
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
  "Why this inverter?",
  "What was rejected?",
  "How is payback calculated?",
] as const;
