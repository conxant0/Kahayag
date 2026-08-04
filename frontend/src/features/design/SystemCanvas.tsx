import { useMemo, useState } from "react";

import { Button } from "../../shared/components/ui";
import type { DesignBuild, DesignSession } from "../../shared/api/types";
import { canvasSlots, rejectionsForCombo } from "./designViewModel";
import { ComponentCard } from "./ComponentCard";

const CANVAS_SLOT_LABELS = [
  "PV array",
  "Power hub",
  "Protection",
  "Energy store",
] as const;

export function SystemCanvas({
  build,
  session,
}: {
  build: DesignBuild | null;
  session: DesignSession | null;
}) {
  const [zoom, setZoom] = useState(1);
  const slots = useMemo(() => canvasSlots(build), [build]);
  const rejections = rejectionsForCombo(session, build?.combo_id ?? null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-sans text-sm text-secondary">System diagram</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setZoom((z) => Math.min(z + 0.1, 1.4))}>
            +
          </Button>
          <Button variant="ghost" onClick={() => setZoom((z) => Math.max(z - 0.1, 0.7))}>
            −
          </Button>
          <Button variant="ghost" onClick={() => setZoom(1)}>
            Fit
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-hairline bg-paper p-4">
        <div
          className="mx-auto grid max-w-3xl gap-4 transition-transform duration-150 lg:grid-cols-2"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          {slots.map((component, index) => (
            <div key={component.slot} className="flex flex-col gap-1">
              <span className="font-sans text-xs font-semibold tracking-wide text-secondary uppercase">
                {CANVAS_SLOT_LABELS[index] ?? component.slot}
              </span>
              <ComponentCard
                component={component}
                rejections={index === 1 ? rejections.slice(0, 3) : []}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
