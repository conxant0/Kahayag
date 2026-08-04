import { useState } from "react";

import { Button, Chip, Eyebrow, SegmentedToggle } from "../../shared/components/ui";
import type { SolverGoal } from "../../shared/api/types";
import { ASK_AI_CHIPS, GOAL_LABELS } from "./designViewModel";
import {
  useDesignAgent,
  useExplainDesign,
  useOptimiseDesign,
} from "./useDesignActions";

type SidebarTab = "design" | "ask";

const TAB_OPTIONS = [
  { value: "design", label: "Design system" },
  { value: "ask", label: "Ask AI" },
] as const;

function WandIcon() {
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
        d="M4 20L14.5 9.5M12.5 7.5l2-2 4 4-2 2-4-4ZM9 5l.6 1.4L11 7l-1.4.6L9 9l-.6-1.4L7 7l1.4-.6L9 5Zm8 8l.6 1.4L19 15l-1.4.6L17 17l-.6-1.4L15 15l1.4-.6L17 13Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DesignSidebar({
  onApplied,
}: {
  onApplied: () => void;
}) {
  const [tab, setTab] = useState<SidebarTab>("design");
  const [customRequest, setCustomRequest] = useState("");
  const [askReply, setAskReply] = useState<string | null>(null);

  const optimise = useOptimiseDesign();
  const agent = useDesignAgent();
  const explain = useExplainDesign();

  const busy = optimise.isPending || agent.isPending || explain.isPending;

  const runGoal = (goal: SolverGoal) => {
    setAskReply(null);
    optimise.mutate(goal);
  };

  const sendCustom = () => {
    const text = customRequest.trim();
    if (!text) {
      return;
    }
    setAskReply(null);
    agent.mutate(text, {
      onSuccess: ({ reply }) => setAskReply(reply),
    });
    setCustomRequest("");
  };

  const askQuestion = (question: string) => {
    explain.mutate(question, {
      onSuccess: ({ explanation }) => setAskReply(explanation),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <SegmentedToggle
        ariaLabel="Design sidebar tabs"
        value={tab}
        options={TAB_OPTIONS}
        onChange={setTab}
        className="w-full *:flex-1"
      />

      {tab === "design" ? (
        <>
          <section className="flex flex-col gap-2">
            <Eyebrow>Goal-oriented actions</Eyebrow>
            <div className="flex flex-col gap-2">
              {(["budget", "backup", "independence"] as const).map((goal) => (
                <button
                  key={goal}
                  type="button"
                  disabled={busy}
                  onClick={() => runGoal(goal)}
                  className="rounded-pill border border-hairline bg-white px-4 py-3 text-left font-sans text-[13px] font-semibold text-ink transition-colors hover:border-tertiary disabled:opacity-45"
                >
                  {GOAL_LABELS[goal]}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <Eyebrow>Custom request</Eyebrow>
            <div className="relative">
              <textarea
                className="min-h-24 w-full rounded-[16px] border border-hairline bg-white p-3 pr-14 font-sans text-sm text-ink"
                placeholder={`“Make it look minimal” or “Add two more panels”`}
                value={customRequest}
                onChange={(event) => setCustomRequest(event.target.value)}
              />
              <button
                type="button"
                disabled={busy || !customRequest.trim()}
                onClick={sendCustom}
                aria-label="Send custom request"
                className="absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-45"
              >
                →
              </button>
            </div>
          </section>

          <Button
            fullWidth
            disabled={busy}
            onClick={() => runGoal("auto")}
            className="gap-2"
          >
            <WandIcon />
            {GOAL_LABELS.auto}
          </Button>
        </>
      ) : (
        <section className="flex flex-col gap-2">
          <Eyebrow>Quick questions</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {ASK_AI_CHIPS.map((chip) => (
              <Chip key={chip} onClick={() => askQuestion(chip)} disabled={busy}>
                {chip}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {askReply ? (
        <p className="rounded-[14px] border border-hairline bg-white p-3 font-sans text-sm text-ink">
          {askReply}
        </p>
      ) : null}

      {(optimise.error ?? agent.error ?? explain.error) ? (
        <p className="font-sans text-sm text-ember" role="alert">
          {(optimise.error ?? agent.error ?? explain.error)?.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        <Button
          variant="ghost"
          fullWidth
          disabled={busy}
          className="h-12 border-hairline bg-white text-ink"
        >
          Save design
        </Button>
        <Button
          fullWidth
          disabled={busy}
          onClick={onApplied}
          className="bg-ink text-paper hover:bg-ink hover:shadow-none"
        >
          Apply design
        </Button>
      </div>
    </div>
  );
}
