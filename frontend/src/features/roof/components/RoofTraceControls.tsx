import { Button } from "../../../shared/components/ui";
import { cn } from "../../../shared/lib/cn";
import type { RoofMetrics } from "../roofUtils";
import type { RoofTraceStageView } from "../roofTraceStage";

type Props = {
  stage: RoofTraceStageView;
  vertexCount: number;
  roofMetrics: RoofMetrics;
  validationMessage: string;
  startRoofTracing: () => void;
  finishRoofTracing: () => void;
  resetRoofTracing: () => void;
  redrawRoofTracing: () => void;
};

/**
 * The controls and the running area, at the foot of the screen.
 *
 * One weighted action at a time rather than a block of four equal buttons.
 * Which button matters depends entirely on what has happened so far, and a
 * grid of same-sized pills left the person to work that out themselves.
 *
 * `secondary` is the heaviest weight used here on purpose: the yellow pill is
 * the step's way forward, and a screen carries exactly one of those.
 */
export function RoofTraceControls({
  stage,
  vertexCount,
  roofMetrics,
  validationMessage,
  startRoofTracing,
  finishRoofTracing,
  resetRoofTracing,
  redrawRoofTracing,
}: Props) {
  const area = roofMetrics.areaSquareMeters;
  const hasSecondaryRow = stage.canRedraw || stage.canClear;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5",
        // On a phone this floats over the satellite photo, so each control
        // carries its own opaque pill and the gaps between them stay map. A
        // filled band behind the whole block was legible but took a slice of
        // roof with it, which on the one screen where the map *is* the task is
        // the wrong trade.
        //
        // The shadow does the work the band was doing: it separates a white
        // pill from pale render and concrete without covering either.
        "[&_button]:shadow-[0_1px_10px_rgba(31,29,26,0.28)]",
        "[&>div]:shadow-[0_1px_10px_rgba(31,29,26,0.28)]",
        "[&_p[role=alert]]:shadow-[0_1px_10px_rgba(31,29,26,0.28)]",
        "lg:[&_button]:shadow-none lg:[&>div]:shadow-none",
        "lg:[&_p[role=alert]]:shadow-none",
      )}
    >
      {validationMessage && (
        <p
          role="alert"
          className={cn(
            "rounded-xl border border-ember/30 bg-white px-3.5 py-2.5",
            "font-sans text-[13px] leading-snug text-ember",
          )}
        >
          {validationMessage}
        </p>
      )}

      {area > 0 && (
        <div className="flex items-baseline justify-between gap-3 rounded-xl border border-hairline bg-white px-3.5 py-2.5">
          <span className="font-sans text-[13px] text-secondary">
            Usable roof area
          </span>
          <span className="font-sans text-base font-semibold text-ink">
            {area.toFixed(0)} m²
            {/* The corner count is the one other number worth showing while
                dragging: it says whether that midpoint drag actually landed. */}
            <span className="ml-2 text-[13px] font-normal text-secondary">
              {vertexCount} corners
            </span>
          </span>
        </div>
      )}

      {stage.action && (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={
            stage.action.kind === "confirm"
              ? finishRoofTracing
              : startRoofTracing
          }
          disabled={!stage.actionEnabled}
          className={cn(
            "h-12 text-[15px]",
            /*
             * The one control on this screen that was not carrying an opaque
             * pill. `secondary` fills with a 6% cobalt wash, which is a fill
             * for a card sitting on the page; over a satellite photo it is
             * 94% roof, and the step's main action read as a floating outline.
             *
             * Painted rather than swapped for a flat colour: the wash goes back
             * on top as an image layer over paper, which composites to exactly
             * what desktop already shows while stopping the map coming through.
             * Hover clears the layer so the cobalt fill lands solid.
             */
            "bg-paper bg-[image:linear-gradient(var(--color-cobalt-wash),var(--color-cobalt-wash))]",
            "hover:bg-none",
          )}
        >
          {stage.action.label}
        </Button>
      )}

      {hasSecondaryRow && (
        <div className="flex gap-2">
          {stage.canRedraw && (
            <Button
              type="button"
              variant="ghost"
              onClick={redrawRoofTracing}
              className="flex-1 justify-center"
            >
              Start over
            </Button>
          )}
          {stage.canClear && (
            <Button
              type="button"
              variant="ghost"
              onClick={resetRoofTracing}
              className="flex-1 justify-center hover:border-ember/40 hover:text-ember"
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
