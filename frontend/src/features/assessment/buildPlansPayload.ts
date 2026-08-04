// Builds the plans object sent with design bootstrap.
import type { AssessmentPlans } from "../../state/assessmentStore";

/** Returns undefined when no plan answer was given at all. */
export function buildPlansPayload(
  plans: AssessmentPlans,
): Record<string, unknown> | undefined {
  const hasAny =
    plans.primaryGoal !== null ||
    plans.usagePattern !== null ||
    plans.futureLoads !== null ||
    plans.roofMaterial !== null ||
    plans.propertyKind !== null ||
    plans.ownsProperty !== null ||
    plans.timeline !== null;

  if (!hasAny) {
    return undefined;
  }

  return {
    primary_goal: plans.primaryGoal,
    usage_pattern: plans.usagePattern,
    future_loads: plans.futureLoads,
    roof_material: plans.roofMaterial,
    property_kind: plans.propertyKind,
    owns_property: plans.ownsProperty,
    timeline: plans.timeline,
  };
}
