// Defines the inline build summary and apply action beside the design heading.
import { Button, Eyebrow } from "../../shared/components/ui";
import type { DesignSummaryTile } from "./designViewModel";

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
      className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <Eyebrow className="text-[10px] tracking-[1px]">
              {tile.label}
            </Eyebrow>
            <p className="mt-0.5 font-sans text-sm font-semibold text-ink">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {/* Without a handler the button would be an enabled no-op — render
            it only once saving exists to wire up. */}
        {onSave ? (
          <Button
            variant="ghost"
            disabled={saveDisabled}
            onClick={onSave}
            className="h-11 min-w-[9.5rem] border-hairline bg-white px-5 text-ink"
          >
            Save design
          </Button>
        ) : null}
        <Button
          disabled={applyDisabled}
          onClick={onApply}
          className="h-12 min-w-[10rem] px-6"
        >
          Apply design
        </Button>
      </div>
    </section>
  );
}
