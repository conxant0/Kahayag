// Defines the horizontal build summary row under the design stepper.
import type { ReactNode } from "react";

import { Button } from "../../shared/components/ui";
import type { DesignSummaryTile } from "./designViewModel";

function PanelIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 11h18M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function InverterIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="7" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  "Energy capture": <PanelIcon />,
  "Power converter": <InverterIcon />,
  "Energy store": <BatteryIcon />,
};

export function DesignSummaryBar({
  tiles,
  onSave,
  onApply,
  applyDisabled = false,
  saveDisabled = false,
}: {
  tiles: DesignSummaryTile[];
  onSave?: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
  saveDisabled?: boolean;
}) {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Active build summary"
      className="border-b border-hairline bg-white"
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-4">
        <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex items-center gap-3">
              <span className="text-secondary">{ICONS[tile.label]}</span>
              <div>
                <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
                  {tile.label}
                </p>
                <p className="font-sans text-sm font-semibold text-ink">{tile.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            disabled={saveDisabled}
            onClick={onSave}
            className="h-11 min-w-[9.5rem] border-hairline bg-white px-5 text-ink"
          >
            Save design
          </Button>
          <Button
            disabled={applyDisabled}
            onClick={onApply}
            className="h-11 min-w-[9.5rem] bg-ink px-5 text-paper hover:bg-ink hover:shadow-none"
          >
            Apply design
          </Button>
        </div>
      </div>
    </section>
  );
}
