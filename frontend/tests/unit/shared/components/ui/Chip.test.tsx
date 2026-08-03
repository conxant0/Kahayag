// Verifies chip selection semantics and the read-only variant.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "../../../../../src/shared/components/ui";

describe("Chip", () => {
  it("reports selection through aria-pressed", () => {
    render(
      <>
        <Chip onClick={() => {}}>₱2,500</Chip>
        <Chip selected onClick={() => {}}>
          ₱4,800
        </Chip>
      </>,
    );

    expect(screen.getByRole("button", { name: "₱2,500" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "₱4,800" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls its handler when picked", async () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>₱8,000</Chip>);

    await userEvent.click(screen.getByRole("button", { name: "₱8,000" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is inert and unpressable without a handler", () => {
    render(<Chip>Read-only</Chip>);

    const chip = screen.getByRole("button", { name: "Read-only" });

    expect(chip).toBeDisabled();
    // No toggle is offered, so none should be announced.
    expect(chip).not.toHaveAttribute("aria-pressed");
  });
});
