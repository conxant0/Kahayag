import { useState } from "react";

import { Chip, Eyebrow } from "../../shared/components/ui";
import { ASK_AI_CHIPS } from "../design/designViewModel";
import { useDesignAgent, useExplainDesign } from "../design/useDesignActions";

export function AskEngineSidebar() {
  const [askReply, setAskReply] = useState<string | null>(null);
  const agent = useDesignAgent();
  const explain = useExplainDesign();
  const busy = agent.isPending || explain.isPending;

  const askQuestion = (question: string) => {
    explain.mutate(question, {
      onSuccess: ({ explanation }) => setAskReply(explanation),
    });
  };

  const sendCustom = (text: string) => {
    setAskReply(null);
    agent.mutate(text, {
      onSuccess: ({ reply }) => setAskReply(reply),
    });
  };

  return (
    <div className="flex flex-col gap-4 print:hidden">
      <Eyebrow tone="cobalt">Ask the engine</Eyebrow>
      <p className="font-sans text-sm text-secondary">
        Questions are answered from your frozen design snapshot and solver facts
        — not invented figures.
      </p>
      <div className="flex flex-wrap gap-2">
        {ASK_AI_CHIPS.map((chip) => (
          <Chip key={chip} onClick={() => askQuestion(chip)} disabled={busy}>
            {chip}
          </Chip>
        ))}
      </div>
      <textarea
        className="min-h-20 w-full rounded-lg border border-hairline bg-white p-3 font-sans text-sm text-ink"
        placeholder="Ask about this quote…"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const text = event.currentTarget.value.trim();
            if (text) {
              sendCustom(text);
              event.currentTarget.value = "";
            }
          }
        }}
      />
      {askReply ? (
        <p className="rounded-lg border border-hairline bg-white p-3 font-sans text-sm text-ink">
          {askReply}
        </p>
      ) : null}
      {(agent.error ?? explain.error) ? (
        <p className="font-sans text-sm text-red-700" role="alert">
          {(agent.error ?? explain.error)?.message}
        </p>
      ) : null}
    </div>
  );
}
