// Shared setup for the landing animation hooks, which are all timer driven and
// all branch on the reduced-motion preference.
import { afterEach, beforeEach, vi } from "vitest";

const realMatchMedia = window.matchMedia;

/**
 * Answers `prefers-reduced-motion` for the test that asks.
 *
 * `tests/setup.ts` installs a stub that always reports "does not match", which
 * is the right baseline. These hooks branch on the preference being *on*, so it
 * has to be answerable per test.
 */
export function setReducedMotion(enabled: boolean): void {
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: enabled && query.includes("prefers-reduced-motion"),
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * Installs the fake clock and the motion stub, and takes both back afterwards.
 *
 * Called once at the top of each hook's suite. It lives here rather than being
 * repeated per file so that changing how these hooks are driven, the clock they
 * run on or the preference they read, is one edit rather than four.
 *
 * `toFake` is for the hooks that run on something other than `setTimeout`.
 */
type FakeTimerOptions = NonNullable<Parameters<typeof vi.useFakeTimers>[0]>;

export function installTimedHookHarness(
  options: { toFake?: FakeTimerOptions["toFake"] } = {},
) {
  beforeEach(() => {
    setReducedMotion(false);
    vi.useFakeTimers(options.toFake ? { toFake: options.toFake } : undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = realMatchMedia;
  });
}
