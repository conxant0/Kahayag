// Verifies the pill button's defaults, disabled handling, and link variant.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Button, ButtonLink } from "../../../../../src/shared/components/ui";

describe("Button", () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Continue</Button>);

    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("still accepts an explicit submit type", () => {
    render(<Button type="submit">Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("does not fire its handler while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Continue
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ButtonLink", () => {
  it("renders a link to its destination rather than a button", () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/trace">Next: Trace your roof</ButtonLink>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Next: Trace your roof" });

    expect(link).toHaveAttribute("href", "/trace");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
