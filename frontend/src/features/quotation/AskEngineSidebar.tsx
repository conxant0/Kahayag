import { useEffect, useMemo, useRef, useState } from "react";

import { Chip } from "../../shared/components/ui";
import type { DesignBuild, QuoteAuditResponse } from "../../shared/api/types";
import { useExplainDesign } from "../design/useDesignActions";
import {
  appendAskEngineTurn,
  askEngineChangeRedirectCopy,
  askEngineFollowUpQuestions,
  askEngineTopChips,
  askEngineWelcomeCopy,
  formatQuestionForExplain,
  isQuotationChangeRequest,
  type AskEngineMode,
  type ChatTurn,
} from "./askEngineViewModel";

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

export function AskEngineSidebar({
  mode,
  activeBuild,
  activeQuote,
}: {
  mode: AskEngineMode;
  activeBuild: DesignBuild | null;
  activeQuote: QuoteAuditResponse | null;
}) {
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const explain = useExplainDesign();

  const welcome = useMemo(
    () =>
      askEngineWelcomeCopy({
        mode,
        build: activeBuild,
        quote: activeQuote,
      }),
    [mode, activeBuild, activeQuote],
  );
  const topChips = useMemo(() => askEngineTopChips({ mode }), [mode]);
  const followUps = useMemo(() => askEngineFollowUpQuestions({ mode }), [mode]);

  useEffect(() => {
    setTurns([]);
    setDraft("");
  }, [mode, activeBuild?.id, activeQuote?.filename]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [turns, explain.isPending, welcome]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || explain.isPending) {
      return;
    }

    setDraft("");
    setTurns((current) => appendAskEngineTurn(current, { role: "user", text: trimmed }));

    if (isQuotationChangeRequest(trimmed)) {
      setTurns((current) =>
        appendAskEngineTurn(current, {
          role: "assistant",
          text: askEngineChangeRedirectCopy(),
        }),
      );
      return;
    }

    try {
      const question = formatQuestionForExplain(trimmed, { mode, quote: activeQuote });
      const { explanation } = await explain.mutateAsync(question);
      setTurns((current) =>
        appendAskEngineTurn(current, { role: "assistant", text: explanation }),
      );
    } catch {
      // explain.error surfaces below.
    }
  };

  const showPrompts = turns.length === 0 && !explain.isPending;

  return (
    <section
      className="flex max-h-[min(42rem,calc(100svh-12rem))] min-h-[22rem] flex-col gap-4 rounded-[20px] border border-hairline bg-white p-5 print:hidden"
      aria-label="Ask the engine"
    >
      <header className="shrink-0 flex items-center gap-2 text-ink">
        <EngineIcon />
        <h2 className="font-sans text-sm font-semibold">Ask the engine</h2>
      </header>

      <p className="shrink-0 font-sans text-[13px] leading-5 text-secondary">
        Answers stay grounded on your frozen design snapshot and solver facts —
        never invented figures.
      </p>

      {showPrompts ? (
        <div className="shrink-0 flex flex-wrap gap-2">
          {topChips.map((chip) => (
            <Chip
              key={chip}
              onClick={() => void send(chip)}
              disabled={explain.isPending}
              className="border-transparent bg-[#fff4cc] text-[12px] text-[#7a5c00] hover:border-transparent hover:text-[#7a5c00]"
            >
              {chip}
            </Chip>
          ))}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5"
        aria-live="polite"
      >
        <p className="rounded-[14px] bg-[#fbf6e8] p-3 font-sans text-sm leading-5 text-ink">
          {welcome}
        </p>

        {turns.map((turn, index) => (
          <p
            key={`${turn.role}-${index}`}
            className={
              turn.role === "user"
                ? "self-end rounded-[14px] bg-[#f2eee4] px-3.5 py-2 font-sans text-sm leading-5 text-ink"
                : "border-l-2 border-cobalt pl-3 font-sans text-sm leading-6 text-ink whitespace-pre-wrap"
            }
          >
            {turn.text}
          </p>
        ))}

        {explain.isPending ? (
          <p className="border-l-2 border-cobalt pl-3 font-sans text-sm leading-6 text-tertiary">
            Thinking…
          </p>
        ) : null}
      </div>

      {showPrompts ? (
        <ul className="shrink-0 flex flex-col gap-2">
          {followUps.map((question) => (
            <li key={question}>
              <button
                type="button"
                disabled={explain.isPending}
                onClick={() => void send(question)}
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
      ) : null}

      <form
        className="shrink-0 flex items-center gap-2 rounded-pill border border-hairline bg-[#fcfaf5] py-1.5 pr-1.5 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a question…"
          className="min-w-0 flex-1 bg-transparent font-sans text-sm text-ink outline-none placeholder:text-tertiary"
          disabled={explain.isPending}
        />
        <button
          type="submit"
          disabled={explain.isPending || !draft.trim()}
          aria-label="Send question"
          className="flex size-10 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-45"
        >
          <SendIcon />
        </button>
      </form>

      {explain.error ? (
        <p className="shrink-0 font-sans text-sm text-ember" role="alert">
          {explain.error.message}
        </p>
      ) : null}
    </section>
  );
}
