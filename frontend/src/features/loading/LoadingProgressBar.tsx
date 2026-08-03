// Defines the determinate bar shown while the assessment resolves.
import { memo } from "react";

/**
 * Decorative on purpose: the width is a pacing device, not a measurement of
 * work done, and the message above it is already announced through a live
 * region. Giving this a `progressbar` role would have assistive tech read out
 * a percentage the product cannot actually stand behind.
 */
export const LoadingProgressBar = memo(function LoadingProgressBar({
  progress,
}: {
  progress: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="h-0.75 w-55 overflow-hidden rounded-xs bg-hairline lg:w-74.25"
    >
      <div
        className="h-full rounded-xs bg-cobalt transition-[width] duration-500 ease-brand motion-reduce:transition-none"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
});
