import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "../../../shared/hooks/usePrefersReducedMotion";

export type TracePoint = { x: number; y: number };

/**
 * The roof as the engine would trace it — six vertices, in the order a person
 * would click them. Percentages of the photograph, so the shape survives any
 * pane size.
 */
export const TRACE_ROOF: TracePoint[] = [
  { x: 47.5, y: 33.5 },
  { x: 64.5, y: 45.5 },
  { x: 54, y: 71.5 },
  { x: 36.8, y: 60.5 },
  { x: 35.6, y: 52 },
  { x: 41, y: 43.5 },
];

/**
 * One beat of the demo: where the cursor travels to, whether it drops a vertex
 * on arrival, and how long the leg takes. The travel time doubles as the
 * transition duration for both the cursor and the edge being drawn behind it,
 * which is what keeps the line glued to the pointer.
 */
type Beat = { cursor: TracePoint; places: boolean; ms: number };

const BEATS: Beat[] = [
  // Fiddling: the pointer arrives, reads the image, then commits.
  { cursor: { x: 14, y: 86 }, places: false, ms: 600 },
  { cursor: { x: 33, y: 66 }, places: false, ms: 620 },
  { cursor: { x: 56, y: 24 }, places: false, ms: 560 },
  // Six clicks around the roof.
  { cursor: TRACE_ROOF[0], places: true, ms: 520 },
  { cursor: TRACE_ROOF[1], places: true, ms: 620 },
  { cursor: TRACE_ROOF[2], places: true, ms: 700 },
  { cursor: TRACE_ROOF[3], places: true, ms: 660 },
  { cursor: TRACE_ROOF[4], places: true, ms: 420 },
  { cursor: TRACE_ROOF[5], places: true, ms: 440 },
  // Back to the first vertex — the shape closes and fills.
  { cursor: TRACE_ROOF[0], places: false, ms: 560 },
  // The engine answers, and the pointer gets out of the way.
  { cursor: { x: 82, y: 16 }, places: false, ms: 900 },
];

const DWELL_MS = 200;
const HOLD_MS = 2600;
const CLEAR_MS = 620;

const CLOSE_BEAT = BEATS.length - 2;
const MEASURE_BEAT = BEATS.length - 1;

export type RoofTraceState = {
  cursor: TracePoint;
  /** Travel time of the current leg — drives the cursor and edge transitions. */
  travelMs: number;
  /** Vertices committed so far. */
  placed: number;
  /** Edges drawn so far, including the closing one. */
  edges: number;
  closed: boolean;
  measured: boolean;
  /** False for the beat between loops, which fades the overlay out. */
  visible: boolean;
  showCursor: boolean;
};

const SETTLED: RoofTraceState = {
  cursor: BEATS[MEASURE_BEAT].cursor,
  travelMs: 0,
  placed: TRACE_ROOF.length,
  edges: TRACE_ROOF.length,
  closed: true,
  measured: true,
  visible: true,
  showCursor: false,
};

/**
 * Loops the Step 01 trace once the illustration is on screen: pointer wanders
 * in, clicks six corners, the outline closes, the area fills and the engine
 * reports back — then it clears and does it again.
 *
 * Under prefers-reduced-motion nothing is scheduled at all; the finished frame
 * is returned by derivation, the same way the Step 02 sequence settles.
 */
export function useRoofTrace(active: boolean): RoofTraceState {
  const prefersReduced = usePrefersReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!active || prefersReduced) return undefined;

    let timer = 0;

    const advance = (index: number) => {
      const isLast = index === MEASURE_BEAT;
      const wait = BEATS[index].ms + (isLast ? HOLD_MS : DWELL_MS);

      timer = window.setTimeout(() => {
        if (isLast) {
          // Clear the overlay, pause on the bare photograph, then start over.
          setBeat(-1);
          timer = window.setTimeout(() => {
            setBeat(0);
            advance(0);
          }, CLEAR_MS);
          return;
        }

        setBeat(index + 1);
        advance(index + 1);
      }, wait);
    };

    advance(0);
    return () => window.clearTimeout(timer);
  }, [active, prefersReduced]);

  if (prefersReduced && active) return SETTLED;

  if (!active || beat < 0) {
    return {
      cursor: BEATS[0].cursor,
      travelMs: CLEAR_MS,
      placed: 0,
      edges: 0,
      closed: false,
      measured: false,
      visible: false,
      showCursor: false,
    };
  }

  const placed = Math.min(
    TRACE_ROOF.length,
    Math.max(0, BEATS.slice(0, beat + 1).filter((step) => step.places).length),
  );
  const closed = beat >= CLOSE_BEAT;

  return {
    cursor: BEATS[beat].cursor,
    travelMs: BEATS[beat].ms,
    placed,
    edges: closed ? TRACE_ROOF.length : Math.max(0, placed - 1),
    closed,
    measured: beat >= MEASURE_BEAT,
    visible: true,
    showCursor: beat < MEASURE_BEAT,
  };
}
