import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

import type {
  CatalogOption,
  CatalogPickerSlot,
  DesignBuild,
  DesignSession,
} from "../../shared/api/types";
import { SegmentedToggle } from "../../shared/components/ui";
import {
  CANVAS_VIEW_OPTIONS,
  canvasBomGroups,
  canvasSlots,
  type CanvasViewMode,
} from "./designViewModel";
import { AddComponentCard, CanvasComponentCard } from "./CanvasComponentCard";
import { ComponentPickerModal } from "./ComponentPickerModal";
import { FullBomDiagram } from "./FullBomDiagram";
import { useMutateDesign } from "./useDesignActions";

type PickerState = {
  slot: CatalogPickerSlot;
  mode: "swap" | "add";
};

function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute right-4 bottom-4 flex flex-col overflow-hidden rounded-[12px] border border-hairline bg-white shadow-[0_3px_10px_rgba(26,23,18,0.06)]">
      <button type="button" aria-label="Zoom in" onClick={onZoomIn} className="flex size-10 items-center justify-center font-sans text-lg text-ink hover:bg-[#f2eee4]">+</button>
      <button type="button" aria-label="Zoom out" onClick={onZoomOut} className="flex size-10 items-center justify-center border-t border-hairline font-sans text-lg text-ink hover:bg-[#f2eee4]">−</button>
      <button type="button" aria-label="Reset zoom" onClick={onReset} className="flex size-10 items-center justify-center border-t border-hairline text-secondary hover:bg-[#f2eee4]">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 8V4h4M20 16v4h-4M4 4l6 6M20 20l-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: CanvasViewMode;
  onChange: (value: CanvasViewMode) => void;
}) {
  return (
    <SegmentedToggle
      value={value}
      options={CANVAS_VIEW_OPTIONS}
      onChange={onChange}
      ariaLabel="Canvas view mode"
      className="shadow-[0_3px_10px_rgba(26,23,18,0.06)]"
    />
  );
}

function GapLine() {
  return (
    <div className="flex w-5 shrink-0 items-center self-center" aria-hidden="true">
      <div className="h-0.5 w-full rounded-pill bg-[#bfb9ab]" />
    </div>
  );
}

