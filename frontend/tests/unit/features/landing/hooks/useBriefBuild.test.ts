// Verifies the Step 03 brief assembles in order and holds once finished.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBriefBuild } from "../../../../../src/features/landing/hooks/useBriefBuild";

import { installTimedHookHarness, setReducedMotion } from "./timedHookHarness";

// Mirrors the hook's `AT` table, so a retimed stage fails here.
const AT = {
  sheets: 0,
  masthead: 340,
  rule: 620,
  specs: 820,
  lines: 1320,
  done: 1900,
} as const;

installTimedHookHarness();

describe("useBriefBuild", () => {
  it("stays idle until the block is in view", () => {
    const { result } = renderHook(() => useBriefBuild(false));

    expect(result.current.stage).toBe("idle");
    expect(result.current.has("sheets")).toBe(false);
  });

  it("reaches each stage at its scheduled time", () => {
    const { result } = renderHook(() => useBriefBuild(true));

    // Every stage is scheduled at mount with an absolute delay, so walk the
    // table advancing only the gap between one mark and the next.
    let elapsed = 0;
    for (const [stage, at] of Object.entries(AT)) {
      act(() => vi.advanceTimersByTime(at - elapsed));
      elapsed = at;

      expect(result.current.stage).toBe(stage);
    }
  });

  it("does not reach a stage before its mark", () => {
    const { result } = renderHook(() => useBriefBuild(true));

    act(() => vi.advanceTimersByTime(AT.masthead - 1));

    expect(result.current.stage).toBe("sheets");
  });

  it("holds on done rather than looping", () => {
    const { result } = renderHook(() => useBriefBuild(true));

    act(() => vi.advanceTimersByTime(AT.done));
    expect(result.current.stage).toBe("done");

    act(() => vi.advanceTimersByTime(AT.done * 5));
    expect(result.current.stage).toBe("done");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports every earlier stage as reached", () => {
    const { result } = renderHook(() => useBriefBuild(true));

    act(() => vi.advanceTimersByTime(AT.specs));

    expect(result.current.has("sheets")).toBe(true);
    expect(result.current.has("rule")).toBe(true);
    expect(result.current.has("specs")).toBe(true);
    expect(result.current.has("lines")).toBe(false);
  });

  it("clears its timers when the block unmounts mid-build", () => {
    // Every stage is scheduled at mount with an absolute delay, so a build
    // abandoned part way leaves the rest of the table pending unless the hook
    // clears them.
    const { unmount } = renderHook(() => useBriefBuild(true));

    act(() => vi.advanceTimersByTime(AT.rule));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles straight to done under reduced motion, scheduling nothing", () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useBriefBuild(true));

    expect(result.current.stage).toBe("done");
    expect(result.current.has("lines")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
