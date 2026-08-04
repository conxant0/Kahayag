import { useState } from "react";

import type { DesignComponent } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";
import { canvasSlotHeader } from "./designViewModel";

function formatStatLabel(key: string): string {
  return key.replace(/_/g, " ");
}

/**
 * Stat pairs come from the component's own catalog data — a missing warranty
 * renders no warranty stat rather than an invented figure. The domain
 * supplies the facts; this card only formats them.
 */
function statEntries(component: DesignComponent): Array<{ label: string; value: string }> {
  const entries = Object.entries(component.specs).slice(0, 2).map(([key, value]) => ({
    label: formatStatLabel(key),
    value: String(value),
  }));

  if (entries.length >= 2) {
    return entries;
  }

  if (component.slot === "panel" && component.qty > 0) {
    return [
      {
        label: "Capacity",
        value:
          typeof component.specs.wattage_w === "number"
            ? `${component.specs.wattage_w} Wp`
            : `${component.qty} pcs`,
      },
      { label: "Warranty", value: component.warranty_note },
    ].filter((entry) => entry.value);
  }

  if (component.slot === "inverter") {
    return [
      {
        label: "Efficiency",
        value:
          typeof component.specs.efficiency_pct === "number"
            ? `${component.specs.efficiency_pct}%`
            : `${component.qty || 1} unit`,
      },
      { label: "Warranty", value: component.warranty_note },
    ].filter((entry) => entry.value);
  }

  if (component.slot === "battery" && component.qty > 0) {
    const kwh =
      typeof component.specs.usable_kwh === "number"
        ? component.specs.usable_kwh
        : typeof component.specs.capacity_kwh === "number"
          ? component.specs.capacity_kwh
          : null;
    return [
      { label: "Capacity", value: kwh ? `${kwh} kWh` : "—" },
      { label: "Warranty", value: component.warranty_note },
    ].filter((entry) => entry.value);
  }

  return entries;
}

function quantityLabel(component: DesignComponent): string {
  if (component.slot === "protection") {
    return "Included";
  }
  if (component.slot === "battery" && component.qty === 0) {
    return "Optional";
  }
  if (component.qty <= 0) {
    return "Pending";
  }
  const count = Math.round(component.qty);
  const unitLabel =
    component.unit === "pcs"
      ? count === 1
        ? "unit"
        : "units"
      : component.unit;
  return `${count} ${unitLabel}`;
}

export function CanvasComponentCard({
  component,
  highlighted = false,
  className,
}: {
  component: DesignComponent;
  highlighted?: boolean;
  className?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const stats = statEntries(component);
  const isEmpty = component.qty === 0 && component.slot === "battery";
  const autoSuggested = component.badges.some((badge) =>
    badge.toLowerCase().includes("auto"),
  );

  return (
    <article
      className={cn(
        "relative flex w-full max-w-[18rem] flex-col overflow-hidden rounded-[16px] border bg-white shadow-[0_3px_10px_rgba(26,23,18,0.04)]",
        highlighted || autoSuggested ? "border-sun border-[1.6px]" : "border-hairline",
        isEmpty && "opacity-80",
        className,
      )}
    >
      {autoSuggested ? (
        <div className="bg-[#fff4cc] px-3 py-1.5 text-center font-sans text-[9px] font-semibold tracking-[1px] text-[#7a5c00] uppercase">
          Auto-suggested
        </div>
      ) : null}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
            {canvasSlotHeader(component.slot)}
          </p>
          <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
            {quantityLabel(component)}
          </p>
        </div>

        <div>
          <p className="font-sans text-sm font-semibold text-ink">
            {component.brand} {component.model}
          </p>
          <p className="mt-0.5 font-sans text-[12px] text-secondary">
            {component.summary}
          </p>
        </div>

        {stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[10px] border border-hairline bg-[#fcfaf5] px-2.5 py-2"
              >
                <p className="font-sans text-[9px] font-semibold tracking-[0.8px] text-tertiary uppercase">
                  {stat.label}
                </p>
                <p className="mt-0.5 font-sans text-[12px] font-semibold text-ink">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="flex items-center gap-1 self-start font-sans text-[12px] font-semibold text-cobalt hover:underline"
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
        >
          {showDetails ? "Hide details" : "View details"}
          <span aria-hidden="true">ⓘ</span>
        </button>

        {showDetails ? (
          <dl className="grid gap-1 border-t border-hairline pt-2 font-sans text-[12px]">
            {Object.entries(component.specs).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-secondary">{formatStatLabel(key)}</dt>
                <dd className="text-ink">{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </article>
  );
}

export function AddComponentCard() {
  return (
    <div className="flex h-[8.5rem] w-full max-w-[18rem] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#d8d2c4] bg-[#fcfaf5]/80">
      <div className="flex size-10 items-center justify-center rounded-pill bg-[#f2eee4] text-secondary">
        +
      </div>
      <p className="mt-2 font-sans text-sm font-semibold text-secondary">Add component</p>
    </div>
  );
}
