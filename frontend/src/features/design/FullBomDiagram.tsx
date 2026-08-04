// Defines the full BOM wiring diagram with product photos and flow labels.
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import type { CatalogPickerSlot, DesignComponent } from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";
import { cn } from "../../shared/lib/cn";
import { AddComponentCard, CanvasComponentCard } from "./CanvasComponentCard";
import { ComponentProductImage } from "./ComponentProductImage";
import { CanvasSlotIcon } from "./canvasSlotIcons";
import type { CanvasBomGroup } from "./designViewModel";
import { canvasSlotHeader } from "./designViewModel";

const WIRE_COLOR = "#4a9b7f";

function formatBomQty(component: DesignComponent): string {
  if (component.qty <= 0) {
    return "—";
  }
  const count =
    component.qty % 1 === 0
      ? String(Math.round(component.qty))
      : component.qty.toFixed(2);
  return `${count} ${component.unit}`;
}

function FlowConnector({ label }: { label?: string }) {
  return (
    <div
      className="relative flex w-12 shrink-0 items-center self-center lg:w-14"
      aria-hidden="true"
    >
      {label ? (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-pill border border-[#cfe8dc] bg-white px-2 py-0.5 font-sans text-[8px] font-bold tracking-[0.8px] text-[#2f6f58] uppercase shadow-sm">
          {label}
        </span>
      ) : null}
      <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: WIRE_COLOR }} />
      <div className="h-0.5 flex-1" style={{ backgroundColor: WIRE_COLOR }} />
      <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: WIRE_COLOR }} />
    </div>
  );
}

function WireLabel({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x - 14}
        y={y - 9}
        width={28}
        height={16}
        rx={8}
        fill="white"
        stroke="#cfe8dc"
      />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        className="fill-[#2f6f58] font-sans text-[8px] font-bold uppercase"
        style={{ fontSize: 8, letterSpacing: "0.8px" }}
      >
        {label}
      </text>
    </g>
  );
}

function DiagramBomMiniCard({ component }: { component: DesignComponent }) {
  return (
    <article className="flex items-center gap-2.5 rounded-[12px] border border-hairline bg-white p-2 shadow-[0_2px_8px_rgba(26,23,18,0.04)]">
      <ComponentProductImage component={component} size="sm" className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[10px] font-semibold text-ink">
          {component.brand} {component.model}
        </p>
        <p className="truncate font-sans text-[9px] text-secondary">{component.summary}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-sans text-[9px] text-secondary">{formatBomQty(component)}</p>
        <p className="font-sans text-[10px] font-semibold text-ink">
          {peso(component.line_total_php)}
        </p>
      </div>
    </article>
  );
}

function DiagramBomGroupSection({ group }: { group: CanvasBomGroup }) {
  const groupTotal = group.components.reduce(
    (sum, component) => sum + component.line_total_php,
    0,
  );

  return (
    <section aria-label={group.label} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <CanvasSlotIcon slot={group.slot} size={14} />
          <p className="font-sans text-[9px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            {group.label}
          </p>
        </div>
        <p className="font-sans text-[10px] font-semibold text-secondary">
          {peso(groupTotal)}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {group.components.map((component) => (
          <DiagramBomMiniCard
            key={`${component.catalog_id ?? component.model}:${component.slot}`}
            component={component}
          />
        ))}
      </div>
    </section>
  );
}

