// Defines the choices the plans step offers, and what each one is called.
//
// Kept out of the component so the labels can be asserted directly, and so a
// proposal that later wants to echo an answer back reads the same words the
// homeowner picked rather than a second copy that drifted.
import type {
  AssessmentPlans,
  FutureLoad,
  InstallTimeline,
  PrimaryGoal,
  PropertyKind,
  RoofMaterial,
  UsagePattern,
} from "../../state/assessmentStore";

export type PlanOption<T extends string> = { value: T; label: string };

export const PRIMARY_GOAL_OPTIONS: PlanOption<PrimaryGoal>[] = [
  { value: "reduce-bill", label: "Reduce my bill" },
  { value: "stay-in-budget", label: "Stay within a budget" },
  { value: "backup-outages", label: "Backup for outages" },
  { value: "maximize-production", label: "Maximize production" },
];

export const USAGE_PATTERN_OPTIONS: PlanOption<UsagePattern>[] = [
  { value: "daytime", label: "Mostly daytime" },
  { value: "nighttime", label: "Mostly nighttime" },
  { value: "balanced", label: "About the same" },
];

export const FUTURE_LOAD_OPTIONS: PlanOption<FutureLoad>[] = [
  { value: "aircon", label: "Air conditioner(s)" },
  { value: "ev", label: "Electric vehicle" },
  { value: "water-pump", label: "Water pump" },
  { value: "appliances", label: "More appliances" },
];

export const ROOF_MATERIAL_OPTIONS: PlanOption<RoofMaterial>[] = [
  { value: "metal", label: "Metal" },
  { value: "concrete", label: "Concrete / flat" },
  { value: "tile", label: "Tile" },
  { value: "shingle", label: "Shingle" },
  { value: "unsure", label: "Not sure" },
];

export const PROPERTY_KIND_OPTIONS: PlanOption<PropertyKind>[] = [
  { value: "house", label: "House" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

export const TIMELINE_OPTIONS: PlanOption<InstallTimeline>[] = [
  { value: "three-months", label: "Within 3 months" },
  { value: "six-months", label: "Within 6 months" },
  { value: "one-year", label: "Within a year" },
  { value: "exploring", label: "Just exploring" },
];

/**
 * Whether the step has both answers it actually requires.
 *
 * The goal and the usage pattern are what the proposal is framed around, so
 * they gate the way forward; everything else on the step is context that is
 * welcome but never demanded.
 */
export function hasRequiredPlans(plans: AssessmentPlans): boolean {
  return plans.primaryGoal !== null && plans.usagePattern !== null;
}
