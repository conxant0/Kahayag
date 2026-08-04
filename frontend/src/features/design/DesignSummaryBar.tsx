// Defines the horizontal build summary row under the design stepper.
import { Button } from "../../shared/components/ui";

export type DesignSummaryTile = {
  label: string;
  value: string;
  detail: string;
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
      className="flex flex-col gap-3 border-b border-hairline bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-4"
    >
      <div className="grid flex-1 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-[14px] border border-hairline bg-[#fcfaf5] px-4 py-3"
          >
            <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
              {tile.label}
            </p>
            <p className="mt-1 font-sans text-sm font-semibold text-ink">
              {tile.value}
            </p>
            <p className="mt-0.5 font-sans text-[12px] text-secondary">
              {tile.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:min-w-[17rem]">
        <Button
          variant="ghost"
          fullWidth
          disabled={saveDisabled}
          onClick={onSave}
          className="h-12 border-hairline bg-white text-ink"
        >
          Save design
        </Button>
        <Button
          fullWidth
          disabled={applyDisabled}
          onClick={onApply}
          className="h-12 bg-ink text-paper hover:bg-ink hover:shadow-none"
        >
          Apply design
        </Button>
      </div>
    </section>
  );
}
