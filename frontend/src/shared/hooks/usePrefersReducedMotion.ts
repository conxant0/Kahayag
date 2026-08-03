// Defines a live subscription to the user's reduced-motion preference.
import { useMediaQuery } from "./useMediaQuery";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Tracks `prefers-reduced-motion`, and keeps tracking it — the setting can be
 * changed mid-session and a running sequence needs to hear about it.
 *
 * The stylesheet already neutralises every declarative transition under this
 * preference. This hook exists for what CSS cannot reach: multi-step sequences
 * driven from JavaScript, which have to be skipped outright rather than sped up.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION);
}
