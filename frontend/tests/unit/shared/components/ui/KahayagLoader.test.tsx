// Verifies the loader announces its label and keeps its artwork decorative.
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KahayagLoader } from "../../../../../src/shared/components/ui";

describe("KahayagLoader", () => {
  it("announces its label rather than hiding it with the artwork", () => {
    render(<KahayagLoader />);

    // `getByRole` skips anything inside an `aria-hidden` subtree, so this fails
    // if the wrapper is hidden — which would take the label down with it.
    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("Loading");
    expect(status.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("announces a caller-supplied label", () => {
    render(<KahayagLoader label="Estimating your roof" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Estimating your roof",
    );
  });

  it("leaves the injected mark out of the accessibility tree", async () => {
    const { container } = render(<KahayagLoader />);

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });

    const svg = container.querySelector("svg");

    // The mark carries no meaning to anyone who cannot see it, and the label
    // beside it already says what is happening.
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).not.toHaveAttribute("role", "img");
  });
});
