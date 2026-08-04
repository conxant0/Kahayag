import { useMemo, useState } from "react";

import type { DesignBuild, DesignSession } from "../../shared/api/types";
import { canvasSlots } from "./designViewModel";
import { AddComponentCard, CanvasComponentCard } from "./CanvasComponentCard";

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
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="flex size-10 items-center justify-center font-sans text-lg text-ink hover:bg-[#f2eee4]"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="flex size-10 items-center justify-center border-t border-hairline font-sans text-lg text-ink hover:bg-[#f2eee4]"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset zoom"
        onClick={onReset}
        className="flex size-10 items-center justify-center border-t border-hairline text-secondary hover:bg-[#f2eee4]"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 8V4h4M20 16v4h-4M4 4l6 6M20 20l-6-6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
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
  const slots = useMemo(() => canvasSlots(build), [build]);
  const [panel, inverter, protection, battery] = slots;

  if (!panel || !inverter || !protection || !battery) {
    return null;
  }

  return (
    <div className="relative h-full min-h-[28rem] overflow-hidden rounded-[20px] border border-hairline bg-[#fcfaf5]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #d8d2c4 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      <div className="relative h-full min-h-[28rem] overflow-auto p-6 lg:p-10">
        <div
          className="relative mx-auto min-h-[24rem] w-full max-w-[920px] transition-transform duration-150"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center top" }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 920 420"
            preserveAspectRatio="none"
          >
            <path
              d="M290 150 H420"
              stroke="#d8d2c4"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M560 150 H680"
              stroke="#d8d2c4"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M760 190 V250"
              stroke="#d8d2c4"
              strokeWidth="2"
              fill="none"
            />
          </svg>

          <div className="relative grid min-h-[24rem] grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_1fr] lg:grid-rows-[auto_auto]">
            <div className="flex justify-center lg:justify-start lg:pt-8">
              <CanvasComponentCard component={panel} />
            </div>

            <div className="flex justify-center lg:pt-2">
              <CanvasComponentCard component={inverter} highlighted />
            </div>

            <div className="flex flex-col items-center gap-4 lg:items-end">
              <CanvasComponentCard component={protection} />
              <CanvasComponentCard component={battery} />
              <AddComponentCard />
            </div>
          </div>
        </div>
      </div>

      <ZoomControls
        onZoomIn={() => setZoom((value) => Math.min(value + 0.1, 1.4))}
        onZoomOut={() => setZoom((value) => Math.max(value - 0.1, 0.7))}
        onReset={() => setZoom(1)}
      />
    </div>
  );
}