function DestinationCard({
  label,
  detail,
  icon,
  cardRef,
}: {
  label: string;
  detail: string;
  icon: "grid" | "home";
  cardRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={cardRef}
      className="flex w-[9.5rem] items-center gap-2.5 rounded-[14px] border border-hairline bg-white px-3 py-3 shadow-[0_2px_8px_rgba(26,23,18,0.04)]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#edf3ff] text-cobalt">
        {icon === "grid" ? (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3 5 7v5c0 4.5 3 7.5 7 8 4-.5 7-3.5 7-8V7l-7-4Z" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-sans text-[11px] font-bold text-ink">{label}</p>
        <p className="font-sans text-[9px] leading-snug text-secondary">{detail}</p>
      </div>
    </div>
  );
}

function FullBomWiringOverlay({
  containerRef,
  panelRef,
  inverterRef,
  bosRef,
  batteryRef,
  gridRef,
  homeRef,
  layoutKey,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  inverterRef: RefObject<HTMLDivElement | null>;
  bosRef: RefObject<HTMLDivElement | null>;
  batteryRef: RefObject<HTMLDivElement | null>;
  gridRef: RefObject<HTMLDivElement | null>;
  homeRef: RefObject<HTMLDivElement | null>;
  layoutKey: string;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [dots, setDots] = useState<Array<{ x: number; y: number }>>([]);
  const [labels, setLabels] = useState<Array<{ x: number; y: number; text: string }>>(
    [],
  );
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const panel = panelRef.current;
      const inverter = inverterRef.current;
      const bos = bosRef.current;
      const battery = batteryRef.current;
      const grid = gridRef.current;
      const home = homeRef.current;
      if (!container || !panel || !inverter || !bos || !battery || !grid || !home) {
        return;
      }

      const box = container.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) {
        return;
      }

      const center = (rect: DOMRect) => ({
        x: rect.left + rect.width / 2 - box.left,
        y: rect.top + rect.height / 2 - box.top,
      });
      const edgeRight = (rect: DOMRect) => ({
        x: rect.right - box.left,
        y: rect.top + rect.height / 2 - box.top,
      });
      const edgeLeft = (rect: DOMRect) => ({
        x: rect.left - box.left,
        y: rect.top + rect.height / 2 - box.top,
      });

      const panelPoint = edgeRight(panel.getBoundingClientRect());
      const inverterRect = inverter.getBoundingClientRect();
      const inverterPoint = {
        left: edgeLeft(inverterRect),
        right: edgeRight(inverterRect),
        y: center(inverterRect).y,
      };
      const bosRect = bos.getBoundingClientRect();
      const batteryRect = battery.getBoundingClientRect();
      const bosPoint = {
        left: edgeLeft(bosRect),
        right: edgeRight(bosRect),
        y: center(bosRect).y,
      };
      const batteryPoint = {
        left: edgeLeft(batteryRect),
        y: center(batteryRect).y,
      };
      const gridPoint = edgeLeft(grid.getBoundingClientRect());
      const homePoint = edgeLeft(home.getBoundingClientRect());
      const outputJunctionX =
        bosPoint.right.x + (gridPoint.x - bosPoint.right.x) * 0.42;
      const branchHubX =
        inverterPoint.right.x +
        (bosPoint.left.x - inverterPoint.right.x) * 0.38;

      const nextPaths = [
        `M ${panelPoint.x} ${panelPoint.y} H ${inverterPoint.left.x}`,
        `M ${inverterPoint.right.x} ${inverterPoint.y} H ${branchHubX}`,
        `M ${branchHubX} ${inverterPoint.y} V ${bosPoint.y} H ${bosPoint.left.x}`,
        `M ${branchHubX} ${inverterPoint.y} V ${batteryPoint.y} H ${batteryPoint.left.x}`,
        `M ${bosPoint.right.x} ${bosPoint.y} H ${outputJunctionX}`,
        `M ${outputJunctionX} ${bosPoint.y} V ${gridPoint.y}`,
        `M ${outputJunctionX} ${gridPoint.y} H ${gridPoint.x}`,
        `M ${outputJunctionX} ${gridPoint.y} V ${homePoint.y}`,
        `M ${outputJunctionX} ${homePoint.y} H ${homePoint.x}`,
      ];

      const nextDots = [
        panelPoint,
        { x: inverterPoint.left.x, y: inverterPoint.y },
        { x: inverterPoint.right.x, y: inverterPoint.y },
        { x: branchHubX, y: inverterPoint.y },
        { x: bosPoint.left.x, y: bosPoint.y },
        { x: bosPoint.right.x, y: bosPoint.y },
        { x: batteryPoint.left.x, y: batteryPoint.y },
        { x: outputJunctionX, y: gridPoint.y },
        { x: outputJunctionX, y: homePoint.y },
        gridPoint,
        homePoint,
      ];

      const nextLabels = [
        {
          x: (panelPoint.x + inverterPoint.left.x) / 2,
          y: panelPoint.y - 12,
          text: "DC",
        },
        {
          x: (branchHubX + bosPoint.left.x) / 2,
          y: bosPoint.y - 12,
          text: "AC",
        },
      ];

      setSize({ width: box.width, height: box.height });
      setPaths(nextPaths);
      setDots(nextDots);
      setLabels(nextLabels);
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const container = containerRef.current;
    const observer =
      typeof ResizeObserver !== "undefined" && container
        ? new ResizeObserver(measure)
        : null;
    if (container && observer) {
      observer.observe(container);
    }
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [
    batteryRef,
    bosRef,
    containerRef,
    gridRef,
    homeRef,
    inverterRef,
    layoutKey,
    panelRef,
  ]);

  if (size.width <= 0 || size.height <= 0) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-hidden="true"
    >
      {paths.map((path) => (
        <path
          key={path}
          d={path}
          stroke={WIRE_COLOR}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {dots.map((dot, index) => (
        <circle
          key={`${dot.x}:${dot.y}:${index}`}
          cx={dot.x}
          cy={dot.y}
          r="4"
          fill="white"
          stroke={WIRE_COLOR}
          strokeWidth="2"
        />
      ))}
      {labels.map((label) => (
        <WireLabel key={label.text} x={label.x} y={label.y} label={label.text} />
      ))}
    </svg>
  );
}

export function FullBomDiagram({
  panel,
  inverter,
  battery,
  bomGroups,
  layoutKey,
  onOpenPicker,
  readOnly = false,
}: {
  panel: DesignComponent;
  inverter: DesignComponent;
  battery: DesignComponent;
  bomGroups: CanvasBomGroup[];
  layoutKey: string;
  onOpenPicker?: (slot: CatalogPickerSlot, mode: "swap" | "add") => void;
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inverterRef = useRef<HTMLDivElement>(null);
  const bosRef = useRef<HTMLDivElement>(null);
  const batteryRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const hasBattery = battery.qty > 0;
  const openPicker = readOnly ? undefined : onOpenPicker;

  return (
    <div className="relative mx-auto w-fit">
      <div
        ref={containerRef}
        className="relative hidden items-start gap-8 lg:flex"
        aria-label="Full system wiring diagram"
      >
        <FullBomWiringOverlay
          containerRef={containerRef}
          panelRef={panelRef}
          inverterRef={inverterRef}
          bosRef={bosRef}
          batteryRef={batteryRef}
          gridRef={gridRef}
          homeRef={homeRef}
          layoutKey={layoutKey}
        />

        <div ref={panelRef} className="relative z-10 shrink-0">
          <CanvasComponentCard
            component={panel}
            showProductImage
            onSwap={openPicker ? () => openPicker("panel", "swap") : undefined}
          />
          <p className="mt-1 text-center font-sans text-[9px] font-semibold tracking-[0.8px] text-[#2f6f58] uppercase">
            {canvasSlotHeader("panel")}
          </p>
        </div>

        <div ref={inverterRef} className="relative z-10 shrink-0">
          <CanvasComponentCard
            component={inverter}
            highlighted
            showProductImage
            onSwap={openPicker ? () => openPicker("inverter", "swap") : undefined}
          />
          <p className="mt-1 text-center font-sans text-[9px] font-semibold tracking-[0.8px] text-[#2f6f58] uppercase">
            {canvasSlotHeader("inverter")}
          </p>
        </div>

        <div className="relative z-10 flex w-[19rem] flex-col gap-3">
          <div
            ref={bosRef}
            className={cn(
              "flex flex-col gap-3 rounded-[16px] border-2 border-dashed p-3",
              "border-[#b9dccf] bg-[#f7fbf8]",
            )}
          >
            <p className="px-0.5 font-sans text-[10px] font-bold tracking-[1px] text-[#2f6f58] uppercase">
              Balance of system
            </p>
            <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto pr-0.5">
              {bomGroups.map((group) => (
                <DiagramBomGroupSection key={group.slot} group={group} />
              ))}
            </div>
          </div>

          <div ref={batteryRef} className="shrink-0">
            {hasBattery ? (
              <CanvasComponentCard
                component={battery}
                showProductImage
                onSwap={openPicker ? () => openPicker("battery", "swap") : undefined}
              />
            ) : readOnly ? (
              <CanvasComponentCard component={battery} showProductImage />
            ) : (
              <AddComponentCard onAdd={() => openPicker!("battery", "add")} />
            )}
            <p className="mt-1 text-center font-sans text-[9px] font-semibold tracking-[0.8px] text-[#2f6f58] uppercase">
              {canvasSlotHeader("battery")}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 flex-col gap-3 self-center">
          <DestinationCard
            cardRef={gridRef}
            label="Grid"
            detail="Utility net-meter export"
            icon="grid"
          />
          <DestinationCard
            cardRef={homeRef}
            label="Home"
            detail="On-site consumption"
            icon="home"
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 lg:hidden">
        <CanvasComponentCard
          component={panel}
          showProductImage
          onSwap={openPicker ? () => openPicker("panel", "swap") : undefined}
        />
        <FlowConnector label="DC" />
        <CanvasComponentCard
          component={inverter}
          highlighted
          showProductImage
          onSwap={openPicker ? () => openPicker("inverter", "swap") : undefined}
        />
        <FlowConnector label="AC" />
        <div className="flex w-full max-w-[19rem] flex-col gap-3 rounded-[16px] border-2 border-dashed border-[#b9dccf] bg-[#f7fbf8] p-3">
          <p className="font-sans text-[10px] font-bold tracking-[1px] text-[#2f6f58] uppercase">
            Balance of system
          </p>
          {bomGroups.map((group) => (
            <DiagramBomGroupSection key={group.slot} group={group} />
          ))}
        </div>
        {hasBattery ? (
          <CanvasComponentCard
            component={battery}
            showProductImage
            onSwap={openPicker ? () => openPicker("battery", "swap") : undefined}
          />
        ) : readOnly ? (
          <CanvasComponentCard component={battery} showProductImage />
        ) : (
          <AddComponentCard onAdd={() => openPicker!("battery", "add")} />
        )}
        <FlowConnector />
        <DestinationCard label="Grid" detail="Utility net-meter export" icon="grid" />
        <DestinationCard label="Home" detail="On-site consumption" icon="home" />
      </div>
    </div>
  );
}
