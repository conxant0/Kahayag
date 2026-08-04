// Defines the permits chat sidebar: the one live part of this preview,
// wired to POST /permits/chat (commit 7ecb4d7). Mirrors
// `frontend/src/features/quotation/AskEngineSidebar.tsx`'s layout and message
// treatment, flattened to the editorial system: no card shell — a hairline
// rule separates it from the reading column on wide screens. Suggested
// questions are the shared Chip. Engine replies carry the cobalt left rule
// (cobalt informs); the homeowner's own words sit in the neutral track fill.
// When the endpoint returns an updated `applicant`, it is handed back to the
// page so the checklist and findings recompute from it
// (permitsViewModel.deriveAssessment) — the chat can set inputs, not just
// answer questions.
import { useState } from "react";

import { Chip } from "../../shared/components/ui";
import type { ApplicantFormValues } from "./ApplicantForm";
import { fromApiApplicant, toApiApplicant } from "./permitsViewModel";
import { usePermitChat } from "./usePermitChat";

function EngineIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="4" y="7" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <path d="M9 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 7V5.5a2 2 0 0 1 4 0V7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
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

type ChatTurn = { role: "user" | "assistant"; text: string };

const SUGGESTED_QUESTIONS = [
  "Do I need a notarized authorization?",
  "What track am I on?",
  "I'm not the registered owner — what changes?",
] as const;

export function PermitChatSidebar({
  applicant,
  onApplicantChange,
  propertyAddress,
  systemKwp,
  openingMessages,
}: {
  applicant: ApplicantFormValues;
  onApplicantChange: (values: ApplicantFormValues) => void;
  propertyAddress: string;
  systemKwp: number;
  /**
   * Deterministic messages the transcript opens with — the assessment
   * summary, and in the findings-in-chat preview variant every finding.
   * Rendered from props on each render (never stored as turns) so they stay
   * current as the checklist re-derives, and so they read as the engine's
   * standing report rather than something the model said.
   */
  openingMessages: readonly string[];
}) {
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const chat = usePermitChat();

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setDraft("");
    setTurns((current) => [...current, { role: "user", text: trimmed }]);
    try {
      const response = await chat.mutateAsync({
        applicant: toApiApplicant(applicant),
        system_kwp: systemKwp,
        build_id: null,
        property_address: propertyAddress,
        user_text: trimmed,
      });
      setTurns((current) => [...current, { role: "assistant", text: response.reply }]);
      onApplicantChange(fromApiApplicant(response.applicant));
    } catch {
      // chat.error surfaces below.
    }
  };

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-4 border-t border-hairline pt-6 print:hidden xl:border-t-0 xl:border-l xl:pt-0 xl:pl-8"
      aria-label="Ask about your permit packet"
    >
      <header className="flex items-center gap-2 text-ink">
        <EngineIcon />
        <h2 className="font-sans text-sm font-semibold">Ask about your packet</h2>
      </header>

      <p className="font-sans text-[13px] leading-5 text-secondary">
        Answers can update your details above — the checklist and findings
        recompute from whatever you confirm here.
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <Chip
            key={question}
            onClick={() => send(question)}
            disabled={chat.isPending}
          >
            {question}
          </Chip>
        ))}
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
        aria-live="polite"
      >
        {openingMessages.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="font-sans text-[10px] font-semibold tracking-[1px] text-cobalt uppercase">
              What we checked
            </p>
            {openingMessages.map((message) => (
              <p
                key={message}
                className="border-l-2 border-cobalt pl-3 font-sans text-sm leading-6 text-ink"
              >
                {message}
              </p>
            ))}
          </div>
        ) : null}
        {openingMessages.length === 0 && turns.length === 0 && !chat.isPending ? (
          <p className="my-auto max-w-[34ch] self-center text-center font-serif text-[15px] leading-6 text-tertiary-ink italic">
            Ask why a document is required, or tell us something that changes
            your answers — replies come from the same rules that computed this
            checklist.
          </p>
        ) : null}
        {turns.map((turn, index) => (
          <p
            key={`${turn.role}-${index}`}
            className={
              turn.role === "user"
                ? "self-end rounded-[14px] bg-[#f2eee4] px-3.5 py-2 font-sans text-sm leading-5 text-ink"
                : "border-l-2 border-cobalt pl-3 font-sans text-sm leading-6 text-ink"
            }
          >
            {turn.text}
          </p>
        ))}
        {chat.isPending ? (
          <p className="border-l-2 border-cobalt pl-3 font-sans text-sm leading-6 text-tertiary-ink">
            Thinking…
          </p>
        ) : null}
      </div>

      <form
        className="flex items-center gap-2 rounded-pill border border-hairline bg-white py-1.5 pr-1.5 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a question…"
          className="min-w-0 flex-1 bg-transparent font-sans text-sm text-ink outline-none placeholder:text-tertiary-ink"
          disabled={chat.isPending}
        />
        <button
          type="submit"
          disabled={chat.isPending || !draft.trim()}
          aria-label="Send question"
          className="flex size-10 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-45"
        >
          <SendIcon />
        </button>
      </form>

      {chat.error ? (
        <p className="font-sans text-sm text-ember" role="alert">
          {chat.error.message}
        </p>
      ) : null}
    </section>
  );
}
