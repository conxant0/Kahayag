// Defines which stage of tracing the screen is in, and what it should say.
//
// Kept out of the component and free of JSX so the wording and the enabling
// rules can be asserted directly. The screen renders this; it does not decide
// it.
import type { MapStatus } from "../../integrations/maps";

export type RoofTraceStage =
  | "no-property"
  | "map-loading"
  | "map-error"
  | "idle"
  | "fitting"
  | "tracing"
  | "confirmed";

export type RoofTraceStageView = {
  stage: RoofTraceStage;
  /** The single line of guidance above the map. */
  hint: string;
  /** The main control, or null where there is nothing to act on yet. */
  action: { label: string; kind: "start" | "confirm" } | null;
  /** Whether the main control can be pressed right now. */
  actionEnabled: boolean;
  /** Whether the shape can be thrown away and drawn again. */
  canRedraw: boolean;
  /** Whether there is anything to clear. */
  canClear: boolean;
};

/**
 * A roof needs three corners before it encloses anything, so this is the floor
 * for confirming rather than a matter of taste.
 */
const MIN_VERTICES = 3;

export function resolveRoofTraceStage({
  mapStatus,
  hasProperty,
  isTracingRoof,
  isFittingOutline,
  vertexCount,
  hasConfirmedPolygon,
}: {
  mapStatus: MapStatus;
  hasProperty: boolean;
  isTracingRoof: boolean;
  isFittingOutline: boolean;
  vertexCount: number;
  hasConfirmedPolygon: boolean;
}): RoofTraceStageView {
  if (!hasProperty) {
    return {
      stage: "no-property",
      hint: "Go back a step and pick your property, then you can trace its roof here.",
      action: null,
      actionEnabled: false,
      canRedraw: false,
      canClear: false,
    };
  }

  // Both failures land here. They have different causes, but neither leaves
  // anything to trace on and neither is the homeowner's to fix.
  if (mapStatus === "failed" || mapStatus === "missing-key") {
    return {
      stage: "map-error",
      hint: "The satellite map could not load, so there is nothing to trace on. Check your connection and reload the page.",
      action: null,
      actionEnabled: false,
      canRedraw: false,
      canClear: false,
    };
  }

  if (mapStatus !== "ready") {
    return {
      stage: "map-loading",
      hint: "Loading the satellite view of your property.",
      action: { label: "Trace my roof", kind: "start" },
      actionEnabled: false,
      canRedraw: false,
      canClear: false,
    };
  }

  if (isFittingOutline) {
    return {
      stage: "fitting",
      hint: "Looking for the outline of the building under your pin.",
      action: { label: "Finding your roof…", kind: "start" },
      actionEnabled: false,
      canRedraw: false,
      canClear: false,
    };
  }

  if (isTracingRoof) {
    return {
      stage: "tracing",
      // Naming both gestures: the corner drag is discoverable, the midpoint
      // one is not, and someone who needs a fifth corner will not guess it.
      hint: "Drag each corner onto a corner of your roof. To add a corner, drag the small dot in the middle of any edge.",
      action: { label: "Confirm tracing", kind: "confirm" },
      actionEnabled: vertexCount >= MIN_VERTICES,
      canRedraw: true,
      canClear: true,
    };
  }

  if (hasConfirmedPolygon) {
    return {
      stage: "confirmed",
      hint: "That is your roof. Continue, or edit the shape if it needs another pass.",
      action: { label: "Edit tracing", kind: "start" },
      actionEnabled: true,
      canRedraw: true,
      canClear: true,
    };
  }

  return {
    stage: "idle",
    hint: "We will start you off with the shape of the building under your pin. Adjust it to cover the roof you could put panels on.",
    action: { label: "Trace my roof", kind: "start" },
    actionEnabled: true,
    canRedraw: false,
    canClear: vertexCount > 0,
  };
}
