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
    "flex w-[15.5rem] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#d9d3c6] bg-white/60 text-center",
    compact ? "px-2 py-4" : "px-4 py-7",
    onAdd
      ? "transition-colors duration-150 ease-brand hover:border-cobalt/40 hover:bg-white"
      : "",
    className,
  );

  const body = (
    <>
      <div
        className={cn(
          "flex items-center justify-center rounded-[10px]",
          compact ? "size-7" : "size-9",
          accent.bg,
        )}
      >
        <CanvasSlotIcon slot={slot} size={compact ? 16 : 18} />
      </div>
      <p
        className={cn(
          "mt-2.5 font-sans font-semibold text-ink",
          compact ? "text-[10px]" : "text-[13px]",
        )}
      >
        {emptyLabel}
      </p>
      <p
        className={cn(
          "mt-0.5 font-sans font-semibold tracking-[0.8px] text-tertiary-ink uppercase",
          compact ? "text-[8px]" : "text-[10px]",
        )}
      >
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

  const bosCard =
    component.slot === "protection" || isAggregatedBosComponent(component);

  return (
    <article
      className={cn(
        "relative flex w-[15.5rem] flex-col rounded-[16px] border bg-white shadow-[0_1px_2px_rgba(26,23,18,0.04),0_8px_24px_rgba(26,23,18,0.05)]",
        showHighlight ? "border-[1.5px] border-sun" : "border-hairline",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          {/* The product image below already carries the slot icon. */}
          {showProductImage ? null : (
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-[7px]",
                accent.bg,
              )}
            >
              <CanvasSlotIcon slot={component.slot} size={14} />
            </div>
          )}
          <p className="truncate font-sans text-[10px] font-semibold tracking-[0.9px] text-tertiary-ink uppercase">
            {canvasSlotHeaderForComponent(component)}
          </p>
        </div>
        {autoSuggested ? (
          <span className="shrink-0 rounded-pill bg-[#fff4cc] px-2 py-0.5 font-sans text-[10px] font-semibold text-[#7a5c00]">
            Auto-suggested
          </span>
        ) : (
          <p className="shrink-0 font-sans text-[10px] font-semibold tracking-[0.9px] text-tertiary-ink uppercase">
            {quantityLabel(component)}
          </p>
        )}
      </header>

      <div className="flex gap-3 px-4 pt-3">
        {showProductImage ? (
          <ComponentProductImage component={component} size="thumb" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[12px] font-semibold text-cobalt">
            {component.brand}
          </p>
          <p className="line-clamp-2 font-sans text-[15px] leading-snug font-semibold text-ink">
            {displayModel(component)}
          </p>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 px-4 pt-2.5">
        {price ? (
          <p className="font-sans text-[17px] font-bold text-ink tabular-nums">
            {price.total}
          </p>
        ) : (
          <span />
        )}
        <p className="font-sans text-[12px] text-tertiary-ink tabular-nums">
          {price?.detail ?? (autoSuggested ? quantityLabel(component) : null)}
        </p>
      </div>

      {stats.length > 0 && !bosCard ? (
        <dl className="mx-4 mt-3 grid grid-cols-2 border-t border-hairline pt-2.5">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn("min-w-0", index > 0 && "border-l border-hairline pl-3")}
            >
              <dt className="truncate font-sans text-[10px] font-semibold tracking-[0.6px] text-tertiary-ink uppercase">
                {stat.label}
              </dt>
              <dd className="truncate font-sans text-[13px] font-semibold text-ink">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline px-4 py-2.5">
        <button
          type="button"
          className="font-sans text-[12px] font-semibold text-cobalt hover:underline"
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
        >
          {showDetails ? "Hide details" : "View details"}
        </button>
        {swappable ? (
          <button
            type="button"
            onClick={onSwap}
            className="rounded-pill border border-hairline px-3 py-1 font-sans text-[12px] font-semibold text-secondary transition-colors duration-150 ease-brand hover:border-tertiary hover:text-ink"
          >
            Swap
          </button>
        ) : null}
      </div>

      {showDetails ? (
        <dl className="grid gap-1 border-t border-hairline px-4 py-3 font-sans text-[12px]">
          {Object.entries(component.specs).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3">
              <dt className="text-tertiary-ink">{formatStatLabel(key)}</dt>
              <dd className="text-right text-ink">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

export function AddComponentCard({ onAdd }: { onAdd?: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex h-[6.5rem] w-[15.5rem] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#d9d3c6] bg-white/40 transition-colors duration-150 ease-brand hover:border-cobalt/40 hover:bg-white"
    >
      <div className="flex size-8 items-center justify-center rounded-pill bg-[#f2eee4] font-sans text-lg text-secondary">
        +
      </div>
      <p className="mt-2 font-sans text-[13px] font-semibold text-ink">
        Add component
      </p>
    </button>
  );
}
