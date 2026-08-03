// Verifies the loading bar only ever moves forward, and stops when it should.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLoadingProgress } from "../../../../src/features/loading/useLoadingProgress";
import type { LoadingProgressInput } from "../../../../src/features/loading/useLoadingProgress";

const IDLE: LoadingProgressInput = {
  phase: "assessment",
  isAssessmentPending: false,
  isAssessmentComplete: false,
  isFluxRunning: false,
  hasError: false,
  prefersReducedMotion: false,
};

/** Long enough for the creep to settle against whatever ceiling is in force. */
function runTimers(ms = 8000) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useLoadingProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts part-way in, so the bar never reads as stalled at zero", () => {
    const { result } = renderHook(() => useLoadingProgress(IDLE));

    expect(result.current.progress).toBeGreaterThan(0);
  });

  it("creeps toward the pending ceiling without reaching completion", () => {
    const { result } = renderHook(() =>
      useLoadingProgress({ ...IDLE, isAssessmentPending: true }),
    );

    runTimers();

    expect(result.current.progress).toBeCloseTo(36, 5);
  });

  it("jumps forward when the assessment resolves", () => {
    const { result, rerender } = renderHook(
      (props: LoadingProgressInput) => useLoadingProgress(props),
      { initialProps: { ...IDLE, isAssessmentPending: true } },
    );

    runTimers();
    const whilePending = result.current.progress;

    rerender({
      ...IDLE,
      isAssessmentComplete: true,
      phase: "flux",
    });

    expect(result.current.progress).toBeGreaterThan(whilePending);
    expect(result.current.progress).toBeGreaterThanOrEqual(48);
  });

  it("never goes backwards when a phase reports a lower ceiling", () => {
    const fluxRunning: LoadingProgressInput = {
      ...IDLE,
      phase: "flux",
      isAssessmentComplete: true,
      isFluxRunning: true,
    };
    const { result, rerender } = renderHook(
      (props: LoadingProgressInput) => useLoadingProgress(props),
      { initialProps: fluxRunning },
    );

    runTimers();
    const whileRunning = result.current.progress;
    expect(whileRunning).toBeCloseTo(92, 5);

    rerender({ ...IDLE, isAssessmentPending: true });
    runTimers();

    expect(result.current.progress).toBeGreaterThanOrEqual(whileRunning);
  });

  it("stops advancing once something has failed", () => {
    const { result } = renderHook(() =>
      useLoadingProgress({
        ...IDLE,
        isAssessmentPending: true,
        hasError: true,
      }),
    );

    const atFailure = result.current.progress;
    runTimers();

    expect(result.current.progress).toBe(atFailure);
  });

  it("shows a full bar rather than an animation when motion is not wanted", () => {
    const { result } = renderHook(() =>
      useLoadingProgress({
        ...IDLE,
        isAssessmentPending: true,
        prefersReducedMotion: true,
      }),
    );

    expect(result.current.progress).toBe(100);
  });

  it("fills the bar when the page says the work is done", () => {
    const { result } = renderHook(() => useLoadingProgress(IDLE));

    act(() => {
      result.current.completeProgress();
    });

    expect(result.current.progress).toBe(100);
  });
});
