// Drives the loading bar for the assessment and flux-preload phases.
import { useCallback, useEffect, useRef, useState } from "react";

const TICK_MS = 180;

/** Where the bar starts, so it never reads as "nothing is happening". */
const INITIAL_PROGRESS = 8;

export type LoadingPhase = "assessment" | "flux";

export type LoadingProgressInput = {
  phase: LoadingPhase;
  isAssessmentPending: boolean;
  isAssessmentComplete: boolean;
  isFluxRunning: boolean;
  hasError: boolean;
  prefersReducedMotion: boolean;
};

/**
 * The ceiling the bar creeps toward in each state.
 *
 * None of them is 100: work that has not finished must not look finished, and
 * the last stretch is only spent by `completeProgress`, once the page knows it
 * is about to navigate.
 */
function computeTarget({
  phase,
  isAssessmentPending,
  isAssessmentComplete,
  isFluxRunning,
}: Pick<
  LoadingProgressInput,
  "phase" | "isAssessmentPending" | "isAssessmentComplete" | "isFluxRunning"
>): number {
  if (isFluxRunning) {
    return 92;
  }

  if (phase === "flux" && isAssessmentComplete) {
    return 58;
  }

  if (isAssessmentComplete) {
    return 48;
  }

  if (isAssessmentPending) {
    return 36;
  }

  return 14;
}

/** Eases in, so the bar decelerates as it approaches a ceiling. */
function advanceToward(current: number, target: number): number {
  if (current >= target) {
    return current;
  }

  const delta = Math.max(0.35, (target - current) * 0.12);
  return Math.min(target, current + delta);
}

/**
 * Progress that only moves forward, creeping toward phase-appropriate targets
 * while async work runs.
 *
 * A bar that goes backwards reads as failure, so a floor is carried alongside
 * the value and every write takes the larger of the two.
 */
export function useLoadingProgress({
  phase,
  isAssessmentPending,
  isAssessmentComplete,
  isFluxRunning,
  hasError,
  prefersReducedMotion,
}: LoadingProgressInput): {
  progress: number;
  completeProgress: () => void;
} {
  const floorRef = useRef(INITIAL_PROGRESS);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);

  const raiseFloorTo = useCallback((value: number) => {
    setProgress((current) => {
      const next = Math.max(current, value, floorRef.current);
      floorRef.current = next;
      return next;
    });
  }, []);

  // Each milestone jumps the bar rather than waiting for the timer to creep
  // there, so finishing a phase is visible immediately.
  useEffect(() => {
    if (isAssessmentComplete) {
      raiseFloorTo(48);
    }
  }, [isAssessmentComplete, raiseFloorTo]);

  useEffect(() => {
    if (isFluxRunning) {
      raiseFloorTo(58);
    }
  }, [isFluxRunning, raiseFloorTo]);

  useEffect(() => {
    // With motion off there is no creep to watch, and an animated bar is the
    // thing the preference asks not to see. It is simply full.
    if (prefersReducedMotion) {
      floorRef.current = 100;
      setProgress(100);
      return undefined;
    }

    // A stalled bar beside an error message would suggest the work continues.
    if (hasError) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setProgress((current) => {
        const target = computeTarget({
          phase,
          isAssessmentPending,
          isAssessmentComplete,
          isFluxRunning,
        });
        const next = advanceToward(Math.max(current, floorRef.current), target);
        floorRef.current = next;
        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [
    hasError,
    isAssessmentComplete,
    isAssessmentPending,
    isFluxRunning,
    phase,
    prefersReducedMotion,
  ]);

  const completeProgress = useCallback(() => {
    floorRef.current = 100;
    setProgress(100);
  }, []);

  return { progress, completeProgress };
}
