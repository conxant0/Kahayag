import { useState } from "react";

import { Chip } from "../../shared/components/ui";
import { ASK_AI_CHIPS } from "../design/designViewModel";
import { useDesignAgent, useExplainDesign } from "../design/useDesignActions";

function EngineIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="4"
        y="7"
        width="16"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <path d="M9 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 7V5.5a2 2 0 0 1 4 0V7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SendIcon() {
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
        d="M5 12h12M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SUGGESTED_QUESTIONS = [
  "What if VECO rates rise 5%?",
  "Can I drop the battery later?",
  "How does fit score work?",
] as const;

export function AskEngineSidebar() {
  const [askReply, setAskReply] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const agent = useDesignAgent();
  const explain = useExplainDesign();
  const busy = agent.isPending || explain.isPending;

  const askQuestion = (question: string) => {
    explain.mutate(question, {
      onSuccess: ({ explanation }) => setAskReply(explanation),
    });
  };

  const sendCustom = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setAskReply(null);
    setDraft("");
    agent.mutate(trimmed, {
      onSuccess: ({ reply }) => setAskReply(reply),
    });
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-[20px] border border-hairline bg-white p-5 print:hidden"
      aria-label="Ask the engine"
    >
      <header className="flex items-center gap-2 text-ink">
        <EngineIcon />
        <h2 className="font-sans text-sm font-semibold">Ask the engine</h2>
      </header>

      <p className="font-sans text-[13px] leading-5 text-secondary">
        Answers stay grounded on your frozen design snapshot and solver facts —
        never invented figures.
      </p>

      <div className="flex flex-wrap gap-2">
        {ASK_AI_CHIPS.map((chip) => (
          <Chip
            key={chip}
            onClick={() => askQuestion(chip)}
            disabled={busy}
            className="border-transparent bg-[#fff4cc] text-[12px] text-[#7a5c00] hover:border-transparent hover:text-[#7a5c00]"
          >
            {chip}
          </Chip>
        ))}
      </div>

      {askReply ? (
        <p className="rounded-[14px] bg-[#fbf6e8] p-3 font-sans text-sm leading-5 text-ink">
          {askReply}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <li key={question}>
            <button
              type="button"
              disabled={busy}
              onClick={() => askQuestion(question)}
              className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-hairline px-3 py-2.5 text-left font-sans text-[13px] text-ink transition-colors hover:border-tertiary disabled:opacity-45"
            >
              <span>{question}</span>
              <span aria-hidden="true" className="text-tertiary">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>

      <form
        className="flex items-center gap-2 rounded-pill border border-hairline bg-[#fcfaf5] py-1.5 pr-1.5 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          sendCustom(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a question…"
          className="min-w-0 flex-1 bg-transparent font-sans text-sm text-ink outline-none placeholder:text-tertiary"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Send question"
          className="flex size-10 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-45"
        >
          <SendIcon />
        </button>
      </form>

      {(agent.error ?? explain.error) ? (
        <p className="font-sans text-sm text-ember" role="alert">
          {(agent.error ?? explain.error)?.message}
        </p>
      ) : null}
    </section>
  );
}
