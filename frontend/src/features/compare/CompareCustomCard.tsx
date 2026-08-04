// Defines the compare-custom card wired to POST /designs/mutate.
import { useState } from "react";

import { Button } from "../../shared/components/ui";
import type { SolverGoal } from "../../shared/api/types";
import { useMutateDesign } from "../design/useDesignActions";

function PlusIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 3.5v13M3.5 10h13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CompareCustomCard() {
  const mutate = useMutateDesign();
  const [expanded, setExpanded] = useState(false);
  const [requireBattery, setRequireBattery] = useState(false);
  const [panelDelta, setPanelDelta] = useState(0);
  const [goal, setGoal] = useState<SolverGoal>("auto");

  const runCustomCompare = () => {
    mutate.mutate(
      {
        goal,
        require_battery: requireBattery || undefined,
        min_battery_kwh: requireBattery ? 5 : undefined,
        panel_count_delta: panelDelta === 0 ? undefined : panelDelta,
      },
      {
        onSuccess: () => setExpanded(false),
      },
    );
  };

  if (expanded) {
    return (
      <article
        className="flex h-full min-h-[280px] flex-col rounded-[20px] border border-hairline bg-white px-6 py-6"
        aria-label="Compare custom"
      >
        <h2 className="font-serif text-[21px] font-medium leading-7 text-ink">
          Compare custom
        </h2>
        <p className="mt-2 font-sans text-[12.5px] leading-5 text-secondary">
          Run the solver with a different constraint mix and refresh the build cards.
        </p>

        <label className="mt-5 flex items-center gap-3 font-sans text-sm text-ink">
          <input
            type="checkbox"
            checked={requireBattery}
            onChange={(event) => setRequireBattery(event.target.checked)}
          />
          Require battery backup
        </label>

        <fieldset className="mt-4">
          <legend className="font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            Panel count change
          </legend>
          <div className="mt-2 flex gap-2">
            {([-1, 0, 1] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPanelDelta(value)}
                className={`rounded-pill border px-3 py-1.5 font-sans text-sm ${
                  panelDelta === value
                    ? "border-ink bg-ink text-paper"
                    : "border-hairline bg-white text-secondary"
                }`}
              >
                {value === 0 ? "Same" : value > 0 ? "+1 panel" : "−1 panel"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 flex flex-col gap-2 font-sans text-sm text-ink">
          <span className="text-[11px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            Optimise for
          </span>
          <select
            value={goal}
            onChange={(event) => setGoal(event.target.value as SolverGoal)}
            className="rounded-[12px] border border-hairline bg-white px-3 py-2"
          >
            <option value="auto">Best all-round</option>
            <option value="budget">Budget</option>
            <option value="backup">Backup</option>
            <option value="independence">Independence</option>
          </select>
        </label>

        <div className="mt-auto flex flex-col gap-2 pt-6">
          <Button disabled={mutate.isPending} onClick={runCustomCompare}>
            {mutate.isPending ? "Running solver…" : "Run custom compare"}
          </Button>
          <Button
            variant="ghost"
            className="border-hairline bg-white text-ink"
            onClick={() => setExpanded(false)}
          >
            Cancel
          </Button>
          {mutate.error ? (
            <p className="font-sans text-sm text-ember" role="alert">
              {mutate.error.message}
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#d8d2c4] px-6 py-[30px]"
      aria-label="Compare custom"
    >
      <div className="flex size-[58px] items-center justify-center rounded-pill bg-[#f2eee4] text-secondary">
        <PlusIcon />
      </div>
      <h2 className="mt-5 text-center font-serif text-[21px] font-medium leading-7 text-tertiary">
        Compare custom
      </h2>
      <p className="mt-2.5 text-center font-sans text-[12.5px] leading-5 text-tertiary">
        Test a different mix of components and capacity.
      </p>
      <Button
        variant="ghost"
        className="mt-6 border-hairline bg-white text-ink"
        onClick={() => setExpanded(true)}
      >
        Configure custom mix
      </Button>
    </article>
  );
}
