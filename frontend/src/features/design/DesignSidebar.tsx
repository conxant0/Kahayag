import { useState } from "react";

import { Button, Chip, Eyebrow } from "../../shared/components/ui";
import type { SolverGoal } from "../../shared/api/types";
import { ASK_AI_CHIPS, GOAL_LABELS } from "./designViewModel";
import {
  useDesignAgent,
  useExplainDesign,
  useOptimiseDesign,
} from "./useDesignActions";

type SidebarTab = "design" | "ask";

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
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Chip selected={tab === "design"} onClick={() => setTab("design")}>
          Design system
        </Chip>
        <Chip selected={tab === "ask"} onClick={() => setTab("ask")}>
          Ask AI
        </Chip>
      </div>

      {tab === "design" ? (
        <>
          <section className="flex flex-col gap-2">
            <Eyebrow>Goals</Eyebrow>
            <div className="flex flex-col gap-2">
              {(["budget", "backup", "independence"] as const).map((goal) => (
                <Button
                  key={goal}
                  variant="secondary"
                  fullWidth
                  disabled={busy}
                  onClick={() => runGoal(goal)}
                >
                  {GOAL_LABELS[goal]}
                </Button>
              ))}
              <Button
                fullWidth
                disabled={busy}
                onClick={() => runGoal("auto")}
              >
                {GOAL_LABELS.auto}
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <Eyebrow>Custom request</Eyebrow>
            <textarea
              className="min-h-24 w-full rounded-lg border border-hairline bg-white p-3 font-sans text-sm text-ink"
              placeholder="e.g. Add battery backup within my budget"
              value={customRequest}
              onChange={(event) => setCustomRequest(event.target.value)}
            />
            <Button variant="secondary" disabled={busy} onClick={sendCustom}>
              Send to design engine
            </Button>
          </section>
        </>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <Eyebrow>Quick questions</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {ASK_AI_CHIPS.map((chip) => (
                <Chip key={chip} onClick={() => askQuestion(chip)}>
                  {chip}
                </Chip>
              ))}
            </div>
          </section>
        </>
      )}

      {askReply ? (
        <p className="rounded-lg border border-hairline bg-white p-3 font-sans text-sm text-ink">
          {askReply}
        </p>
      ) : null}

      {(optimise.error ?? agent.error ?? explain.error) ? (
        <p className="font-sans text-sm text-red-700" role="alert">
          {(optimise.error ?? agent.error ?? explain.error)?.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        <Button variant="secondary" fullWidth disabled={busy}>
          Save design
        </Button>
        <Button fullWidth disabled={busy} onClick={onApplied}>
          Apply design
        </Button>
      </div>
    </div>
  );
}
