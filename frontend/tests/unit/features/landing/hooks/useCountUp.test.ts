// Verifies the payoff figure counts up, and is never withheld when it cannot.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCountUp } from "../../../../../src/features/landing/hooks/useCountUp";

import { installTimedHookHarness, setReducedMotion } from "./timedHookHarness";

const TARGET = 4850;
const DURATION_MS = 1100;

// This hook runs on requestAnimationFrame, not setTimeout, so the clock has to
// fake that and the timestamps it reads.
installTimedHookHarness({
  toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
});

describe("useCountUp", () => {
  it("stays at zero until it is activated", () => {
    const { result } = renderHook(() => useCountUp(TARGET, false));

    act(() => vi.advanceTimersByTime(DURATION_MS));

    expect(result.current).toBe(0);
  });

  it("climbs toward the target and lands exactly on it", () => {
    const { result } = renderHook(() => useCountUp(TARGET, true));

    act(() => vi.advanceTimersByTime(DURATION_MS / 2));
    const midway = result.current;

    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(TARGET);

    act(() => vi.advanceTimersByTime(DURATION_MS));
    expect(result.current).toBe(TARGET);
  });

  it("decelerates, so it is past halfway at the midpoint", () => {
    const { result } = renderHook(() => useCountUp(TARGET, true));

    act(() => vi.advanceTimersByTime(DURATION_MS / 2));

    // Ease-out: most of the distance is covered early.
    expect(result.current).toBeGreaterThan(TARGET / 2);
  });

  it("returns the figure immediately under reduced motion, animating nothing", () => {
    setReducedMotion(true);
    // This hook schedules frames rather than timers, so a timer count would
    // report zero whether or not it was still animating. Watching the frame
    // request is what actually shows the sequence was never started.
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");

    const { result } = renderHook(() => useCountUp(TARGET, true));

    // The payoff is information, not decoration, so it is never withheld.
    expect(result.current).toBe(TARGET);
    expect(requestFrame).not.toHaveBeenCalled();

    // And it stays that way: no frame arrives later to animate over the top.
    act(() => vi.advanceTimersByTime(DURATION_MS * 2));
    expect(requestFrame).not.toHaveBeenCalled();
    expect(result.current).toBe(TARGET);
  });

  it("releases its frame when the block unmounts mid-count", () => {
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = renderHook(() => useCountUp(TARGET, true));

    act(() => vi.advanceTimersByTime(DURATION_MS / 3));
    unmount();

    expect(cancelFrame).toHaveBeenCalled();
  });
});
