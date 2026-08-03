// Verifies the Step 02 bill sequence advances on time and settles when asked.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBillSequence } from "../../../../../src/features/landing/hooks/useBillSequence";

import { installTimedHookHarness, setReducedMotion } from "./timedHookHarness";

// Mirrors the hook's own constants. Hard-coded on purpose: the point of these
// tests is to notice when a beat moves.
const SWEEP_MS = 900;
const TYPE_STEP_MS = 130;
const FULL_VALUE = "4,800";
const TYPING_DONE_MS = SWEEP_MS + TYPE_STEP_MS * FULL_VALUE.length;
const UNDERLINE_AT_MS = TYPING_DONE_MS + 120;
const DONE_AT_MS = UNDERLINE_AT_MS + 420;

installTimedHookHarness();

describe("useBillSequence", () => {
  it("stays idle until the block is in view", () => {
    const { result } = renderHook(() => useBillSequence(false));

    expect(result.current.phase).toBe("idle");
    expect(result.current.typed).toBe("");
    expect(result.current.pending).toBe(FULL_VALUE);
  });

  it("sweeps first, then types, underlines, and settles", () => {
    const { result } = renderHook(() => useBillSequence(true));

    expect(result.current.phase).toBe("sweeping");

    act(() => vi.advanceTimersByTime(SWEEP_MS));
    expect(result.current.phase).toBe("typing");

    act(() => vi.advanceTimersByTime(TYPING_DONE_MS - SWEEP_MS));
    expect(result.current.typed).toBe(FULL_VALUE);
    expect(result.current.pending).toBe("");

    act(() => vi.advanceTimersByTime(UNDERLINE_AT_MS - TYPING_DONE_MS));
    expect(result.current.phase).toBe("underline");

    act(() => vi.advanceTimersByTime(DONE_AT_MS - UNDERLINE_AT_MS));
    expect(result.current.phase).toBe("done");
  });

  it("commits one character per step while typing", () => {
    const { result } = renderHook(() => useBillSequence(true));

    act(() => vi.advanceTimersByTime(SWEEP_MS + TYPE_STEP_MS));
    expect(result.current.typed).toBe("4");

    act(() => vi.advanceTimersByTime(TYPE_STEP_MS));
    expect(result.current.typed).toBe("4,");
  });

  it("settles straight to done under reduced motion, scheduling nothing", () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useBillSequence(true));

    expect(result.current.phase).toBe("done");
    expect(result.current.typed).toBe(FULL_VALUE);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timers when the block leaves view", () => {
    const { unmount } = renderHook(() => useBillSequence(true));

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
