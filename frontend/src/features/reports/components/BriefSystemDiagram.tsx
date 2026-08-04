// Defines the chosen design's component diagram on the project brief.
import { useMemo } from "react";

import type { DesignComponent, DesignBuild } from "../../../shared/api/types";
import { Eyebrow } from "../../../shared/components/ui";
import { canvasSlotHeader, canvasSlots } from "../../design/designViewModel";

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
    component.unit === "pcs" ? (count === 1 ? "unit" : "units") : component.unit;
  return `${count} ${unitLabel}`;
}

function DiagramCard({
  component,
  highlighted = false,
}: {
  component: DesignComponent;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`flex w-full flex-col gap-2 rounded-[16px] border bg-white p-4 shadow-[0_3px_10px_rgba(26,23,18,0.04)] ${
        highlighted ? "border-[1.6px] border-sun" : "border-hairline"
      }`}
    >
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
    </article>
  );
}

/**
 * The design canvas, reduced to a still: the same dotted surface and the
 * same slot cards the homeowner assembled on /design, minus the zoom and
 * detail toggles. Every brand and model is the solver's pick; this only
 * lays them out for the installer to read at a glance.
 */
export function BriefSystemDiagram({ build }: { build: DesignBuild }) {
  const slots = useMemo(() => canvasSlots(build), [build]);
  const [panel, inverter, protection, battery] = slots;

  if (!panel || !inverter || !protection || !battery) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-3" aria-label="System diagram">
      <Eyebrow as="h2" className="lg:text-[14px] lg:tracking-[1.8px]">
        System diagram
      </Eyebrow>

      <div className="relative overflow-hidden rounded-[20px] border border-hairline bg-[#fcfaf5]">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, #d8d2c4 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        <div className="relative grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:p-5">
          <DiagramCard component={panel} />
          <DiagramCard component={inverter} highlighted />
          <DiagramCard component={protection} />
          <DiagramCard component={battery} />
        </div>
      </div>
    </section>
  );
}
