// Defines the compare-custom card for starting a blank build or running the solver.
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { Button } from "../../shared/components/ui";
import type { SolverGoal } from "../../shared/api/types";
import { compareUtilityCardClass } from "./CompareCardsGrid";
import { useCreateUserBuild, useMutateDesign } from "../design/useDesignActions";

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
  const navigate = useNavigate();
  const createUserBuild = useCreateUserBuild();
  const mutate = useMutateDesign();
  const [expanded, setExpanded] = useState(false);
  const [requireBattery, setRequireBattery] = useState(false);
  const [panelDelta, setPanelDelta] = useState(0);
  const [goal, setGoal] = useState<SolverGoal>("auto");

  const startFromScratch = () => {
    createUserBuild.mutate(undefined, {
      onSuccess: () => navigate(ROUTE_PATHS.design),
    });
  };

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

  const pending = createUserBuild.isPending || mutate.isPending;
  const error = createUserBuild.error ?? mutate.error;

  if (expanded) {
    return (
      <article
        className="flex h-full w-full flex-col rounded-[20px] border border-hairline bg-white px-6 py-6 shadow-[0px_3px_10px_0px_rgba(26,23,18,0.04)]"
        aria-label="Compare custom"
      >
        <h2 className="font-serif text-[26px] font-medium leading-none text-ink">
          Solver alternate
        </h2>
        <p className="mt-2 font-sans text-[12.5px] leading-5 text-secondary">
          Or run the solver with a different constraint mix instead of building
          from scratch.
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
          <Button disabled={pending} onClick={runCustomCompare}>
            {mutate.isPending ? "Running solver…" : "Run solver alternate"}
          </Button>
          <Button
            variant="ghost"
            className="border-hairline bg-white text-ink"
            onClick={() => setExpanded(false)}
          >
            Cancel
          </Button>
          {error ? (
            <p className="font-sans text-sm text-ember" role="alert">
              {error.message}
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className={compareUtilityCardClass} aria-label="Compare custom">
      <div className="flex flex-col items-center text-center">
        <h2 className="font-serif text-[26px] font-medium leading-none text-tertiary">
          Your build
        </h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <div className="flex size-[58px] items-center justify-center rounded-pill bg-[#f2eee4] text-secondary">
          <PlusIcon />
        </div>
        <p className="mt-5 max-w-[17rem] font-sans text-[12.5px] leading-5 text-tertiary">
          Start with an empty diagram and pick panels, inverters, and batteries
          yourself.
        </p>
      </div>

      <div className="mt-auto flex w-full flex-col gap-2">
        <Button
          fullWidth
          className="h-[52px] text-[13.5px]"
          disabled={pending}
          onClick={startFromScratch}
        >
          {createUserBuild.isPending ? "Creating build…" : "Start from scratch"}
        </Button>
        <Button
          variant="ghost"
          fullWidth
          className="h-[52px] border-hairline bg-white text-[13.5px] text-ink hover:border-tertiary"
          onClick={() => setExpanded(true)}
        >
          Run solver alternate
        </Button>
        {error ? (
          <p className="font-sans text-sm text-ember" role="alert">
            {error.message}
          </p>
        ) : null}
      </div>
    </article>
  );
}
