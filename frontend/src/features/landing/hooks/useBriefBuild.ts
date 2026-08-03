import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "../../../shared/hooks/usePrefersReducedMotion";

/**
 * Assembles the Step 03 brief once it scrolls into view: the sheets settle, the
 * masthead lands, the rule draws, the four figures arrive in order and the site
 * assumptions rule themselves in.
 *
 * It plays once and holds, rather than looping like the Step 01 trace. Tracing
 * is something you do repeatedly; the brief is the artefact you end up with, and
 * a document that keeps rewriting itself reads as unfinished.
 *
 * Under prefers-reduced-motion the finished state is returned by derivation, the
 * same way the bill sequence settles — nothing is scheduled at all.
 */
export type BriefStage =
  "idle" | "sheets" | "masthead" | "rule" | "specs" | "lines" | "done";

/** Every stage after "idle", in the order they fire. */
type BuildStage = Exclude<BriefStage, "idle">;

const ORDER: BuildStage[] = [
  "sheets",
  "masthead",
  "rule",
  "specs",
  "lines",
  "done",
];

/** Milliseconds from the start of the build to each stage. */
const AT: Record<BuildStage, number> = {
  sheets: 0,
  masthead: 340,
  rule: 620,
  specs: 820,
  lines: 1320,
  done: 1900,
};

/** Per-item stagger inside the two list stages. */
export const SPEC_STEP_MS = 90;
export const LINE_STEP_MS = 70;

/** "idle" ranks below every build stage, so `has` is a plain comparison. */
const RANK: Record<BriefStage, number> = {
  idle: -1,
  ...Object.fromEntries(ORDER.map((stage, index) => [stage, index])),
} as Record<BriefStage, number>;

const reached = (of: BuildStage, current: BriefStage) =>
  RANK[current] >= RANK[of];

export function useBriefBuild(active: boolean) {
  const prefersReduced = usePrefersReducedMotion();
  const [stage, setStage] = useState<BriefStage>("idle");

  useEffect(() => {
    if (!active || prefersReduced) return undefined;

    const timers = ORDER.map((next) =>
      window.setTimeout(() => setStage(next), AT[next]),
    );

    return () => timers.forEach(window.clearTimeout);
  }, [active, prefersReduced]);

  const settled = prefersReduced && active;
  const current: BriefStage = settled ? "done" : stage;

  return {
    stage: current,
    /** True once the named stage has been reached. */
    has: (of: BuildStage) => reached(of, current),
  };
}
