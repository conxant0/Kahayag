// Drives `prefers-reduced-motion` for the landing hook tests.
//
// `tests/setup.ts` installs a matchMedia stub that always reports "does not
// match", which is the right baseline. These hooks branch on the preference
// being *on*, so the query has to be answerable per test.

const original = window.matchMedia;

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

export function restoreMotionPreference(): void {
  window.matchMedia = original;
}
