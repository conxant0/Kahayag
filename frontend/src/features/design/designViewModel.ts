// Maps design session state into canvas and summary view models.
import type {
  ComponentSlot,
  DesignBuild,
  DesignComponent,
  DesignSession,
  RejectionReason,
  SolverGoal,
} from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";

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

export function summaryTiles(build: DesignBuild | null) {
  if (!build) {
    return [];
  }
  const panel = build.components.find((c) => c.slot === "panel");
  const inverter = build.components.find((c) => c.slot === "inverter");
  const battery = build.components.find((c) => c.slot === "battery");
  return [
    {
      label: SLOT_LABELS.panel,
      value: panel
        ? `${build.panel_count} × ${panel.brand} ${panel.model}`
        : `${build.panel_count} panels`,
      detail: `${build.system_kwp.toFixed(2)} kWp`,
    },
    {
      label: SLOT_LABELS.inverter,
      value: inverter
        ? `${inverter.brand} ${inverter.model}`
        : `${build.inverter_kw} kW inverter`,
      detail: `${build.inverter_utilisation_pct.toFixed(0)}% utilisation`,
    },
    {
      label: SLOT_LABELS.battery,
      value: battery
        ? `${battery.brand} ${battery.model}`
        : build.battery_kwh
          ? `${build.battery_kwh} kWh`
          : "None (grid-tie)",
      detail: build.battery_kwh ? `${build.battery_kwh} kWh usable` : "Optional",
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
  return peso(build.total_investment_php);
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
