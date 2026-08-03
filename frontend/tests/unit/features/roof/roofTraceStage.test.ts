// Verifies which control the tracing step offers, and when it refuses to.
import { describe, expect, it } from "vitest";

import { resolveRoofTraceStage } from "../../../../src/features/roof/roofTraceStage";

const BASE = {
  mapStatus: "ready" as const,
  hasProperty: true,
  isTracingRoof: false,
  isFittingOutline: false,
  vertexCount: 0,
  hasConfirmedPolygon: false,
};

const stageOf = (overrides = {}) =>
  resolveRoofTraceStage({ ...BASE, ...overrides });

describe("resolveRoofTraceStage", () => {
  it("sends someone back a step when no property has been picked", () => {
    const view = stageOf({ hasProperty: false });

    expect(view.stage).toBe("no-property");
    expect(view.action).toBeNull();
  });

  it("offers nothing to press while the map is still loading", () => {
    // The button is shown rather than hidden, so the screen does not shuffle
    // its controls around underneath a finger already on the way down.
    const view = stageOf({ mapStatus: "loading" });

    expect(view.stage).toBe("map-loading");
    expect(view.action?.label).toBe("Trace my roof");
    expect(view.actionEnabled).toBe(false);
  });

  it.each(["failed", "missing-key"] as const)(
    "says the map is the problem when the map is the problem (%s)",
    (mapStatus) => {
      const view = stageOf({ mapStatus });

      expect(view.stage).toBe("map-error");
      expect(view.action).toBeNull();
    },
  );

  it("opens with the start action and nothing else", () => {
    const view = stageOf();

    expect(view.stage).toBe("idle");
    expect(view.action).toEqual({ label: "Trace my roof", kind: "start" });
    expect(view.actionEnabled).toBe(true);
    expect(view.canRedraw).toBe(false);
    expect(view.canClear).toBe(false);
  });

  it("reports the fit in progress rather than looking idle", () => {
    const view = stageOf({ isFittingOutline: true });

    expect(view.stage).toBe("fitting");
    expect(view.action?.label).toBe("Finding your roof…");
    expect(view.actionEnabled).toBe(false);
  });

  it("names both drag gestures while tracing", () => {
    // The midpoint drag is the only way to add a corner and nothing on screen
    // suggests it exists, so the hint has to.
    const view = stageOf({ isTracingRoof: true, vertexCount: 4 });

    expect(view.stage).toBe("tracing");
    expect(view.hint).toMatch(/middle of any edge/i);
  });

  it("switches the main action to confirming once tracing", () => {
    const view = stageOf({ isTracingRoof: true, vertexCount: 4 });

    expect(view.action).toEqual({ label: "Confirm tracing", kind: "confirm" });
    expect(view.actionEnabled).toBe(true);
  });

  it("refuses to confirm a shape that encloses nothing", () => {
    const view = stageOf({ isTracingRoof: true, vertexCount: 2 });

    expect(view.action?.kind).toBe("confirm");
    expect(view.actionEnabled).toBe(false);
  });

  it("lets a confirmed roof be edited again", () => {
    const view = stageOf({ hasConfirmedPolygon: true });

    expect(view.stage).toBe("confirmed");
    expect(view.action).toEqual({ label: "Edit tracing", kind: "start" });
    expect(view.canRedraw).toBe(true);
  });

  it("keeps tracing in charge while a confirmed roof is being edited", () => {
    // Both flags are true the moment someone reopens a confirmed shape, and
    // showing "Edit tracing" to a person already editing is a dead control.
    const view = stageOf({ hasConfirmedPolygon: true, isTracingRoof: true });

    expect(view.stage).toBe("tracing");
  });

  it("only offers to discard once there is something to discard", () => {
    expect(stageOf().canClear).toBe(false);
    expect(stageOf({ vertexCount: 4 }).canClear).toBe(true);
    expect(stageOf({ isTracingRoof: true, vertexCount: 4 }).canRedraw).toBe(
      true,
    );
  });
});
