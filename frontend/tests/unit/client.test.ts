// Verifies the API client turns FastAPI error shapes into readable messages.
import { describe, expect, it } from "vitest";

import { formatErrorDetail } from "../../src/shared/api/client";

describe("formatErrorDetail", () => {
  it("passes a string detail through", () => {
    expect(formatErrorDetail("Roof polygon is too small", 400)).toBe(
      "Roof polygon is too small",
    );
  });

  it("joins FastAPI validation-error arrays by message", () => {
    const detail = [
      { loc: ["body", "area_m2"], msg: "must be greater than 0" },
      { loc: ["body", "address"], msg: "must not be empty" },
    ];

    expect(formatErrorDetail(detail, 422)).toBe(
      "must be greater than 0; must not be empty",
    );
  });

  it("falls back to the status when there is no detail", () => {
    expect(formatErrorDetail(undefined, 500)).toBe("Request failed: 500");
  });
});
