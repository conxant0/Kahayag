// Verifies the Step 01 trace places its corners, closes, and loops again.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  TRACE_ROOF,
  useRoofTrace,
} from "../../../../../src/features/landing/hooks/useRoofTrace";

import { installTimedHookHarness, setReducedMotion } from "./timedHookHarness";

// Mirrors the hook's beat table. Each leg waits its travel time plus a dwell,
// except the last, which holds on the answer before clearing.
const BEAT_MS = [600, 620, 560, 520, 620, 700, 660, 420, 440, 560, 900];
const DWELL_MS = 200;
const HOLD_MS = 2600;
const CLEAR_MS = 620;

const MEASURE_BEAT = BEAT_MS.length - 1;

/** Elapsed time at which the trace has finished and is showing its answer. */
const MEASURED_AT = BEAT_MS.slice(0, MEASURE_BEAT).reduce(
  (total, ms) => total + ms + DWELL_MS,
  0,
);
const CLEARS_AT = MEASURED_AT + BEAT_MS[MEASURE_BEAT] + HOLD_MS;
const RESTARTS_AT = CLEARS_AT + CLEAR_MS;

installTimedHookHarness();

describe("useRoofTrace", () => {
  it("shows nothing until the illustration is on screen", () => {
    const { result } = renderHook(() => useRoofTrace(false));

    expect(result.current.visible).toBe(false);
    expect(result.current.placed).toBe(0);
    expect(result.current.measured).toBe(false);
  });

  it("wanders before committing its first corner", () => {
    const { result } = renderHook(() => useRoofTrace(true));

    expect(result.current.visible).toBe(true);
    expect(result.current.showCursor).toBe(true);
    expect(result.current.placed).toBe(0);
  });

  it("places every corner, closes the shape, then reports a measurement", () => {
    const { result } = renderHook(() => useRoofTrace(true));

    act(() => vi.advanceTimersByTime(MEASURED_AT));

    expect(result.current.placed).toBe(TRACE_ROOF.length);
    expect(result.current.edges).toBe(TRACE_ROOF.length);
    expect(result.current.closed).toBe(true);
    expect(result.current.measured).toBe(true);
    // The pointer gets out of the way once the engine has answered.
    expect(result.current.showCursor).toBe(false);
  });

  it("holds the answer, clears, and starts the loop again", () => {
    const { result } = renderHook(() => useRoofTrace(true));

    act(() => vi.advanceTimersByTime(MEASURED_AT));
    expect(result.current.measured).toBe(true);

    // Still holding one tick before the clear.
    act(() => vi.advanceTimersByTime(CLEARS_AT - MEASURED_AT - 1));
    expect(result.current.visible).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
    expect(result.current.placed).toBe(0);

    act(() => vi.advanceTimersByTime(RESTARTS_AT - CLEARS_AT));
    expect(result.current.visible).toBe(true);
    expect(result.current.measured).toBe(false);
    expect(result.current.placed).toBe(0);
  });

  it("settles on the finished frame under reduced motion, scheduling nothing", () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useRoofTrace(true));

    expect(result.current.placed).toBe(TRACE_ROOF.length);
    expect(result.current.closed).toBe(true);
    expect(result.current.measured).toBe(true);
    expect(result.current.visible).toBe(true);
    expect(result.current.showCursor).toBe(false);
    expect(result.current.travelMs).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops looping once the illustration unmounts", () => {
    const { unmount } = renderHook(() => useRoofTrace(true));

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
