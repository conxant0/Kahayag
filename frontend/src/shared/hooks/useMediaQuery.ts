// Defines a React subscription to a CSS media query.
import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads a media query during render and re-renders when it flips.
 *
 * `useSyncExternalStore` rather than state plus an effect: `matchMedia` is
 * already an external store, and subscribing to it this way reports the current
 * match on the first render instead of after a paint at a stale value.
 *
 * Only reach for this when the decision cannot be expressed in CSS — which
 * events open a disclosure, whether a JS-driven sequence should run at all.
 * Anything that is purely a matter of appearance belongs in a breakpoint.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  // Without a `window` — a server render, or a bare test renderer — report the
  // baseline variant, which is the one that still works with a plain click.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
