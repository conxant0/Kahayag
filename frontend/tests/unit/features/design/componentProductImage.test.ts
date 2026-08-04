import { describe, expect, it } from "vitest";

import { resolveComponentImageUrl } from "../../../../src/features/design/componentImageUrl";
import type { DesignComponent } from "../../../../src/shared/api/types";

function component(overrides: Partial<DesignComponent>): DesignComponent {
  return {
    slot: "panel",
    catalog_id: "panel_004",
    brand: "Trina Solar",
    model: "Vertex S",
    summary: "450W panel",
    qty: 13,
    unit: "pcs",
    unit_price_php: 6600,
    price_as_of: "2026-07-01",
    line_total_php: 85800,
    warranty_note: "15-year warranty",
    badges: [],
    specs: {},
    ...overrides,
  };
}

describe("componentProductImage", () => {
  it("uses the API product_image when present", () => {
    expect(
      resolveComponentImageUrl(
        component({
          product_image: "https://assets.kahayag.dev/catalog/panels/panel_004.jpg",
        }),
      ),
    ).toBe("https://assets.kahayag.dev/catalog/panels/panel_004.jpg");
  });

  it("derives package image URLs from slot and catalog id", () => {
    expect(
      resolveComponentImageUrl(
        component({
          slot: "protection",
          catalog_id: "prot_005",
          product_image: null,
        }),
      ),
    ).toBe("https://assets.kahayag.dev/catalog/protections/prot_005.jpg");
  });

  it("derives primary equipment image URLs when product_image is missing", () => {
    expect(
      resolveComponentImageUrl(
        component({
          slot: "inverter",
          catalog_id: "inv_009",
          product_image: null,
        }),
      ),
    ).toBe("https://assets.kahayag.dev/catalog/inverters/inv_009.jpg");
  });
});
