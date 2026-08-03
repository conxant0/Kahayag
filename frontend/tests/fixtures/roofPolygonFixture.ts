// Builds a complete RoofPolygon from the fields a test actually cares about.
import type {
  RoofCoordinate,
  RoofPolygon,
} from "../../src/state/assessmentStore";

/**
 * Fills in the identity and provenance fields so a test can state only the
 * geometry it is asserting on.
 *
 * `RoofPolygon` carries `id`, `propertyId`, `perimeterMeters` and `createdAt`
 * alongside the shape, and no test here reads them. Repeating four placeholder
 * values at every call site would say those values matter, which they do not.
 */
export function roofPolygonFixture({
  coordinates,
  areaSquareMeters,
  ...overrides
}: {
  coordinates: RoofCoordinate[];
  areaSquareMeters: number;
} & Partial<
  Omit<RoofPolygon, "coordinates" | "areaSquareMeters">
>): RoofPolygon {
  return {
    id: "roof-fixture",
    propertyId: null,
    perimeterMeters: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    coordinates,
    areaSquareMeters,
    ...overrides,
  };
}
