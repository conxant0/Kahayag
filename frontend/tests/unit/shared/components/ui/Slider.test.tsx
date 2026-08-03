// Verifies the slider's label wiring, formatted output, and numeric reporting.
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slider } from "../../../../../src/shared/components/ui";

function renderSlider(overrides: Partial<Parameters<typeof Slider>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <Slider
      label="Electricity rate"
      min={6}
      max={18}
      step={0.5}
      value={11.5}
      onChange={onChange}
      formatValue={(value) => `₱${value.toFixed(2)} / kWh`}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("Slider", () => {
  it("associates the label with the range input", () => {
    renderSlider();

    expect(
      screen.getByRole("slider", { name: "Electricity rate" }),
    ).toHaveValue("11.5");
  });

  it("shows the value through the caller's formatter", () => {
    renderSlider();

    expect(screen.getByText("₱11.50 / kWh")).toBeInTheDocument();
  });

  it("reports a number, not the input's string", () => {
    const { onChange } = renderSlider();

    fireEvent.change(screen.getByRole("slider"), { target: { value: "14" } });

    expect(onChange).toHaveBeenCalledWith(14);
  });

  it("does not divide by zero when min and max are equal", () => {
    renderSlider({ min: 12, max: 12, value: 12 });

    expect(screen.getByRole("slider")).toBeInTheDocument();
  });
});
