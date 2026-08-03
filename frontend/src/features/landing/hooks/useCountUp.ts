import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "../../../shared/hooks/usePrefersReducedMotion";

/** Ease-out so the number decelerates into its final value rather than snapping. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts from 0 to `target` once `active` becomes true.
 *
 * Under prefers-reduced-motion the target is returned immediately — the payoff
 * figure is information, so it is never withheld, only un-animated.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1100) {
  const prefersReduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active || prefersReduced) return undefined;

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(target * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, durationMs, prefersReduced]);

  // Derived rather than set, so reduced motion never schedules a render just to
  // land on the value we already know.
  return prefersReduced && active ? target : value;
}
