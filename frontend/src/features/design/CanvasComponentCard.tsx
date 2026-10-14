import { useState } from "react";

import type { DesignComponent } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";
import { peso } from "../../shared/lib/currency";
import { CanvasSlotIcon, SLOT_ACCENT } from "./canvasSlotIcons";
import { canvasSlotHeader, canvasSlotHeaderForComponent, isAggregatedBosComponent } from "./designViewModel";
import { ComponentProductImage } from "./ComponentProductImage";

function isFromQuote(component: DesignComponent): boolean {
  return component.badges.some((badge) => badge.toUpperCase().includes("QUOTE"));
}

function displayModel(component: DesignComponent): string {
  const model = component.model.trim();
  if (model && model !== "—") {
    return model;
  }
  const summary = component.summary.trim();
  return summary || model || "—";
}

function priceLabel(component: DesignComponent): { total: string; detail: string | null } | null {
  if (component.line_total_php <= 0) {
    return null;
  }
  const roundedQty = Math.round(component.qty);
  const computedTotal = component.unit_price_php * component.qty;
  const showBreakdown =
    component.qty > 1 &&
    component.unit_price_php > 0 &&
    Math.abs(computedTotal - component.line_total_php) < 1;

  return {
    total: peso(component.line_total_php),
    detail: showBreakdown ? `${peso(component.unit_price_php)} × ${roundedQty}` : null,
  };
}

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
  if (component.slot === "protection" || isAggregatedBosComponent(component)) {
    if (isAggregatedBosComponent(component)) {
      return component.model;
    }
    if (isFromQuote(component) && component.qty > 0) {
      const count =
        component.qty % 1 === 0
          ? String(Math.round(component.qty))
          : component.qty.toFixed(2);
      return `${count} ${component.unit}`;
    }
    return "Included";
  }
  if (component.slot === "battery" && component.qty === 0) {
    return "Optional";
  }
  if (component.qty <= 0) {
    return "Pending";
  }
  const count = Math.round(component.qty);
  if (component.slot === "inverter" && count > 1) {
    const ratedKw =
      typeof component.specs.rated_ac_kw === "number"
        ? component.specs.rated_ac_kw
        : typeof component.specs.rated_ac_output_w === "number"
          ? component.specs.rated_ac_output_w / 1000
          : null;
    if (ratedKw !== null && ratedKw < 1) {
      return `${count} microinverters`;
    }
  }
  if (component.slot === "panel" || component.slot === "inverter") {
    return `${count} ${count === 1 ? "unit" : "units"}`;
  }
  return `${count} ${component.unit}`;
}

function EmptySlotCard({
  slot,
  onAdd,
  className,
  compact = false,
}: {
  slot: DesignComponent["slot"];
  onAdd?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const accent = SLOT_ACCENT[slot];
  const emptyLabel =
    slot === "panel"
      ? "Add panels"
      : slot === "inverter"
        ? "Add inverter"
        : "— Not included";
  const sharedClassName = cn(
    "flex w-[15.5rem] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#cfc9bb] bg-white/70 text-center shadow-[0_2px_8px_rgba(26,23,18,0.03)]",
    compact ? "px-2 py-4" : "px-4 py-8",
    onAdd ? "transition-colors hover:border-cobalt/40 hover:bg-white" : "",
    className,
  );

  const body = (
    <>
      <div
        className={cn(
          "flex items-center justify-center rounded-[10px]",
          compact ? "size-7" : "size-10",
          accent.bg,
        )}
      >
        <CanvasSlotIcon slot={slot} size={compact ? 16 : 20} />
      </div>
      <p
        className={cn(
          "mt-2 font-sans font-semibold text-secondary",
          compact ? "text-[10px]" : "text-sm",
        )}
      >
        {emptyLabel}
      </p>
      <p className="font-sans text-[8px] font-semibold tracking-[0.6px] text-tertiary uppercase">
        {canvasSlotHeader(slot)}
      </p>
    </>
  );

  if (!onAdd) {
    return <div className={sharedClassName}>{body}</div>;
  }

  return (
    <button type="button" onClick={onAdd} className={sharedClassName}>
      {body}
    </button>
  );
}

export function CanvasComponentCard({
  component,
  highlighted = false,
  onSwap,
  className,
  showProductImage = false,
  compact = false,
}: {
  component: DesignComponent;
  highlighted?: boolean;
  onSwap?: () => void;
  className?: string;
  showProductImage?: boolean;
  compact?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const stats = statEntries(component);
  const price = priceLabel(component);
  const isEmptySlot =
    component.qty <= 0 &&
    (component.slot === "panel" ||
      component.slot === "inverter" ||
      component.slot === "battery");
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

  if (isEmptySlot) {
    return (
      <EmptySlotCard
        slot={component.slot}
        onAdd={onSwap}
        className={className}
        compact={compact}
      />
    );
  }

  if (compact) {
    return (
      <article
        className={cn(
          "flex w-[7.25rem] min-w-0 flex-col overflow-hidden rounded-[12px] border bg-white shadow-[0_2px_8px_rgba(26,23,18,0.04)]",
          showHighlight ? "border-sun border-[1.5px]" : "border-hairline",
          className,
        )}
      >
        <div className="flex flex-col gap-1.5 p-2">
          <div className="flex items-center gap-1">
            <div className={cn("flex size-5 shrink-0 items-center justify-center rounded-[6px]", accent.bg)}>
              <CanvasSlotIcon slot={component.slot} size={12} />
            </div>
            <p className="min-w-0 truncate font-sans text-[7px] font-semibold tracking-[0.4px] text-tertiary uppercase">
              {canvasSlotHeaderForComponent(component)}
            </p>
          </div>
          <p className="font-sans text-[7px] font-semibold tracking-[0.4px] text-tertiary uppercase">
            {quantityLabel(component)}
          </p>
          <div className="min-w-0">
            <p className="truncate font-sans text-[10px] font-semibold text-cobalt">{component.brand}</p>
            <p className="line-clamp-2 font-sans text-[11px] leading-tight font-bold text-ink">
              {displayModel(component)}
            </p>
          </div>
        </div>
      </article>
    );
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
              {canvasSlotHeaderForComponent(component)}
            </p>
          </div>
          <p className="font-sans text-[9px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            {quantityLabel(component)}
          </p>
        </div>

        <div className={cn("flex gap-2.5", showProductImage ? "items-start" : "")}>
          {showProductImage ? (
            <ComponentProductImage component={component} size="thumb" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-sans text-[12px] font-semibold text-cobalt">{component.brand}</p>
            <p className="font-sans text-[14px] leading-tight font-bold text-ink">
              {displayModel(component)}
            </p>
            {price ? (
              <div className="mt-1.5">
                <p className="font-sans text-[15px] font-bold text-ink">{price.total}</p>
                {price.detail ? (
                  <p className="font-sans text-[10px] text-secondary">{price.detail}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

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

        {component.slot === "protection" || isAggregatedBosComponent(component) ? (
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
