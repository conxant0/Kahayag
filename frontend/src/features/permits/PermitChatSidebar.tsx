// Defines the permits chat sidebar: the one live part of this preview,
// wired to POST /permits/chat (commit 7ecb4d7). Mirrors
// `frontend/src/features/quotation/AskEngineSidebar.tsx`'s layout and message
// treatment, flattened to the editorial system: no card shell — a hairline
// rule separates it from the reading column on wide screens. Suggested
// questions are the shared Chip. Engine replies carry the cobalt left rule
// (cobalt informs); the homeowner's own words sit in the neutral track fill.
// When the endpoint returns an updated `applicant`, it is handed back to the
// page, and the endpoint's own recomputed `assessment` (domain output, same
// as POST /permits/assess) is applied straight to the page's displayed
// assessment — the chat can set inputs and refresh the checklist/findings in
// one round trip, not just answer questions.
import { useEffect, useRef, useState } from "react";

import { Chip } from "../../shared/components/ui";
import type { ApplicantFormValues } from "./ApplicantForm";
import type { PermitAssessment } from "./permitTypes";
import {
  PERMIT_CHAT_FOLLOW_UP_QUESTIONS,
  PERMIT_CHAT_SUGGESTED_QUESTIONS,
  permitChatWelcomeCopy,
} from "./permitChatViewModel";
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

// Rolling transcript cap — keeps the last 10 messages (user + assistant
// combined) so the sidebar doesn't grow unbounded across a long session.
const MAX_TURNS = 10;

function appendTurn(current: readonly ChatTurn[], turn: ChatTurn): readonly ChatTurn[] {
  return [...current, turn].slice(-MAX_TURNS);
}

// Shallow compare of the five applicant fields the chat can change, so a
// pure question doesn't re-trigger the page's assess request.
function applicantEquals(a: ApplicantFormValues, b: ApplicantFormValues): boolean {
  return (
    a.solarInOriginalPermit === b.solarInOriginalPermit &&
    a.fullName === b.fullName &&
    a.isRegisteredOwner === b.isRegisteredOwner &&
    a.registeredOwnerName === b.registeredOwnerName &&
    a.delegatesFilingToRepresentative === b.delegatesFilingToRepresentative
  );
}

export function PermitChatSidebar({
  applicant,
  onApplicantChange,
  onAssessmentChange,
  propertyAddress,
  systemKwp,
  uploads,
  buildId,
}: {
  applicant: ApplicantFormValues;
  onApplicantChange: (values: ApplicantFormValues) => void;
  onAssessmentChange: (
    assessment: PermitAssessment,
    applicant: ApplicantFormValues,
  ) => void;
  propertyAddress: string;
  systemKwp: number;
  uploads: ReadonlyMap<string, File>;
  buildId: string | null;
}) {
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = usePermitChat();

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [turns, chat.isPending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) {
      return;
    }
    setDraft("");
    setTurns((current) => appendTurn(current, { role: "user", text: trimmed }));
    try {
      const response = await chat.mutateAsync({
        payload: {
          applicant: toApiApplicant(applicant),
          system_kwp: systemKwp,
          build_id: buildId,
          property_address: propertyAddress,
          user_text: trimmed,
        },
        uploads,
      });
      setTurns((current) => appendTurn(current, { role: "assistant", text: response.reply }));
      const nextApplicant = fromApiApplicant(response.applicant);
      if (!applicantEquals(applicant, nextApplicant)) {
        onApplicantChange(nextApplicant);
      }
      onAssessmentChange(response.assessment, nextApplicant);
    } catch {
      // chat.error surfaces below.
    }
  };

  const showStarterChips = turns.length === 0 && !chat.isPending;
  const showFollowUps = turns.length > 0 && !chat.isPending;

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-4 border-t border-hairline pt-6 print:hidden xl:border-t-0 xl:border-l xl:pt-0 xl:pl-8"
      aria-label="Ask about your permit packet"
    >
      <header className="flex shrink-0 items-center gap-2 text-ink">
        <EngineIcon />
        <h2 className="font-sans text-sm font-semibold">Ask about your packet</h2>
      </header>

      <p className="shrink-0 font-sans text-[13px] leading-5 text-secondary">
        Answers can update your details above — the checklist and findings
        recompute from whatever you confirm here.
      </p>

      {showStarterChips ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {PERMIT_CHAT_SUGGESTED_QUESTIONS.map((question) => (
            <Chip
              key={question}
              onClick={() => void send(question)}
              disabled={chat.isPending}
            >
              {question}
            </Chip>
          ))}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
        aria-live="polite"
      >
        {turns.length === 0 && !chat.isPending ? (
          <p className="my-auto max-w-[34ch] self-center text-center font-serif text-[15px] leading-6 text-tertiary-ink italic">
            {permitChatWelcomeCopy()}
          </p>
        ) : null}
        {turns.map((turn, index) => (
          <p
            key={`${turn.role}-${index}`}
            className={
              turn.role === "user"
                ? "self-end rounded-[14px] bg-[#f2eee4] px-3.5 py-2 font-sans text-sm leading-5 text-ink"
                : "border-l-2 border-cobalt pl-3 font-sans text-sm leading-6 whitespace-pre-wrap text-ink"
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

      {showFollowUps ? (
        <ul className="flex shrink-0 flex-col gap-2">
          {PERMIT_CHAT_FOLLOW_UP_QUESTIONS.map((question) => (
            <li key={question}>
              <button
                type="button"
                disabled={chat.isPending}
                onClick={() => void send(question)}
                className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-hairline px-3 py-2.5 text-left font-sans text-[13px] text-ink transition-colors hover:border-tertiary disabled:opacity-45"
              >
                <span>{question}</span>
                <span aria-hidden="true" className="text-tertiary-ink">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex shrink-0 items-center gap-2 rounded-pill border border-hairline bg-white py-1.5 pr-1.5 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
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
        <p className="shrink-0 font-sans text-sm text-ember" role="alert">
          {chat.error.message}
        </p>
      ) : null}
    </section>
  );
}
