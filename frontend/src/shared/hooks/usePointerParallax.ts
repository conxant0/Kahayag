import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useMediaQuery } from "./useMediaQuery";

/**
 * Publishes the pointer's position over an element as `--px` / `--py`, each in
 * the range -0.5..0.5 from the centre.
 *
 * Children read those variables in their own transforms, so one listener drives
 * any number of layers at whatever depth each wants. Nothing re-renders: the
 * values are written straight onto the element's style inside a rAF, because a
 * pointermove that goes through React state would re-render the hero on every
 * frame of a mouse movement.
 *
 * Off entirely without a fine pointer — a touch device has no hover to track,
 * and a tap would otherwise leave the effect stuck at wherever it last landed —
 * and off under prefers-reduced-motion.
 */
/** Fraction of the remaining distance covered per frame. Lower is softer. */
const EASE = 0.075;

/** Below this the movement is invisible, so the loop stops. */
const EPSILON = 0.0004;

export function usePointerParallax<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const prefersReduced = usePrefersReducedMotion();
  const enabled = canHover && !prefersReduced;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;

    let frame = 0;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    /**
     * Eased toward the pointer rather than pinned to it. A CSS transition
     * chasing a value that changes every frame never arrives — it restarts,
     * which is what makes pointer parallax feel like it is lagging and
     * stuttering at once. Damping here means the layers always move smoothly and
     * the CSS carries no transition at all.
     */
    const tick = () => {
      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;

      el.style.setProperty("--px", current.x.toFixed(4));
      el.style.setProperty("--py", current.y.toFixed(4));

      const settled =
        Math.abs(target.x - current.x) < EPSILON &&
        Math.abs(target.y - current.y) < EPSILON;

      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const run = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      target.x = (event.clientX - rect.left) / rect.width - 0.5;
      target.y = (event.clientY - rect.top) / rect.height - 0.5;
      run();
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      run();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.removeProperty("--px");
      el.style.removeProperty("--py");
    };
  }, [enabled]);

  return { ref, enabled };
}
