// Verifies the payoff figure counts up, and is never withheld when it cannot.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "../../../../../src/features/landing/hooks/useCountUp";

import { restoreMotionPreference, setReducedMotion } from "./motionPreference";

const TARGET = 4850;
const DURATION_MS = 1100;

beforeEach(() => {
  setReducedMotion(false);
  // The hook drives itself off requestAnimationFrame, so that has to be faked
  // alongside the clock it reads its timestamps from.
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
});

afterEach(() => {
  vi.useRealTimers();
  restoreMotionPreference();
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

  it("returns the figure immediately under reduced motion", () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useCountUp(TARGET, true));

    // The payoff is information, not decoration, so it is never withheld.
    expect(result.current).toBe(TARGET);
  });
});
