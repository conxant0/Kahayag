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

  it("commits nothing while the rate is still being typed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.type(rateField(), "12.5");

    // Every prefix here — "1", "12", "12." — is a number the store would take
    // and recompute the whole screen from. ₱1/kWh was never an answer.
    expect(rateField()).toHaveValue("12.5");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits the finished rate when the field is left", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.type(rateField(), "12.5");
    await user.tab();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ electricityRatePhpPerKwh: 12.5 });
  });

  it("does not eat a trailing zero on the way to a centavo rate", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    await user.type(rateField(), "12.50");

    expect(rateField()).toHaveValue("12.50");
  });

  it("tidies a half-typed rate to the value that was committed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.type(rateField(), "9.");
    await user.tab();

    // The trailing point is not part of any answer, and leaving it on screen
    // would suggest the store holds something it does not.
    expect(onChange).toHaveBeenCalledWith({ electricityRatePhpPerKwh: 9 });
    expect(rateField()).toHaveValue("9");
  });

  it("reads an emptied rate as the published one rather than as zero", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.type(rateField(), "9");
    await user.tab();
    await user.clear(rateField());
    await user.tab();

    // Null, not 12: the backend applies the default itself and discloses that
    // it did, which it cannot do if the frontend fills the figure in first.
    expect(onChange).toHaveBeenLastCalledWith({
      electricityRatePhpPerKwh: null,
    });
    expect(rateField()).toHaveValue("");
    expect(rateField()).toHaveAttribute(
      "placeholder",
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

    // What a reset looks like from here: the store goes back to holding no
    // override and the field has to stop showing the old session's answer.
    rerender(
      <RefineInputs
        budgetPhp={null}
        electricityRatePhpPerKwh={null}
        onChange={() => {}}
      />,
    );

    expect(rateField()).toHaveValue("");
  });
});
