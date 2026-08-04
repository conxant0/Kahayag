import { useState } from "react";

import type { DesignComponent } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";
import { CanvasSlotIcon, SLOT_ACCENT } from "./canvasSlotIcons";
import { canvasSlotHeader } from "./designViewModel";
import { ComponentProductImage } from "./ComponentProductImage";

function formatStatLabel(key: string): string {
  return key.replace(/_/g, " ").toUpperCase();
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
    const ratedKw =
      typeof component.specs.rated_ac_kw === "number"
        ? component.specs.rated_ac_kw
        : typeof component.specs.rated_ac_output_w === "number"
          ? component.specs.rated_ac_output_w / 1000
          : null;
    return [
      {
        label: "Capacity",
        value: ratedKw ? `${ratedKw} kW` : `${component.qty || 1} unit`,
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
  if (component.slot === "panel" || component.slot === "inverter") {
    return `${count} ${count === 1 ? "unit" : "units"}`;
  }
  return `${count} ${component.unit}`;
}

function EmptyBatteryCard({ onAdd }: { onAdd?: () => void }) {
  const accent = SLOT_ACCENT.battery;
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-[15.5rem] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#cfc9bb] bg-white/70 px-4 py-8 text-center shadow-[0_2px_8px_rgba(26,23,18,0.03)] transition-colors hover:border-cobalt/40 hover:bg-white"
    >
      <div className={cn("flex size-10 items-center justify-center rounded-[10px]", accent.bg)}>
        <CanvasSlotIcon slot="battery" size={20} />
      </div>
      <p className="mt-2 font-sans text-sm font-semibold text-secondary">— Not included</p>
      <p className="font-sans text-[10px] font-semibold tracking-[0.8px] text-tertiary uppercase">
        Energy store
      </p>
    </button>
  );
}

export function CanvasComponentCard({
  component,
  highlighted = false,
  onSwap,
  className,
  showProductImage = false,
}: {
  component: DesignComponent;
  highlighted?: boolean;
  onSwap?: () => void;
  className?: string;
  showProductImage?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const stats = statEntries(component);
  const isEmptyBattery = component.qty === 0 && component.slot === "battery";
  const autoSuggested = component.badges.some((badge) =>
    badge.toLowerCase().includes("auto"),
  );
  const showHighlight = highlighted || (autoSuggested && component.slot === "inverter");
  const accent = SLOT_ACCENT[component.slot];
  const swappable =
    onSwap &&
    (component.slot === "panel" ||
      component.slot === "inverter" ||
      component.slot === "battery");

  if (isEmptyBattery) {
    return <EmptyBatteryCard onAdd={onSwap} />;
  }

  return (
    <article
      className={cn(
        "group relative flex w-[15.5rem] flex-col overflow-hidden rounded-[14px] border bg-white shadow-[0_4px_14px_rgba(26,23,18,0.05)]",
        showHighlight ? "border-sun border-[2px]" : autoSuggested ? "border-sun" : "border-hairline",
        className,
      )}
    >
      {autoSuggested ? (
        <div className="bg-[#fff4cc] px-2.5 py-1 text-center font-sans text-[8px] font-bold tracking-[1px] text-[#7a5c00] uppercase">
          Auto-suggested
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className={cn("flex size-7 items-center justify-center rounded-[8px]", accent.bg)}>
              <CanvasSlotIcon slot={component.slot} size={16} />
            </div>
            <p className="font-sans text-[9px] font-semibold tracking-[0.8px] text-tertiary uppercase">
              {canvasSlotHeader(component.slot)}
            </p>
          </div>
          <p className="font-sans text-[9px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            {quantityLabel(component)}
          </p>
        </div>

        <div>
          <p className="font-sans text-[12px] font-semibold text-cobalt">{component.brand}</p>
          <p className="font-sans text-[14px] leading-tight font-bold text-ink">{component.model}</p>
        </div>

        {showProductImage ? (
          <ComponentProductImage component={component} size="lg" />
        ) : null}

        {stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[8px] border border-hairline bg-[#fcfaf5] px-2 py-1.5"
              >
                <p className="font-sans text-[8px] font-semibold tracking-[0.6px] text-tertiary uppercase">
                  {stat.label}
                </p>
                <p className="font-sans text-[11px] font-semibold text-ink">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {component.slot === "inverter" && autoSuggested ? (
          <p className="rounded-pill bg-[#fff4cc] px-2 py-1 text-center font-sans text-[10px] font-medium text-[#7a5c00]">
            Built-in AI arc protection
          </p>
        ) : null}

        {component.slot === "protection" ? (
          <div className="flex flex-wrap gap-1">
            <span className="rounded-pill bg-[#f2eee4] px-2 py-0.5 font-sans text-[9px] font-semibold text-secondary">
              PEC 2024
            </span>
            <span className="rounded-pill bg-[#fff4cc] px-2 py-0.5 font-sans text-[9px] font-semibold text-[#7a5c00]">
              Lifetime support
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-1 font-sans text-[12px] font-semibold text-cobalt hover:underline"
            onClick={() => setShowDetails((open) => !open)}
            aria-expanded={showDetails}
          >
            {showDetails ? "Hide details" : "View details"}
            <span aria-hidden="true">ⓘ</span>
          </button>
          {swappable ? (
            <button
              type="button"
              onClick={onSwap}
              className="rounded-pill border border-hairline px-2 py-0.5 font-sans text-[10px] font-semibold text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:border-cobalt/30 hover:text-ink"
            >
              Swap
            </button>
          ) : null}
        </div>

        {showDetails ? (
          <dl className="grid gap-0.5 border-t border-hairline pt-2 font-sans text-[11px]">
            {Object.entries(component.specs).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
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

export function AddComponentCard({ onAdd }: { onAdd?: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex h-[6.5rem] w-[15.5rem] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#cfc9bb] bg-white/50 transition-colors hover:border-cobalt/40 hover:bg-white"
    >
      <div className="flex size-8 items-center justify-center rounded-pill bg-[#f2eee4] font-sans text-lg text-secondary">
        +
      </div>
      <p className="mt-1.5 font-sans text-[12px] font-semibold text-secondary">Add component</p>
    </button>
  );
}
