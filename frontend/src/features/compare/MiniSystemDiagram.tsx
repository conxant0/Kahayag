// Defines a horizontal read-only system diagram for two-column compare.
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import type { DesignComponent } from "../../shared/api/types";
import { CanvasComponentCard } from "../design/CanvasComponentCard";
import { canvasSlotsFromComponents } from "../design/designViewModel";

const CARD_CLASS = "w-[7.25rem]";

function GapLine() {
  return (
    <div className="flex w-3 shrink-0 items-center self-center" aria-hidden="true">
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
      const hubX = gapBox.width / 2;

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
    <div ref={gapRef} className="relative w-4 shrink-0 self-stretch" aria-hidden="true">
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

export function MiniSystemDiagram({ components }: { components: DesignComponent[] }) {
  const [panel, inverter, protection, battery] = canvasSlotsFromComponents(components);
  const inverterRef = useRef<HTMLDivElement>(null);
  const protectionRef = useRef<HTMLDivElement>(null);
  const batteryRef = useRef<HTMLDivElement>(null);
  const layoutKey = [
    panel.catalog_id,
    panel.model,
    inverter.catalog_id,
    inverter.model,
    protection.catalog_id,
    battery.catalog_id,
    battery.qty,
  ].join(":");

  return (
    <div aria-label="System layout preview" className="mx-auto w-full max-w-full overflow-hidden">
      <div className="mx-auto flex w-fit max-w-full items-center justify-center">
        <CanvasComponentCard component={panel} compact className={CARD_CLASS} />
        <GapLine />
        <div ref={inverterRef} className="shrink-0">
          <CanvasComponentCard component={inverter} compact highlighted className={CARD_CLASS} />
        </div>
        <BranchGap
          inverterRef={inverterRef}
          protectionRef={protectionRef}
          batteryRef={batteryRef}
          layoutKey={layoutKey}
        />
        <div className="flex shrink-0 flex-col justify-center gap-1.5">
          <div ref={protectionRef}>
            <CanvasComponentCard component={protection} compact className={CARD_CLASS} />
          </div>
          <div ref={batteryRef}>
            <CanvasComponentCard component={battery} compact className={CARD_CLASS} />
          </div>
        </div>
      </div>
    </div>
  );
}
