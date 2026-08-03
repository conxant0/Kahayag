import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "../../../shared/hooks/usePrefersReducedMotion";

/**
 * Drives the Step 02 sequence once the block scrolls into view:
 *
 *   1. `sweeping`  — the cobalt progress line sweeps as the photo is "read"
 *   2. `typing`    — the bill digits type in behind a blinking cobalt caret
 *   3. `underline` — the amber underline draws left to right
 *   4. `done`      — everything settled
 *
 * Under prefers-reduced-motion the whole thing jumps straight to `done`, which
 * renders the same final frame with no intermediate states.
 */
export type BillPhase = "idle" | "sweeping" | "typing" | "underline" | "done";

/**
 * Internal stages. "sweeping" is absent on purpose: it is the state the sequence
 * is already in the moment it becomes active, so it is derived below rather than
 * set, which keeps the effect free of a synchronous render.
 */
type BillStage = "pending" | "typing" | "underline" | "done";

const FULL_VALUE = "4,800";
const SWEEP_MS = 900;
const TYPE_STEP_MS = 130;
const UNDERLINE_MS = 420;

export function useBillSequence(active: boolean) {
  const prefersReduced = usePrefersReducedMotion();
  const [stage, setStage] = useState<BillStage>("pending");
  const [typedCount, setTypedCount] = useState(0);

  useEffect(() => {
    if (!active || prefersReduced) return undefined;

    const timers: number[] = [];

    timers.push(
      window.setTimeout(() => {
        setStage("typing");

        // One character per tick; the caret sits at the typing head.
        for (let index = 1; index <= FULL_VALUE.length; index += 1) {
          timers.push(
            window.setTimeout(() => setTypedCount(index), TYPE_STEP_MS * index),
          );
        }

        timers.push(
          window.setTimeout(
            () => setStage("underline"),
            TYPE_STEP_MS * FULL_VALUE.length + 120,
          ),
        );

        timers.push(
          window.setTimeout(
            () => setStage("done"),
            TYPE_STEP_MS * FULL_VALUE.length + 120 + UNDERLINE_MS,
          ),
        );
      }, SWEEP_MS),
    );

    return () => timers.forEach(window.clearTimeout);
  }, [active, prefersReduced]);

  // Reduced motion lands on the finished frame by derivation, not by scheduling
  // a render for every beat it would otherwise have played.
  const settled = prefersReduced && active;
  const committed = settled ? FULL_VALUE.length : typedCount;

  let phase: BillPhase = "idle";
  if (settled) phase = "done";
  else if (active) phase = stage === "pending" ? "sweeping" : stage;

  return {
    phase,
    /** The digits committed so far, e.g. "4,8". */
    typed: FULL_VALUE.slice(0, committed),
    /** The remainder, shown ghosted at 22% until it is typed. */
    pending: FULL_VALUE.slice(committed),
    fullValue: FULL_VALUE,
  };
}