function BranchGap({
  inverterRef,
  protectionRef,
  batteryRef,
  layoutKey,
}: {
  inverterRef: RefObject<HTMLDivElement | null>;
  protectionRef: RefObject<HTMLDivElement | null>;
  batteryRef: RefObject<HTMLDivElement | null>;
  layoutKey: string;
}) {
  const gapRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const gap = gapRef.current;
      const inverter = inverterRef.current;
      const protection = protectionRef.current;
      const battery = batteryRef.current;
      if (!gap || !inverter || !protection || !battery) {
        return;
      }

      const gapBox = gap.getBoundingClientRect();
      if (gapBox.width <= 0 || gapBox.height <= 0) {
        return;
      }

      const midY = (rect: DOMRect) => rect.top + rect.height / 2 - gapBox.top;
      const inverterY = midY(inverter.getBoundingClientRect());
      const protectionY = midY(protection.getBoundingClientRect());
      const batteryY = midY(battery.getBoundingClientRect());
      const hubX = gapBox.width * 0.35;

      setSize({ width: gapBox.width, height: gapBox.height });
      setPaths([
        `M 0 ${inverterY} H ${hubX} V ${protectionY} H ${gapBox.width}`,
        `M ${hubX} ${inverterY} V ${batteryY} H ${gapBox.width}`,
      ]);
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const gap = gapRef.current;
    const observer =
      typeof ResizeObserver !== "undefined" && gap ? new ResizeObserver(measure) : null;
    if (gap && observer) {
      observer.observe(gap);
    }
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [inverterRef, protectionRef, batteryRef, layoutKey]);

  return (
    <div ref={gapRef} className="relative w-6 shrink-0 self-stretch" aria-hidden="true">
      {size.width > 0 && size.height > 0 ? (
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
        >
          {paths.map((path) => (
            <path
              key={path}
              d={path}
              stroke="#bfb9ab"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

export function SystemCanvas({
  build,
}: {
  build: DesignBuild | null;
  session: DesignSession | null;
}) {
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<CanvasViewMode>("simplified");
  const [picker, setPicker] = useState<PickerState | null>(null);
  const mutate = useMutateDesign();
  const slots = useMemo(() => canvasSlots(build), [build]);
  const bomGroups = useMemo(() => canvasBomGroups(build), [build]);
  const [panel, inverter, protection, battery] = slots;

  const inverterRef = useRef<HTMLDivElement>(null);
  const protectionRef = useRef<HTMLDivElement>(null);
  const batteryRef = useRef<HTMLDivElement>(null);

  const layoutKey = [
    panel?.catalog_id,
    inverter?.catalog_id,
    battery?.catalog_id,
    battery?.qty,
    zoom,
    viewMode,
  ].join(":");

  if (!panel || !inverter || !protection || !battery) {
    return null;
  }

  const openPicker = (slot: CatalogPickerSlot, mode: "swap" | "add") => {
    setPicker({ slot, mode });
  };

  const applySelection = async (option: CatalogOption) => {
    if (!picker) {
      return;
    }
    const patch: Record<string, unknown> = {};
    if (picker.slot === "panel") {
      patch.locked_panel_id = option.id;
    } else if (picker.slot === "inverter") {
      patch.locked_inverter_id = option.id;
    } else {
      patch.require_battery = true;
      patch.min_battery_kwh = 3;
      patch.locked_battery_id = option.id;
    }
    await mutate.mutateAsync(patch);
    setPicker(null);
  };

  const showFullBom = viewMode === "full";

  return (
    <>
      <div className="relative h-full min-h-[32rem] overflow-hidden rounded-[20px] border border-hairline bg-[#f7f4ed]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #d4cec0 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="absolute top-4 left-4 z-10">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className="relative h-full min-h-[32rem] overflow-auto p-6 pt-16 lg:p-8 lg:pt-16">
          <div
            className="mx-auto w-fit transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center top" }}
          >
            {showFullBom ? (
              <FullBomDiagram
                panel={panel}
                inverter={inverter}
                battery={battery}
                bomGroups={bomGroups}
                layoutKey={layoutKey}
                onOpenPicker={openPicker}
              />
            ) : (
              <>
                <div aria-label="System diagram" className="hidden items-center lg:flex">
                  <CanvasComponentCard
                    component={panel}
                    showProductImage
                    onSwap={() => openPicker("panel", "swap")}
                  />

                  <GapLine />

                  <div ref={inverterRef}>
                    <CanvasComponentCard
                      component={inverter}
                      highlighted
                      showProductImage
                      onSwap={() => openPicker("inverter", "swap")}
                    />
                  </div>

                  <BranchGap
                    inverterRef={inverterRef}
                    protectionRef={protectionRef}
                    batteryRef={batteryRef}
                    layoutKey={layoutKey}
                  />

                  <div className="flex flex-col gap-3">
                    <div ref={protectionRef}>
                      <CanvasComponentCard component={protection} showProductImage />
                    </div>
                    <div ref={batteryRef}>
                      <CanvasComponentCard
                        component={battery}
                        showProductImage
                        onSwap={() => openPicker("battery", battery.qty > 0 ? "swap" : "add")}
                      />
                    </div>
                    <AddComponentCard onAdd={() => openPicker("battery", "add")} />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 lg:hidden">
                  <CanvasComponentCard
                    component={panel}
                    showProductImage
                    onSwap={() => openPicker("panel", "swap")}
                  />
                  <div className="h-5 w-0.5 rounded-pill bg-[#bfb9ab]" aria-hidden="true" />
                  <CanvasComponentCard
                    component={inverter}
                    highlighted
                    showProductImage
                    onSwap={() => openPicker("inverter", "swap")}
                  />
                  <div className="h-5 w-0.5 rounded-pill bg-[#bfb9ab]" aria-hidden="true" />
                  <CanvasComponentCard component={protection} showProductImage />
                  <CanvasComponentCard
                    component={battery}
                    showProductImage
                    onSwap={() => openPicker("battery", battery.qty > 0 ? "swap" : "add")}
                  />
                  <AddComponentCard onAdd={() => openPicker("battery", "add")} />
                </div>
              </>
            )}
          </div>
        </div>

        <ZoomControls
          onZoomIn={() => setZoom((value) => Math.min(value + 0.1, 1.4))}
          onZoomOut={() => setZoom((value) => Math.max(value - 0.1, 0.7))}
          onReset={() => setZoom(1)}
        />
      </div>

      <ComponentPickerModal
        open={picker !== null}
        slot={picker?.slot ?? null}
        mode={picker?.mode ?? "swap"}
        onClose={() => setPicker(null)}
        onSelect={(option) => void applySelection(option)}
        isPending={mutate.isPending}
      />

      {mutate.error ? (
        <p className="mt-2 font-sans text-[12px] text-ember" role="alert">
          {mutate.error.message}
        </p>
      ) : null}
    </>
  );
}
