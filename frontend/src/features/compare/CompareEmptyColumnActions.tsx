// Defines upload and add-build actions for the empty side-by-side compare column.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { Button } from "../../shared/components/ui";
import type { SolverGoal } from "../../shared/api/types";
import { useCreateUserBuild, useMutateDesign } from "../design/useDesignActions";
import { useQuoteAudit } from "./useQuoteAudit";

const ACCEPTED_QUOTE_TYPES =
  ".pdf,.txt,.csv,.md,.png,.jpg,.jpeg,.webp,image/*,application/pdf,text/plain";

function UploadIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 16V5M12 5l-3.5 3.5M12 5l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 18.5v1A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width={16}
      height={16}
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

export function CompareEmptyColumnActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const audit = useQuoteAudit();
  const createUserBuild = useCreateUserBuild();
  const mutate = useMutateDesign();
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [showSolver, setShowSolver] = useState(false);
  const [requireBattery, setRequireBattery] = useState(false);
  const [panelDelta, setPanelDelta] = useState(0);
  const [goal, setGoal] = useState<SolverGoal>("auto");

  const pending = audit.isPending || createUserBuild.isPending || mutate.isPending;
  const error = audit.error ?? createUserBuild.error ?? mutate.error;

  const handleFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }

    setUploadWarnings([]);
    try {
      const batch = await audit.mutateAsync(files);
      if (batch.failures.length > 0) {
        setUploadWarnings(batch.failures);
      }
    } catch {
      // mutation error is surfaced below
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const startFromScratch = () => {
    createUserBuild.mutate(undefined, {
      onSuccess: () => navigate(ROUTE_PATHS.design),
    });
  };

  const runSolverAlternate = () => {
    mutate.mutate(
      {
        goal,
        require_battery: requireBattery || undefined,
        min_battery_kwh: requireBattery ? 5 : undefined,
        panel_count_delta: panelDelta === 0 ? undefined : panelDelta,
      },
      {
        onSuccess: () => setShowSolver(false),
      },
    );
  };

  if (showSolver) {
    return (
      <div className="flex w-full max-w-[16rem] flex-col gap-3 text-left">
        <p className="font-sans text-[12px] leading-5 text-secondary">
          Run the solver with different constraints to create another build.
        </p>

        <label className="flex items-center gap-2 font-sans text-[12px] text-ink">
          <input
            type="checkbox"
            checked={requireBattery}
            onChange={(event) => setRequireBattery(event.target.checked)}
          />
          Require battery backup
        </label>

        <fieldset>
          <legend className="font-sans text-[10px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            Panel count change
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {([-1, 0, 1] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPanelDelta(value)}
                className={`rounded-pill border px-2.5 py-1 font-sans text-[11px] ${
                  panelDelta === value
                    ? "border-ink bg-ink text-paper"
                    : "border-hairline bg-white text-secondary"
                }`}
              >
                {value === 0 ? "Same" : value > 0 ? "+1" : "−1"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 font-sans text-[12px] text-ink">
          <span className="text-[10px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            Optimise for
          </span>
          <select
            value={goal}
            onChange={(event) => setGoal(event.target.value as SolverGoal)}
            className="rounded-[10px] border border-hairline bg-white px-2.5 py-1.5 text-[12px]"
          >
            <option value="auto">Best all-round</option>
            <option value="budget">Budget</option>
            <option value="backup">Backup</option>
            <option value="independence">Independence</option>
          </select>
        </label>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            fullWidth
            className="h-10 text-[12px]"
            disabled={pending}
            onClick={runSolverAlternate}
          >
            {mutate.isPending ? "Running solver…" : "Run solver alternate"}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="h-10 border-hairline bg-white text-[12px] text-ink"
            onClick={() => setShowSolver(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[16rem] flex-col items-center gap-3 text-center">
      <p className="font-sans text-[12px] leading-5 text-tertiary">
        Upload an installer quote or add another build to compare against AI suggested.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_QUOTE_TYPES}
        multiple
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <Button
        fullWidth
        className="h-10 gap-2 text-[12px]"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon />
        {audit.isPending ? "Reading quote…" : "Upload quote to audit"}
      </Button>

      <Button
        fullWidth
        variant="secondary"
        className="h-10 gap-2 text-[12px]"
        disabled={pending}
        onClick={startFromScratch}
      >
        <PlusIcon />
        {createUserBuild.isPending ? "Creating build…" : "Start your own build"}
      </Button>

      <button
        type="button"
        className="font-sans text-[12px] font-medium text-cobalt underline-offset-2 hover:underline"
        disabled={pending}
        onClick={() => setShowSolver(true)}
      >
        Or run solver alternate
      </button>

      {uploadWarnings.length > 0 ? (
        <ul className="w-full text-left" role="alert">
          {uploadWarnings.map((warning) => (
            <li
              key={warning}
              className="rounded-[10px] border border-ember/30 bg-[#fff5f2] px-2.5 py-1.5 font-sans text-[11px] text-ember"
            >
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="w-full text-left font-sans text-[11px] text-ember" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
