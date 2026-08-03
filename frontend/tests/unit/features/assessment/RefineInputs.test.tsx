// Verifies the optional budget and tariff fields commit only settled values.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { RefineInputs } from "../../../../src/features/assessment/components/RefineInputs";
import {
  DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH,
  DEFAULT_ENERGY_INPUTS,
} from "../../../../src/state/assessmentStore";
import type { EnergyInputs } from "../../../../src/state/assessmentStore";

/**
 * Stands in for the store: the component is controlled, so the behaviour worth
 * testing is what it does with the value that comes back, not the call alone.
 */
function Harness({
  onChange,
}: {
  onChange?: (changes: Partial<EnergyInputs>) => void;
}) {
  const [inputs, setInputs] = useState<EnergyInputs>(DEFAULT_ENERGY_INPUTS);

  return (
    <RefineInputs
      budgetPhp={inputs.budgetPhp}
      electricityRatePhpPerKwh={inputs.electricityRatePhpPerKwh}
      onChange={(changes) => {
        onChange?.(changes);
        setInputs((current) => ({ ...current, ...changes }));
      }}
    />
  );
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Add a budget or your own rate"));
}

const budgetField = () => screen.getByLabelText("Budget (optional)");
const rateField = () => screen.getByLabelText("Electricity rate (₱/kWh)");

describe("RefineInputs", () => {
  it("keeps the fields out of the way until they are asked for", () => {
    render(<Harness />);

    expect(
      screen.getByText("Add a budget or your own rate").closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("reports an emptied budget as no ceiling rather than a ceiling of zero", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.type(budgetField(), "150000");
    expect(budgetField()).toHaveValue("150,000");

    await user.clear(budgetField());

    expect(onChange).toHaveBeenLastCalledWith({ budgetPhp: null });
  });

  it("holds a half-typed rate back instead of recomputing from it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.clear(rateField());
    await user.type(rateField(), "9.");

    // "9" alone is a positive number the store would accept, so it commits;
    // the trailing point is not a value at all and must not.
    expect(rateField()).toHaveValue("9.");
    expect(onChange).toHaveBeenLastCalledWith({ electricityRatePhpPerKwh: 9 });
  });

  it("does not eat a trailing zero on the way to a centavo rate", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    await user.clear(rateField());
    await user.type(rateField(), "12.50");

    expect(rateField()).toHaveValue("12.50");
  });

  it("puts the committed rate back when the field is left unusable", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    await user.clear(rateField());
    await user.tab();

    expect(rateField()).toHaveValue(
      String(DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH),
    );
  });

  it("follows the rate when it is changed from outside the field", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RefineInputs
        budgetPhp={null}
        electricityRatePhpPerKwh={9}
        onChange={() => {}}
      />,
    );
    await open(user);
    expect(rateField()).toHaveValue("9");

    // What a reset looks like from here: the store goes back to the default
    // and the field has to stop showing the old session's answer.
    rerender(
      <RefineInputs
        budgetPhp={null}
        electricityRatePhpPerKwh={DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH}
        onChange={() => {}}
      />,
    );

    expect(rateField()).toHaveValue(
      String(DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH),
    );
  });
});
