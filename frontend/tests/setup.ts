// Defines shared frontend test-environment setup.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom does not implement `matchMedia`, so anything reading a media query
 * throws the moment it renders. Report "does not match", which is the baseline
 * variant every hook here already falls back to: no hover, no reduced-motion
 * preference, no parallax.
 *
 * A suite that needs a query to match should override this for its own test
 * rather than have the default lie to every other one.
 */
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

afterEach(() => {
  cleanup();
});
