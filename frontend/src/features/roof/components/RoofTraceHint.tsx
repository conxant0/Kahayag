import type { RoofTraceStageView } from "../roofTraceStage";

/**
 * The one line of guidance that sits under the title.
 *
 * Deliberately one line and nothing else. On a phone this band is painted over
 * the map, so every extra sentence here is roof the person cannot see while
 * being told what to do with it.
 */
export function RoofTraceHint({ stage }: { stage: RoofTraceStageView }) {
  return (
    <p className="font-sans text-[15px] text-secondary lg:text-base">
      {stage.hint}
    </p>
  );
}
