// Verifies which control the tracing step offers, and when it refuses to.
import { describe, expect, it } from "vitest";

import { resolveRoofTraceStage } from "../../../../src/features/roof/roofTraceStage";

const BASE = {
  mapStatus: "ready" as const,
  hasProperty: true,
  isTracingRoof: false,
  traceIsUsable: false,
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
    expect(view.canClear).toBe(false);
  });

  it("tells the person up front that they will draw the shape by clicking", () => {
    // There is no seeded outline any more; the first click is the whole
    // gesture, so the idle hint has to set that expectation.
    const view = stageOf();

    expect(view.hint).toMatch(/click each corner/i);
  });

  it("leads with the click gesture while tracing", () => {
    // Clicking builds the shape; dragging only fine-tunes it. The hint has to
    // name the building gesture first or the map reads as drag-only.
    const view = stageOf({ isTracingRoof: true, vertexCount: 4 });

    expect(view.stage).toBe("tracing");
    expect(view.hint).toMatch(/click the map/i);
    expect(view.hint).toMatch(/drag any corner/i);
  });

  it("switches the main action to confirming once tracing", () => {
    const view = stageOf({
      isTracingRoof: true,
      traceIsUsable: true,
      vertexCount: 4,
    });

    expect(view.action).toEqual({ label: "Confirm tracing", kind: "confirm" });
    expect(view.actionEnabled).toBe(true);
  });

  it("refuses to confirm a shape that encloses nothing", () => {
    const view = stageOf({ isTracingRoof: true, vertexCount: 2 });

    expect(view.action?.kind).toBe("confirm");
    expect(view.actionEnabled).toBe(false);
  });

  it("refuses to confirm a shape that fails validation", () => {
    // Enough corners is not enough: a shape too small to fit a panel, or one
    // crossing itself, must not be confirmable however many corners it has.
    const view = stageOf({
      isTracingRoof: true,
      traceIsUsable: false,
      vertexCount: 4,
    });

    expect(view.action?.kind).toBe("confirm");
    expect(view.actionEnabled).toBe(false);
  });

  it("lets a confirmed roof be edited again", () => {
    const view = stageOf({ hasConfirmedPolygon: true });

    expect(view.stage).toBe("confirmed");
    expect(view.action).toEqual({ label: "Edit tracing", kind: "start" });
    expect(view.canClear).toBe(true);
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
    expect(stageOf({ isTracingRoof: true, vertexCount: 4 }).canClear).toBe(
      true,
    );
  });
});
