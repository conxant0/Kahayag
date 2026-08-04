// Decides where an incomplete session belongs in the input journey.
import { ROUTE_PATHS } from "../../app/routePaths";
import type { PersistedSession } from "../../state/assessmentStore";

/** The steps that submit or depend on earlier answers, so cannot open cold. */
export type GuardedStep = "energy" | "loading";

/**
 * The input journey in order, each paired with what that step produces.
 *
 * One ordered list answers "where does this session belong" for every screen
 * that asks, so adding a step means adding an entry here rather than editing
 * each screen's own idea of what came before it.
 */
const JOURNEY: {
  path: string;
  isProduced: (session: PersistedSession) => boolean;
}[] = [
  {
    path: ROUTE_PATHS.locate,
    isProduced: (session) => session.selectedProperty !== null,
  },
  {
    path: ROUTE_PATHS.trace,
    isProduced: (session) => session.roofPolygon !== null,
  },
  {
    path: ROUTE_PATHS.energy,
    isProduced: (session) => (session.energyInputs.monthlyBillPhp ?? 0) > 0,
  },
];

/**
 * How many of the steps above each guarded screen needs behind it.
 *
 * /energy collects the bill, so it needs the two before it. /loading submits
 * the assessment, so it needs all three.
 */
const PREREQUISITE_COUNT: Record<GuardedStep, number> = {
  energy: 2,
  loading: 3,
};

/**
 * The earliest step this session has not completed, or null when it may stay.
 *
 * Returning the *earliest* gap rather than the nearest one matters: someone who
 * opens /loading with nothing stored is sent to pick a property, not to type a
 * bill for a roof that was never traced.
 */
export function resolveRedirectForStep(
  step: GuardedStep,
  session: PersistedSession,
): string | null {
  const prerequisites = JOURNEY.slice(0, PREREQUISITE_COUNT[step]);
  return (
    prerequisites.find((entry) => !entry.isProduced(session))?.path ?? null
  );
}
